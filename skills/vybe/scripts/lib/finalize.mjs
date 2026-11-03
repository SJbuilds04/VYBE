// Delivery: final.mp4 (loudness-normalized, video stream untouched), thumbnail,
// captions.srt, and a manifest. Refuses to deliver a render that does not exist.
import fs from "node:fs";
import path from "node:path";
import { run, ffprobeJson, ensureDir, readJson, writeJson, portable, srtTime } from "./util.mjs";
import { loadState, saveState } from "./project.mjs";

const TARGET_LUFS = -14; // common social/streaming delivery target
const DOCS = ["brief.md", "creative-direction.md", "storyboard.md", "composition-brief.md", "quality-report.md"];

export function captionsToSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
}

function measureLoudness(file) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `loudnorm=I=${TARGET_LUFS}:TP=-1:LRA=11:print_format=json`, "-f", "null", "-"]);
  const m = r.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  return m ? JSON.parse(m[0]) : null;
}

/** Two-pass loudnorm on the audio only; the video stream is copied bit-for-bit. */
function normalizeDelivery(src, dest) {
  const m = measureLoudness(src);
  if (!m) return { normalized: false, reason: "could not measure loudness" };
  const inputI = Number(m.input_i);
  const inputTP = Number(m.input_tp);
  if (Math.abs(inputI - TARGET_LUFS) <= 1 && inputTP <= -1) {
    fs.copyFileSync(src, dest);
    return { normalized: false, reason: `already ${inputI} LUFS / ${inputTP} dBTP`, inputI, inputTP };
  }
  const af = `loudnorm=I=${TARGET_LUFS}:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const r = run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-map", "0", "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", dest], { timeout: 1800000 });
  if (!r.ok) { fs.copyFileSync(src, dest); return { normalized: false, reason: `loudnorm failed: ${r.stderr.trim().slice(-200)}` }; }
  const after = measureLoudness(dest);
  return { normalized: true, inputI, inputTP, outputI: after ? Number(after.input_i) : null, outputTP: after ? Number(after.input_tp) : null };
}

export function finalizeCommand(projectDir, { thumbnailAt } = {}) {
  const state = loadState(projectDir);
  const renders = (state.renders || []).filter((r) => !r.draft && fs.existsSync(r.output));
  const latest = renders[renders.length - 1];
  if (!latest) return { ok: false, error: "No non-draft render exists. Nothing is delivered until `vybe render` succeeds." };
  const lastQc = state.qc?.history?.filter((h) => h.video === latest.output).pop();

  const exports = ensureDir(path.join(projectDir, "exports"));
  const final = path.join(exports, "final.mp4");
  const probe = ffprobeJson(latest.output);
  const hasAudio = probe.streams.some((s) => s.codec_type === "audio");
  const loudness = hasAudio ? normalizeDelivery(latest.output, final) : (fs.copyFileSync(latest.output, final), { normalized: false, reason: "no audio stream" });

  // Thumbnail: explicit time, storyboard `thumbnail` hint, or 62% in (usually past the hook, on a hero frame).
  const duration = Number(probe.format.duration);
  let at = thumbnailAt !== undefined ? Number(thumbnailAt) : null;
  const sbFile = path.join(projectDir, "storyboard.json");
  const sb = fs.existsSync(sbFile) ? readJson(sbFile, null) : null;
  if (at === null && sb?.thumbnail !== undefined) at = Number(sb.thumbnail);
  if (at === null) at = duration * 0.62;
  const thumb = path.join(exports, "thumbnail.png");
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(Math.min(at, duration - 0.05)), "-i", final, "-frames:v", "1", thumb]);

  const capFile = path.join(state.paths.composition, "assets", "captions", "captions.json");
  let captions = null;
  if (fs.existsSync(capFile)) {
    const cues = readJson(capFile);
    fs.writeFileSync(path.join(exports, "captions.srt"), captionsToSrt(cues));
    captions = path.join(exports, "captions.srt");
  }

  const missingDocs = DOCS.filter((d) => !fs.existsSync(path.join(projectDir, d)));
  const manifest = {
    final, thumbnail: fs.existsSync(thumb) ? thumb : null, captions,
    source: { composition: state.paths.composition, render: latest.output },
    video: { width: probe.streams.find((s) => s.codec_type === "video")?.width, height: probe.streams.find((s) => s.codec_type === "video")?.height, duration: +duration.toFixed(3) },
    loudness,
    qc: lastQc ? { attempt: lastQc.attempt, technicalPass: lastQc.pass } : { attempt: null, technicalPass: null, note: "QC was not run on this render" },
    missingDocs,
    finalizedAt: new Date().toISOString(),
  };
  writeJson(path.join(exports, "manifest.json"), portable(manifest, state.paths.project));
  state.stages.deliver = "done";
  saveState(projectDir, state);
  return { ok: true, ...manifest };
}
