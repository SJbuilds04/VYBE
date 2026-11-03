// Creates an isolated VYBE output project and scaffolds its HyperFrames
// composition from a template, adapted to the brief's format and style.
import fs from "node:fs";
import path from "node:path";
import { run, ensureDir, writeJson, readJson, portable, SKILL_DIR, log } from "./util.mjs";
import { FORMATS, TEMPLATES } from "./args.mjs";

const ASSETS = path.join(SKILL_DIR, "assets");
export const STATE_FILE = "vybe.json";

export function loadStyles() {
  return readJson(path.join(ASSETS, "styles", "styles.json"));
}

/** Pick a directory name that does not exist yet: name, name-2, name-3... */
export function uniqueDir(base, name) {
  let dir = path.join(base, name);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(base, `${name}-${i}`);
  return dir;
}

/** CSS for the token block, from a style preset (+ optional overrides). */
export function tokenCss(preset, overrides = {}) {
  const t = { ...preset.tokens, ...overrides };
  const fontVar = (k) => `"${t[k]}"`;
  const lines = Object.entries(t).map(([k, v]) => {
    const value = k.startsWith("font-") ? fontVar(k) : v;
    return `--vy-${k}: ${value};`;
  });
  return `/* vybe:tokens:start */\n      :root {\n        ${lines.join("\n        ")}\n      }\n      /* vybe:tokens:end */`;
}

function fontFaces(styles, families) {
  return [...families]
    .filter((f) => styles.fonts[f])
    .map((f) => `@font-face { font-family: "${f}"; src: url("assets/fonts/${styles.fonts[f]}") format("woff2"); font-weight: 100 900; }`)
    .join("\n      ");
}

/**
 * Rewrite a template's HTML for a format + style. Pure function (tested).
 * - canvas size: meta viewport, html/body px size, root data-width/height, canvas attrs
 * - tokens: replaces the vybe:tokens block, and makes sure every font used has an @font-face
 */
export function adaptTemplateHtml(html, { width, height, preset, styles, overrides } = {}) {
  let out = html;
  if (width && height) {
    out = out
      .replace(/<meta name="viewport" content="width=\d+, height=\d+"\s*\/?>/, `<meta name="viewport" content="width=${width}, height=${height}" />`)
      .replace(/(html,\s*body\s*\{[^}]*?width:\s*)\d+px(;\s*height:\s*)\d+px/, `$1${width}px$2${height}px`)
      .replace(/data-width="\d+"(\s+)data-height="\d+"/g, `data-width="${width}"$1data-height="${height}"`)
      .replace(/(<canvas[^>]*?width=")\d+("\s+height=")\d+"/g, `$1${width}$2${height}"`);
  }
  if (preset && styles) {
    out = out.replace(/\/\* vybe:tokens:start \*\/[\s\S]*?\/\* vybe:tokens:end \*\//, tokenCss(preset, overrides));
    const families = new Set(["font-display", "font-body", "font-mono"].map((k) => preset.tokens[k]).filter(Boolean));
    const declared = new Set([...out.matchAll(/@font-face\s*\{\s*font-family:\s*"([^"]+)"/g)].map((m) => m[1]));
    const missing = [...families].filter((f) => !declared.has(f));
    if (missing.length) out = out.replace(/(<style>\s*)/, `$1${fontFaces(styles, missing)}\n      `);
  }
  return out;
}

/** Scaffold the HyperFrames project via the official CLI; fall back to a minimal equivalent. */
function hyperframesInit(projectDir, resolution) {
  const r = run("npx", ["--yes", "hyperframes", "init", "composition", "--non-interactive", "--skip-skills", `--resolution=${resolution}`], { cwd: projectDir, timeout: 240000 });
  const compDir = path.join(projectDir, "composition");
  if (r.ok && fs.existsSync(path.join(compDir, "hyperframes.json"))) return { compDir, via: "hyperframes init" };
  log(`warn: hyperframes init failed (${(r.stderr || r.error || "").trim().split("\n").pop()}); writing minimal project files.`);
  ensureDir(compDir);
  writeJson(path.join(compDir, "hyperframes.json"), {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  });
  writeJson(path.join(compDir, "package.json"), {
    name: "composition", private: true, type: "module",
    scripts: { dev: "npx --yes hyperframes preview", check: "npx --yes hyperframes check", render: "npx --yes hyperframes render" },
  });
  return { compDir, via: "fallback" };
}

export function initProject(brief, { template, stylePreset, skipHyperframesInit = false } = {}) {
  const styles = loadStyles();
  const tpl = template || brief.template;
  if (!TEMPLATES.includes(tpl)) throw new Error(`Unknown template "${tpl}".`);
  const tplDir = path.join(ASSETS, "templates", tpl);
  if (!fs.existsSync(path.join(tplDir, "index.html"))) throw new Error(`Template "${tpl}" has no index.html at ${tplDir}`);

  ensureDir(brief.outDir);
  const projectDir = uniqueDir(brief.outDir, brief.name);
  ensureDir(projectDir);
  for (const d of ["previews", "exports", "sources"]) ensureDir(path.join(projectDir, d));

  const fmt = FORMATS[brief.format.key];
  const { compDir, via } = skipHyperframesInit
    ? (() => { const c = ensureDir(path.join(projectDir, "composition")); return { compDir: c, via: "skipped" }; })()
    : hyperframesInit(projectDir, fmt.resolution);
  for (const d of ["assets/fonts", "assets/images", "assets/audio", "assets/video", "compositions"]) ensureDir(path.join(compDir, d));

  // Template files (index.html + any template-local assets).
  for (const entry of fs.readdirSync(tplDir, { withFileTypes: true })) {
    const src = path.join(tplDir, entry.name);
    if (entry.name === "index.html" || entry.name === "TEMPLATE.md") continue;
    fs.cpSync(src, path.join(compDir, entry.name), { recursive: true });
  }
  for (const f of fs.readdirSync(path.join(ASSETS, "fonts"))) {
    fs.copyFileSync(path.join(ASSETS, "fonts", f), path.join(compDir, "assets", "fonts", f));
  }

  const presetKey = stylePreset || brief.style?.preset || null;
  const preset = presetKey ? styles.presets[presetKey] : null;
  if (presetKey && !preset) throw new Error(`Unknown style preset "${presetKey}".`);
  const html = adaptTemplateHtml(fs.readFileSync(path.join(tplDir, "index.html"), "utf8"), {
    width: fmt.width, height: fmt.height, preset, styles,
  });
  fs.writeFileSync(path.join(compDir, "index.html"), html);
  // Scene sub-compositions only need the canvas size; tokens live in index.html's :root.
  const scenesDir = path.join(compDir, "compositions");
  for (const f of fs.readdirSync(scenesDir).filter((x) => x.endsWith(".html"))) {
    const p = path.join(scenesDir, f);
    fs.writeFileSync(p, adaptTemplateHtml(fs.readFileSync(p, "utf8"), { width: fmt.width, height: fmt.height }));
  }

  // User-supplied media is copied in; originals are never modified.
  const images = [];
  for (const img of brief.images || []) {
    const dest = path.join(compDir, "assets", "images", path.basename(img));
    fs.copyFileSync(img, dest);
    images.push({ source: img, project: path.relative(compDir, dest).replace(/\\/g, "/") });
  }

  const state = {
    vybe: "1.0.0",
    createdAt: new Date().toISOString(),
    brief,
    template: tpl,
    stylePreset: presetKey,
    paths: { project: projectDir, composition: compDir },
    scaffold: via,
    images,
    stages: {
      interpret: "done", direction: "pending", storyboard: "pending", assets: "pending",
      composition: "scaffolded", audio: "pending", render: "pending", qc: "pending", deliver: "pending",
    },
    qc: { attempts: 0, maxAttempts: brief.maxFixAttempts ?? 3, history: [] },
  };
  saveState(projectDir, state);
  fs.writeFileSync(path.join(projectDir, "brief.md"), briefMarkdown(brief, state));
  return state;
}

export function briefMarkdown(brief, state) {
  const yn = (b) => (b ? "yes" : "no");
  return `# Brief — ${brief.name}

> Generated by \`vybe init\` from the invocation. The creative director refines this
> file in Stage 1; everything below the line is the agent's interpretation.

| Field | Value | Source |
| --- | --- | --- |
| Prompt | ${brief.prompt || "(none)"} | user |
| Template | ${state.template} | ${brief.template === state.template ? "inferred/flag" : "override"} |
| Format | ${brief.format.key} (${brief.format.width}×${brief.format.height}, ${brief.format.aspect}) | ${brief.format.key === "landscape" ? "default/inferred" : "flag/inferred"} |
| Duration | ${brief.duration.seconds}s | ${brief.duration.source} |
| FPS | ${brief.fps} | default/flag |
| Style | ${brief.style.preset || brief.style.custom || "director's choice"} | ${brief.style.source} |
| Voiceover | ${yn(brief.voice.enabled)}${brief.voice.enabled ? ` (${brief.voice.provider})` : brief.voice.suggested ? " (suggested for this format)" : ""} | ${brief.voice.source} |
| Music | ${yn(brief.music.enabled)} | flag/default |
| SFX | ${yn(brief.sfx.enabled)} | flag/default |
| Captions | ${yn(brief.captions.enabled)} | derived |
| Review mode | ${yn(brief.review)} | flag |
| Quality | ${brief.quality.key} → hyperframes \`--quality ${brief.quality.hyperframes}\` | flag/default |
| Source project | ${brief.project || "—"} | flag |
| Images | ${(state.images || []).map((i) => i.project).join(", ") || "—"} | user |

---

## Interpretation (fill in)

- **Subject:**
- **Audience:**
- **Platform:**
- **Core message (one sentence):**
- **What the viewer should feel:**
- **Required assets / user media:**
- **Narration needed? Why / why not:**
- **Assumptions made instead of asking:**
`;
}

// Paths are stored relative to the project so a project folder is portable and
// never records the machine's directory layout; loadState resolves them again.
export function loadState(projectDir) {
  const dir = path.resolve(projectDir);
  const file = path.join(dir, STATE_FILE);
  if (!fs.existsSync(file)) throw new Error(`${projectDir} is not a VYBE project (no ${STATE_FILE}).`);
  const state = readJson(file);
  state.paths = { ...state.paths, project: dir, composition: path.resolve(dir, state.paths?.composition || "composition") };
  for (const r of state.renders || []) r.output = path.resolve(dir, r.output);
  for (const h of state.qc?.history || []) if (h.video) h.video = path.resolve(dir, h.video);
  return state;
}

export function saveState(projectDir, state) {
  writeJson(path.join(projectDir, STATE_FILE), portable(state, path.resolve(projectDir)));
}

export function setStage(projectDir, stage, status) {
  const state = loadState(projectDir);
  state.stages[stage] = status;
  saveState(projectDir, state);
  return state;
}
