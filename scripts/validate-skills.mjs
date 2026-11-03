#!/usr/bin/env node
// Structural validation for the VYBE repository against the Agent Skills
// specification (https://agentskills.io/specification) plus VYBE's own rules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const ok = [];

/** Minimal YAML frontmatter parser: scalars, quoted strings, folded `>` blocks, one-level maps. */
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    if (raw === "" || raw === ">" || raw === "|") {
      const block = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) block.push(lines[++i]);
      if (raw === "") {
        data[key] = Object.fromEntries(block.map((b) => b.trim().match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k.trim(), unquote(v)]));
      } else data[key] = block.map((b) => b.trim()).join(raw === ">" ? " " : "\n");
    } else data[key] = unquote(raw);
  }
  return { data, body: text.slice(m[0].length) };
}

function unquote(v) {
  const s = v.trim();
  return (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : s;
}

export function validateSkillDir(dir) {
  const errs = [];
  const warns = [];
  const name = path.basename(dir);
  const file = path.join(dir, "SKILL.md");
  if (!fs.existsSync(file)) return { errs: [`${name}: missing SKILL.md`], warns };
  const text = fs.readFileSync(file, "utf8");
  const fm = parseFrontmatter(text);
  if (!fm) return { errs: [`${name}: SKILL.md has no YAML frontmatter`], warns };
  const d = fm.data;
  if (!d.name) errs.push(`${name}: frontmatter.name is required`);
  else {
    if (d.name !== name) errs.push(`${name}: name "${d.name}" must match its directory`);
    if (d.name.length > 64) errs.push(`${name}: name exceeds 64 characters`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.name)) errs.push(`${name}: name must be lowercase a-z0-9 with single hyphens, not at the ends`);
  }
  if (!d.description) errs.push(`${name}: frontmatter.description is required`);
  else if (d.description.length > 1024) errs.push(`${name}: description is ${d.description.length} chars (max 1024)`);
  else if (d.description.length < 80) warns.push(`${name}: description is short; say what it does AND when to use it`);
  if (d.compatibility !== undefined && (d.compatibility.length < 1 || d.compatibility.length > 500)) errs.push(`${name}: compatibility must be 1–500 chars`);
  if (d.metadata !== undefined && (typeof d.metadata !== "object" || Object.values(d.metadata).some((v) => typeof v !== "string"))) errs.push(`${name}: metadata must map strings to strings`);
  const bodyLines = fm.body.split(/\r?\n/).length;
  if (bodyLines > 500) errs.push(`${name}: SKILL.md body is ${bodyLines} lines (spec recommends < 500)`);
  // Every relative file this skill points at must exist.
  const refs = new Set([...fm.body.matchAll(/`((?:references|scripts|assets)\/[A-Za-z0-9_.\/-]+\.(?:md|mjs|json|html|py))`/g)].map((x) => x[1]));
  for (const r of refs) if (!fs.existsSync(path.join(dir, r))) errs.push(`${name}: referenced file ${r} does not exist`);
  return { errs, warns, name: d.name, bodyLines, refs: refs.size };
}

function main() {
  const skillsDir = path.join(ROOT, "skills");
  const skills = fs.readdirSync(skillsDir).filter((n) => fs.statSync(path.join(skillsDir, n)).isDirectory());
  for (const s of skills) {
    const r = validateSkillDir(path.join(skillsDir, s));
    errors.push(...r.errs);
    warnings.push(...r.warns);
    if (!r.errs.length) ok.push(`skill ${s} (${r.bodyLines} lines, ${r.refs} file refs)`);
  }

  // Discovery links for Claude Code (.claude/skills) and Codex/Cursor/OpenCode (.agents/skills).
  for (const d of [".claude/skills", ".agents/skills"]) {
    for (const s of skills) {
      const p = path.join(ROOT, d, s, "SKILL.md");
      if (!fs.existsSync(p)) errors.push(`${d}/${s} does not resolve to a SKILL.md (run: npm run link)`);
    }
  }
  ok.push(`discovery links for ${skills.length} skills in .claude/skills and .agents/skills`);

  // Plugin manifests.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const f of [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
      if (f.endsWith("plugin.json") && j.version !== pkg.version) errors.push(`${f} version ${j.version} ≠ package.json ${pkg.version}`);
      ok.push(f);
    } catch (e) { errors.push(`${f}: ${e.message}`); }
  }

  // Templates: tokens block, audio + caption markers, and scene files.
  const tplRoot = path.join(skillsDir, "vybe", "assets", "templates");
  for (const t of fs.readdirSync(tplRoot)) {
    const index = path.join(tplRoot, t, "index.html");
    if (!fs.existsSync(index)) { errors.push(`template ${t}: missing index.html`); continue; }
    const html = fs.readFileSync(index, "utf8");
    for (const marker of ["vybe:tokens:start", "vybe:audio:start", "vybe:captions:start"]) {
      if (!html.includes(marker)) errors.push(`template ${t}: missing ${marker}`);
    }
    for (const m of html.matchAll(/data-composition-src="([^"]+)"/g)) {
      if (!fs.existsSync(path.join(tplRoot, t, m[1]))) errors.push(`template ${t}: ${m[1]} not found`);
    }
    ok.push(`template ${t}`);
  }

  // Secrets: no key-looking strings anywhere in tracked sources.
  const SECRET = /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|key_[0-9a-f]{40,}|xi-api-key:\s*[0-9a-f]{20,})/;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if ([".git", "node_modules", "vybe-output", ".tmp", "fonts"].includes(e.name)) return [];
    const p = path.join(d, e.name);
    return e.isDirectory() && !e.isSymbolicLink() ? walk(p) : /\.(md|mjs|js|json|html|txt)$/.test(e.name) ? [p] : [];
  });
  const leaks = walk(ROOT).filter((f) => SECRET.test(fs.readFileSync(f, "utf8")));
  if (leaks.length) errors.push(`possible credentials in: ${leaks.map((f) => path.relative(ROOT, f)).join(", ")}`);
  else ok.push("no credential-like strings in sources");

  for (const o of ok) console.log(`✓ ${o}`);
  for (const w of warnings) console.log(`! ${w}`);
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(errors.length ? `\n${errors.length} error(s)` : "\nAll structural checks passed.");
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
