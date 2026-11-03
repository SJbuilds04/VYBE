#!/usr/bin/env node
// Creates (or repairs) the per-agent discovery links inside this repository:
//   .claude/skills/<name>  → ../../skills/<name>   (Claude Code)
//   .agents/skills/<name>  → ../../skills/<name>   (Codex, Cursor, OpenCode, Amp, …)
// The repo commits these as symlinks. On Windows without symlink permission a
// clone turns them into small text files; this script replaces those with
// directory junctions (no admin rights needed). Safe to run repeatedly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = path.join(ROOT, "skills");
const TARGET_DIRS = [".claude/skills", ".agents/skills"];

const names = fs.readdirSync(SKILLS).filter((n) => fs.existsSync(path.join(SKILLS, n, "SKILL.md")));
const report = [];

for (const dir of TARGET_DIRS) {
  const base = path.join(ROOT, dir);
  fs.mkdirSync(base, { recursive: true });
  for (const name of names) {
    const link = path.join(base, name);
    const target = path.join(SKILLS, name);
    let state = "created";
    try {
      const st = fs.lstatSync(link);
      if (fs.existsSync(path.join(link, "SKILL.md"))) { report.push(`ok       ${dir}/${name}`); continue; }
      // Broken link or a text-file stand-in from a symlink-less checkout.
      fs.rmSync(link, { recursive: st.isDirectory() && !st.isSymbolicLink(), force: true });
      state = "repaired";
    } catch { /* does not exist */ }
    try {
      fs.symlinkSync(path.relative(base, target), link, "dir");
    } catch {
      fs.symlinkSync(target, link, "junction"); // Windows fallback
      state += " (junction)";
    }
    report.push(`${state.padEnd(8)} ${dir}/${name}`);
  }
}
console.log(report.join("\n"));
