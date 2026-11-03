// Stage 8 — quality control. Deterministic technical checks with FFmpeg, plus
// frame extraction for the agent's visual (vision-model) review. Writes
// previews/qc-NN/ and appends to quality-report.md. Enforces the fix budget.
import fs from "node:fs";
import path from "node:path";
import { run, ffprobeJson, ensureDir, readJson, writeJson, portable } from "./util.mjs";
import { loadState, saveState } from "./project.mjs";
import { rootDuration } from "./audio.mjs";

/** Parse `blackdetect` / `freezedetect` / `silencedetect` intervals from ffmpeg stderr. */
export function parseIntervals(stderr, kind) {
  const out = [];
  if (kind === "black") {
    for (const m of stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)) out.push({ start: +m[1], end: +m[2], duration: +m[3] });
  } else {
    const starts = [...stderr.matchAll(new RegExp(`${kind}_start: ?([\\d.]+)`, "g"))].map((m) => +m[1]);
    const ends = [...stderr.matchAll(new RegExp(`${kind}_end: ?([\\d.]+)`, "g"))].map((m) => +m[1]);
    starts.forEach((s, i) => out.push({ start: s, end: ends[i] ?? null, duration: ends[i] !== undefined ? +(ends[i] - s).toFixed(3) : null }));
  }
  return out;
}

export function parseLoudness(stderr) {
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const num = (re) => { const m = summary.match(re); return m ? Number(m[1]) : null; };
  return { integratedLUFS: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDBFS: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

function analyze(video, filters, { audio = false } = {}) {
  const args = ["-hide_banner", "-nostats", "-i", video];
  if (audio) args.push("-vn", "-af", filters);
  else args.push("-an", "-vf", filters);
  args.push("-f", "null", "-");
  return run("ffmpeg", args, { timeout: 1800000 }).stderr;
}

function extractFrame(video, t, out, width = 1280) {
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(Math.max(0, t)), "-i", video, "-frames:v", "1", "-vf", `scale=${width}:-2`, out]).ok;
}

/** Timestamps worth looking at: each scene's middle plus both sides of each cut. */
export function sampleTimes(timeline, duration) {
  const mids = [];
  const cuts = [];
  if (timeline?.length) {
    for (const s of timeline) mids.push({ t: +(((s.start + s.end) / 2)).toFixed(2), label: `${s.id}-mid` });
    for (const s of timeline.slice(1)) {
      cuts.push({ t: +Math.max(0, s.start - 0.12).toFixed(2), label: `cut-${s.id}-before` }, { t: +Math.min(duration - 0.05, s.start + 0.15).toFixed(2), label: `cut-${s.id}-after` });
    }
  } else {
    for (let i = 0; i < 8; i++) mids.push({ t: +((duration * (i + 0.5)) / 8).toFixed(2), label: `sample-${i + 1}` });
  }
  mids.push({ t: +Math.max(0, duration - 0.1).toFixed(2), label: "last-frame" });
  return { mids, cuts };
}

export function qcCommand(projectDir, { video } = {}) {
  const state = loadState(projectDir);
  const brief = state.brief;
  const compDir = state.paths.composition;
  const target = video || state.renders?.[state.renders.length - 1]?.output;
  if (!target || !fs.existsSync(target)) throw new Error("No rendered video found. Run `vybe render` first — QC never runs on an unrendered project.");

  state.qc = state.qc || { attempts: 0, maxAttempts: 3, history: [] };
  state.qc.attempts += 1;
  const attempt = state.qc.attempts;
  const dir = ensureDir(path.join(projectDir, "previews", `qc-${String(attempt).padStart(2, "0")}`));
  const failures = [];
  const warnings = [];

  // 1. Container / stream facts.
  const probe = ffprobeJson(target);
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const duration = Number(probe.format.duration);
  const html = fs.readFileSync(path.join(compDir, "index.html"), "utf8");
  const expectedDuration = rootDuration(html) || brief.duration.seconds;
  const [num, den] = String(v?.avg_frame_rate || "0/1").split("/").map(Number);
  const fps = den ? num / den : 0;
  const facts = {
    file: target, sizeMB: +(Number(probe.format.size) / 1e6).toFixed(2), duration: +duration.toFixed(3), expectedDuration,
    width: v?.width, height: v?.height, fps: +fps.toFixed(3), codec: v?.codec_name, pixFmt: v?.pix_fmt,
    audio: a ? { codec: a.codec_name, duration: +Number(a.duration || duration).toFixed(3), channels: a.channels, sampleRate: a.sample_rate } : null,
  };
  if (!v) failures.push("No video stream.");
  if (v && (v.width !== brief.format.width || v.height !== brief.format.height)) failures.push(`Resolution ${v.width}×${v.height} ≠ brief ${brief.format.width}×${brief.format.height}.`);
  if (Math.abs(duration - expectedDuration) > Math.max(0.15, 2 / (fps || 30))) failures.push(`Duration ${duration.toFixed(2)}s ≠ composition ${expectedDuration}s.`);
  if (fps && Math.abs(fps - brief.fps) > 0.05) failures.push(`Frame rate ${fps.toFixed(2)} ≠ requested ${brief.fps}.`);
  if (v && v.pix_fmt !== "yuv420p") warnings.push(`Pixel format ${v.pix_fmt}: some players/platforms expect yuv420p.`);

  const manifestFile = path.join(projectDir, "audio", "audio-manifest.json");
  const audioManifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : null;
  const audioExpected = /<audio\b[^>]*\bsrc=/.test(html);
  if (audioExpected && !a) failures.push("Composition has <audio> tracks but the render has no audio stream.");
  if (a && Math.abs(facts.audio.duration - duration) > 0.25) warnings.push(`Audio stream ${facts.audio.duration}s vs video ${duration.toFixed(2)}s.`);

  // 2. Black and frozen frames.
  const black = parseIntervals(analyze(target, "blackdetect=d=0.2:pic_th=0.98:pix_th=0.03"), "black");
  // Head/tail black is tolerated as a fade, but not when black is most of the film.
  const blackTotal = black.reduce((n, b) => n + b.duration, 0);
  if (duration && blackTotal / duration > 0.5) failures.push(`Video is mostly black (${blackTotal.toFixed(1)}s of ${duration.toFixed(1)}s) — likely a failed WebGL/canvas layer or missing scenes.`);
  // Scenes the storyboard marks "black": true (a cut to black) are intentional.
  const sbBlack = (() => {
    const f = path.join(projectDir, "storyboard.json");
    const sb = fs.existsSync(f) ? readJson(f, null) : null;
    let t = 0;
    return (sb?.scenes || []).flatMap((s) => { const w = { start: t, end: (t += Number(s.duration)) }; return s.black ? [w] : []; });
  })();
  const intended = (b) => sbBlack.some((w) => b.start >= w.start - 0.15 && b.end <= w.end + 0.15);
  for (const b of black.filter((x) => !intended(x))) {
    const atEdge = b.start < 0.6 || b.end > duration - 1.2;
    if (!atEdge && b.duration >= 0.4) failures.push(`Unintended black frames ${b.start.toFixed(2)}–${b.end.toFixed(2)}s (${b.duration.toFixed(2)}s).`);
    else if (b.duration >= 1.0) warnings.push(`Long black ${atEdge ? "head/tail" : "segment"} ${b.start.toFixed(2)}–${b.end.toFixed(2)}s.`);
  }
  const frozen = parseIntervals(analyze(target, "freezedetect=n=0.0008:d=2"), "freeze");
  for (const fz of frozen) {
    const len = fz.duration ?? duration - fz.start;
    if (len >= 3) warnings.push(`Static picture for ${len.toFixed(1)}s from ${fz.start.toFixed(2)}s — intentional hold, or dead air?`);
  }

  // 3. Audio levels.
  let loudness = null;
  let silences = [];
  if (a) {
    loudness = parseLoudness(analyze(target, "ebur128=peak=true", { audio: true }));
    silences = parseIntervals(analyze(target, "silencedetect=n=-50dB:d=1.5", { audio: true }), "silence");
    const I = loudness.integratedLUFS;
    if (I !== null && I > -9) warnings.push(`Integrated loudness ${I} LUFS is very hot (social target ≈ -14).`);
    if (I !== null && I < -28) warnings.push(`Integrated loudness ${I} LUFS is very quiet (social target ≈ -14).`);
    if (loudness.truePeakDBFS !== null && loudness.truePeakDBFS > -0.1) failures.push(`Audio clips: true peak ${loudness.truePeakDBFS} dBFS.`);
    else if (loudness.truePeakDBFS !== null && loudness.truePeakDBFS > -1) warnings.push(`True peak ${loudness.truePeakDBFS} dBFS: finalize will limit to -1 dBTP.`);
    for (const s of silences) {
      const len = s.duration ?? duration - s.start;
      if (audioManifest?.music?.path && len > 2 && s.start > 0.5 && s.start < duration - 2.5) warnings.push(`Silence ${s.start.toFixed(2)}s for ${len.toFixed(1)}s while a music bed should be playing.`);
    }
  }

  // 4. Frames for visual review.
  const sbFile = path.join(projectDir, "storyboard.json");
  let timeline = null;
  if (fs.existsSync(sbFile)) {
    const sb = readJson(sbFile, null);
    let t = 0;
    timeline = sb?.scenes?.map((s) => ({ id: s.id, start: t, end: (t += Number(s.duration)) }));
  }
  const { mids, cuts } = sampleTimes(timeline, duration);
  const frames = [];
  for (const [i, s] of [...mids, ...cuts].entries()) {
    const file = path.join(dir, `${String(i + 1).padStart(2, "0")}-${s.label}-${s.t}s.png`);
    if (extractFrame(target, s.t, file)) frames.push({ ...s, file });
  }
  // Contact sheet of the scene midpoints, one image for a quick overall read.
  const midFiles = frames.filter((f) => !f.label.startsWith("cut-")).map((f) => f.file);
  const sheet = path.join(dir, "contact-sheet.jpg");
  if (midFiles.length > 1) contactSheet(midFiles, sheet);

  const pass = failures.length === 0;
  const exhausted = !pass && attempt >= (state.qc.maxAttempts ?? 3);
  const record = { attempt, at: new Date().toISOString(), pass, failures, warnings, facts, loudness, black, frozen, silences, frames: frames.map((f) => ({ t: f.t, label: f.label, file: f.file })), contactSheet: fs.existsSync(sheet) ? sheet : null };
  writeJson(path.join(dir, "qc.json"), portable(record, state.paths.project));
  state.qc.history.push({ attempt, pass, failures: failures.length, warnings: warnings.length, video: target });
  state.stages.qc = pass ? "technical-pass" : exhausted ? "exhausted" : "fail";
  saveState(projectDir, state);
  appendReport(projectDir, record, state, exhausted);

  const summary = [
    `QC attempt ${attempt}/${state.qc.maxAttempts}: ${pass ? "TECHNICAL PASS" : "FAIL"}`,
    `  ${facts.width}×${facts.height} · ${facts.fps}fps · ${facts.duration}s (expected ${expectedDuration}s) · ${facts.codec} · audio ${facts.audio ? "yes" : "no"}${loudness ? ` · ${loudness.integratedLUFS} LUFS · peak ${loudness.truePeakDBFS} dBFS` : ""}`,
    ...failures.map((f) => `  ✗ ${f}`),
    ...warnings.map((w) => `  ! ${w}`),
    `  Frames for visual review (${frames.length}): ${dir}`,
    exhausted ? "  Fix budget exhausted: stop re-rendering, deliver with the remaining issues listed in quality-report.md." : pass ? "  Next: inspect the frames visually (Stage 8b), then `vybe finalize`." : "  Next: fix the source, re-render, re-run qc.",
  ].join("\n");
  return { pass, exhausted, attempt, failures, warnings, facts, loudness, frames: record.frames, contactSheet: record.contactSheet, dir, summary };
}

/** xstack layout string for a grid: cell offsets as sums of preceding widths/heights. */
export function gridLayout(count, cols) {
  const sum = (prefix, n, step = 1) => (n ? Array.from({ length: n }, (_, k) => `${prefix}${k * step}`).join("+") : "0");
  return Array.from({ length: count }, (_, i) => `${sum("w", i % cols)}_${sum("h", Math.floor(i / cols), cols)}`).join("|");
}

function contactSheet(files, out) {
  const cols = Math.min(4, files.length);
  const scaled = files.map((_, i) => `[${i}:v]scale=480:-2,setsar=1[f${i}]`).join(";");
  const filter = `${scaled};${files.map((_, i) => `[f${i}]`).join("")}xstack=inputs=${files.length}:layout=${gridLayout(files.length, cols)}:fill=black`;
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...files.flatMap((f) => ["-i", f]), "-filter_complex", filter, "-frames:v", "1", "-q:v", "3", out]).ok;
}

function appendReport(projectDir, rec, state, exhausted) {
  const file = path.join(projectDir, "quality-report.md");
  let md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : `# Quality report — ${state.brief.name}\n\nEach render is checked by \`vybe qc\` (deterministic FFmpeg checks) and then visually reviewed by the agent from the extracted frames. Fix budget: ${state.qc.maxAttempts} attempts.\n`;
  const f = rec.facts;
  md += `\n## Attempt ${rec.attempt} — ${rec.pass ? "technical pass" : "fail"}${exhausted ? " (budget exhausted)" : ""}\n\n`;
  md += `- File: \`${path.relative(projectDir, f.file).replace(/\\/g, "/")}\` (${f.sizeMB} MB)\n`;
  md += `- Video: ${f.width}×${f.height}, ${f.fps} fps, ${f.codec}/${f.pixFmt}, ${f.duration}s (composition ${f.expectedDuration}s)\n`;
  md += `- Audio: ${f.audio ? `${f.audio.codec}, ${f.audio.channels}ch, ${f.audio.duration}s` : "none"}${rec.loudness ? `; ${rec.loudness.integratedLUFS} LUFS integrated, ${rec.loudness.truePeakDBFS} dBFS peak, LRA ${rec.loudness.lra}` : ""}\n`;
  md += `- Black segments: ${rec.black.length ? rec.black.map((b) => `${b.start}–${b.end}s`).join(", ") : "none"}\n`;
  md += `- Frozen segments ≥2s: ${rec.frozen.length ? rec.frozen.map((z) => `${z.start}s (${z.duration ?? "to end"}s)`).join(", ") : "none"}\n`;
  if (rec.failures.length) md += `\n**Failures**\n\n${rec.failures.map((x) => `- ${x}`).join("\n")}\n`;
  if (rec.warnings.length) md += `\n**Warnings**\n\n${rec.warnings.map((x) => `- ${x}`).join("\n")}\n`;
  md += `\n**Visual review** (agent fills this in after looking at \`${path.relative(projectDir, path.dirname(rec.frames[0]?.file || projectDir)).replace(/\\/g, "/")}\`)\n\n- Vision used: _yes/no — if no, say so; deterministic checks only_\n- Composition & hierarchy:\n- Typography (overlap, clipping, safe zones):\n- Motion & transitions (cut boundary frames):\n- Audio sync (captions, SFX on hits):\n- Defects found → fixes applied:\n`;
  fs.writeFileSync(file, md);
}
