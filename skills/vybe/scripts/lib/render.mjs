// Stage 7 — gate with `hyperframes check`, then render with `hyperframes render`.
// Every attempt is recorded in vybe.json so QC and finalize know which file is current.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, ensureDir } from "./util.mjs";
import { loadState, saveState } from "./project.mjs";

function tail(text, n = 25) {
  return String(text || "").trim().split("\n").slice(-n).join("\n");
}

export function renderCommand(projectDir, { draft = false, workers, lowMemory = false, skipCheck = false } = {}) {
  const state = loadState(projectDir);
  const compDir = state.paths.composition;
  const brief = state.brief;
  const result = { ok: false, check: null, render: null };

  if (!skipCheck) {
    let c = run("npx", ["--yes", "hyperframes", "check"], { cwd: compDir, timeout: 900000 });
    // A check that dies before reporting any section (browser launch failure under
    // memory pressure) is transient: retry once before blocking the render.
    if (!c.ok && !/Lint\s/.test(c.stdout)) c = run("npx", ["--yes", "hyperframes", "check"], { cwd: compDir, timeout: 900000 });
    result.check = { ok: c.ok, output: tail(c.stdout, 40), stderr: tail(c.stderr.split("\n").filter((l) => !/\[hyperframes\] check: \w+ \d+\/\d+/.test(l)).join("\n"), 15) };
    if (!c.ok) {
      result.error = "hyperframes check failed — fix the findings before rendering (see check.output).";
      return result;
    }
  }

  const n = (state.renders?.length || 0) + 1;
  const outDir = ensureDir(path.join(projectDir, "renders"));
  const output = path.join(outDir, `${draft ? "draft" : "render"}-${String(n).padStart(2, "0")}.mp4`);
  const quality = draft ? "draft" : brief.quality.hyperframes;
  const args = ["--yes", "hyperframes", "render", "--output", output, "--quality", quality, "--fps", String(brief.fps), "--quiet"];
  const freeGB = os.freemem() / 1e9;
  if (lowMemory || freeGB < 1.5) args.push("--low-memory-mode");
  if (workers) args.push("--workers", String(workers));
  const started = Date.now();
  const r = run("npx", args, { cwd: compDir, timeout: 3 * 3600 * 1000 });
  const seconds = +((Date.now() - started) / 1000).toFixed(1);
  const exists = fs.existsSync(output) && fs.statSync(output).size > 0;
  result.render = { ok: r.ok && exists, output, quality, seconds, lowMemory: args.includes("--low-memory-mode"), log: tail(r.stdout + "\n" + r.stderr, 30) };
  if (!result.render.ok) {
    result.error = exists ? "render exited non-zero" : "render produced no file — never report this video as rendered";
    return result;
  }
  state.renders = [...(state.renders || []), { n, output, quality, draft, seconds, at: new Date().toISOString() }];
  state.stages.render = draft ? "draft" : "done";
  saveState(projectDir, state);
  result.ok = true;
  return result;
}
