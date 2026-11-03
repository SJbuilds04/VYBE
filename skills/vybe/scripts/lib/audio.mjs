// Stage 6 — audio production. Resolves voice, music and SFX through the
// documented HyperFrames tools first and VYBE's local fallbacks last, then
// writes paste-ready <audio> tracks (with ducking) into the composition.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, ensureDir, readJson, writeJson, portable, mediaDuration, credentialPresent, findSkillDir, log } from "./util.mjs";
import { loadState, saveState } from "./project.mjs";
import { generateMusic, synthSfx, resolveMood } from "./music.mjs";

const VOICE_LUFS = -16;
const DUCK_LEVEL = 0.28; // music gain while narration speaks
const KOKORO_VOICES = { cinematic: "am_michael", documentary: "bm_george", explainer: "am_adam", "product-ad": "af_sky", "social-reel": "af_heart", default: "af_heart" };

/** Derive an audio plan from storyboard.json + brief when no explicit plan exists. */
export function planFromStoryboard(sb, brief, state) {
  let t = 0;
  const lines = [];
  const sfx = [];
  for (const s of sb.scenes) {
    if (brief.voice.enabled && s.narration && s.narration.trim()) {
      lines.push({ id: s.id, text: s.narration.trim(), start: +(t + (s.narrationOffset ?? 0.3)).toFixed(3), voiceId: s.voice, fx: s.voiceFx, speed: s.voiceSpeed });
    }
    for (const fx of s.sfx || []) sfx.push({ name: fx.name, at: +(t + (fx.at || 0)).toFixed(3), volume: fx.volume });
    t += Number(s.duration);
  }
  // Scenes may set "musicLevel" (0–1): a hard drop at the scene start, recovery after it.
  const levels = [];
  let acc = 0;
  for (const s of sb.scenes) {
    if (typeof s.musicLevel === "number") levels.push({ start: +acc.toFixed(3), end: +(acc + Number(s.duration)).toFixed(3), level: Math.max(0, Math.min(1, s.musicLevel)) });
    acc += Number(s.duration);
  }
  const mood = (typeof sb.music === "object" && sb.music?.mood) || (typeof sb.music === "string" && sb.music) || brief.style.preset || state.template;
  return {
    duration: +t.toFixed(3),
    voice: brief.voice.enabled ? { provider: brief.voice.provider, voiceId: brief.voice.voiceId, speed: 1, lang: brief.lang, lines } : null,
    music: brief.music.enabled ? { provider: "auto", mood, query: typeof sb.music === "object" ? sb.music.query || sb.music.mood : mood, bpm: sb.music?.bpm, levels } : null,
    sfx: brief.sfx.enabled ? sfx : [],
    captions: brief.captions.enabled,
  };
}

function normalizeLoudness(file, lufs) {
  const tmp = file.replace(/(\.\w+)$/, ".norm$1");
  const r = run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=11,aresample=44100`, "-ar", "44100", tmp]);
  if (r.ok) fs.renameSync(tmp, file);
  return r.ok;
}

// ── transcription ────────────────────────────────────────────────────────────

/** Word timestamps via `hyperframes transcribe` (Parakeet → whisper.cpp). Null when unavailable. */
export function transcribeWords(file, { lang = "en" } = {}) {
  const model = lang === "en" ? "small.en" : "small";
  // transcribe writes transcript.json into its working dir: give it a scratch dir.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vybe-transcribe-"));
  const args = ["--yes", "hyperframes", "transcribe", path.resolve(file), "--model", model, "--json", "--no-runtime-install", "--timeout", "600000", "--dir", scratch];
  if (lang !== "en") args.push("--language", lang);
  const r = run("npx", args, { cwd: scratch, timeout: 900000 });
  try {
    return parseTranscribe(r);
  } finally {
    // Best effort: on Windows the transcriber's child process can still hold a
    // handle for a moment. A leftover temp dir must never fail the run.
    try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* left in os.tmpdir() */ }
  }
}

function parseTranscribe(r) {
  let out;
  try {
    out = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch {
    return { words: null, reason: (r.stderr || r.error || "unparseable transcribe output").trim().split("\n").pop() };
  }
  if (out.ok === false) return { words: null, reason: out.reason || "transcription failed", install: out.install };
  const words = out.words || out.transcript?.words || (Array.isArray(out) ? out : null);
  if (Array.isArray(words) && words.length) return { words: words.map((w, i) => ({ id: w.id || `w${i}`, text: w.text ?? w.word, start: +w.start, end: +w.end })), engine: out.engine || "hyperframes transcribe" };
  // HyperFrames 0.9.x writes the words to transcript.json and prints its path.
  const file2 = out.transcriptPath || out.output || out.path || out.transcript;
  if (typeof file2 === "string" && fs.existsSync(file2)) {
    const data = readJson(file2, null);
    const ws = Array.isArray(data) ? data : data?.words;
    if (Array.isArray(ws)) return { words: ws, engine: out.engine || "hyperframes transcribe" };
  }
  return { words: null, reason: "transcribe returned no words" };
}

// ── voice ───────────────────────────────────────────────────────────────────

// Character treatments applied after synthesis (FFmpeg filter chains).
export const VOICE_FX = {
  // Synthetic ship computer: slight chorus/flange, band-limited, crisp.
  ai: "highpass=f=180,lowpass=f=7000,chorus=0.7:0.9:40:0.4:0.25:2,aecho=0.8:0.5:18:0.3",
  // Distorted transmission: pitched down, phone band, bit-crushed, wavering.
  radio: "asetrate=24000*0.86,aresample=24000,atempo=1.163,highpass=f=380,lowpass=f=2700,acrusher=bits=7:mix=0.45:mode=log,tremolo=f=7:d=0.35,aecho=0.8:0.4:60:0.25,volume=1.6",
  // Child: pitched up, slightly slowed back, with an eerie distant reflection.
  child: "asetrate=24000*1.17,aresample=24000,atempo=0.92,aecho=0.8:0.55:90|170:0.32|0.2,highpass=f=220",
  // Hologram: band-limited, chorused, flickering, with a hall tail.
  hologram: "highpass=f=240,lowpass=f=6200,chorus=0.6:0.85:25|40:0.35|0.25:0.3|0.4:2|1.3,tremolo=f=11:d=0.12,aecho=0.8:0.6:120|240:0.3|0.18",
  // Suit comms: mild band limit and a short room reflection.
  helmet: "highpass=f=160,lowpass=f=5200,aecho=0.8:0.35:12:0.25",
};

function applyVoiceFx(file, fx) {
  const chain = VOICE_FX[fx];
  if (!chain) return false;
  const tmp = file.replace(/(\.\w+)$/, ".fx$1");
  const r = run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-af", chain, tmp]);
  if (r.ok) fs.renameSync(tmp, file);
  return r.ok;
}

function kokoroLine(line, outFile, { voiceId, speed, lang }) {
  const args = ["--yes", "hyperframes", "tts", line.text, "-o", outFile, "--voice", voiceId, "--json"];
  if (speed && speed !== 1) args.push("--speed", String(speed));
  if (lang && lang !== "en") args.push("--lang", lang);
  const r = run("npx", args, { timeout: 600000 });
  if (!r.ok || !fs.existsSync(outFile)) return { ok: false, error: (r.stderr || r.stdout || r.error || "").trim().split("\n").slice(-3).join(" ") };
  return { ok: true };
}

function mediaUseEngine(compDir, request, only, outMeta) {
  const mediaUse = findSkillDir("media-use");
  const engine = mediaUse && path.join(mediaUse, "audio", "scripts", "audio.mjs");
  if (!engine || !fs.existsSync(engine)) return { ok: false, error: "media-use skill not installed (needed for HeyGen/ElevenLabs/Gemini/Lyria). Install: npx skills add heygen-com/hyperframes" };
  const reqFile = path.join(compDir, "audio_request.json");
  writeJson(reqFile, request);
  const r = run("node", [engine, "--request", reqFile, "--hyperframes", compDir, "--out", outMeta, "--only", only], { cwd: compDir, timeout: 1800000 });
  if (!fs.existsSync(outMeta)) return { ok: false, error: (r.stderr || r.error || "engine produced no audio_meta.json").trim().split("\n").slice(-4).join(" ") };
  return { ok: true, meta: readJson(outMeta), engine, log: r.stderr.trim().split("\n").slice(-6) };
}

export function resolveVoiceProvider(requested) {
  if (requested && requested !== "auto") return requested;
  if (credentialPresent("heygen") && findSkillDir("media-use")) return "heygen";
  if (credentialPresent("elevenlabs") && findSkillDir("media-use")) return "elevenlabs";
  return "kokoro";
}

function produceVoice(plan, ctx) {
  const { compDir, state, report } = ctx;
  const provider = resolveVoiceProvider(plan.provider);
  const voiceDir = ensureDir(path.join(compDir, "assets", "audio", "voice"));
  report.voice = { provider, lines: [], anomalies: [] };

  if (provider === "kokoro") {
    const voiceId = plan.voiceId || KOKORO_VOICES[state.template] || KOKORO_VOICES.default;
    report.voice.voiceId = voiceId;
    for (const line of plan.lines) {
      const out = path.join(voiceDir, `${line.id}.wav`);
      const res = kokoroLine(line, out, { voiceId: line.voiceId || voiceId, speed: line.speed || plan.speed, lang: plan.lang });
      if (!res.ok) { report.voice.anomalies.push(`line ${line.id}: Kokoro failed — ${res.error}`); continue; }
      if (line.fx && !applyVoiceFx(out, line.fx)) report.voice.anomalies.push(`line ${line.id}: voice fx "${line.fx}" failed or unknown (${Object.keys(VOICE_FX).join(", ")})`);
      normalizeLoudness(out, VOICE_LUFS);
      report.voice.lines.push({ id: line.id, text: line.text, start: line.start, path: out, duration_s: +mediaDuration(out).toFixed(3), voice: line.voiceId || voiceId, fx: line.fx || null });
    }
  } else {
    if (!credentialPresent(provider)) {
      report.voice.anomalies.push(`Voice provider "${provider}" was requested but no credential is configured. Not falling back silently.`);
      return;
    }
    const meta = path.join(compDir, "audio_meta.json");
    const res = mediaUseEngine(compDir, {
      provider, voice: plan.voiceId || undefined, lang: plan.lang, speed: plan.speed || 1,
      lines: plan.lines.map((l) => ({ id: l.id, text: l.text })), bgm: { mode: "none" },
    }, "tts", meta);
    if (!res.ok) { report.voice.anomalies.push(res.error); return; }
    report.voice.engine = "media-use audio.mjs";
    for (const line of plan.lines) {
      const v = (res.meta.voices || []).find((x) => String(x.id) === String(line.id));
      if (!v) { report.voice.anomalies.push(`line ${line.id}: no audio returned by ${provider}`); continue; }
      const p = path.isAbsolute(v.path) ? v.path : path.join(compDir, v.path);
      normalizeLoudness(p, VOICE_LUFS);
      report.voice.lines.push({ id: line.id, text: line.text, start: line.start, path: p, duration_s: v.duration_s, words: v.words?.length ? v.words : undefined });
    }
  }
}

// ── music ───────────────────────────────────────────────────────────────────

function produceMusic(plan, duration, ctx) {
  const { compDir, report, doctorHints } = ctx;
  const musicDir = ensureDir(path.join(compDir, "assets", "audio", "music"));
  const order = plan.provider && plan.provider !== "auto" ? [plan.provider] : [
    credentialPresent("heygen") && "heygen",
    credentialPresent("gemini") && "lyria",
    doctorHints.musicgen && "musicgen",
    "procedural",
  ].filter(Boolean);
  report.music = { tried: [], anomalies: [] };
  for (const p of order) {
    report.music.tried.push(p);
    if (p === "procedural") {
      const out = path.join(musicDir, "bed.wav");
      const r = generateMusic({ mood: plan.mood, duration: duration + 0.5, out, bpm: plan.bpm });
      if (r.ok) { Object.assign(report.music, { provider: "vybe-procedural", path: out, mood: r.mood, bpm: r.bpm, duration_s: r.duration_s, license: r.license, levels: plan.levels || [] }); return; }
      report.music.anomalies.push(`procedural: ${r.error}`);
      continue;
    }
    // heygen (retrieve) / lyria + musicgen (generate) go through the media-use engine.
    const meta = path.join(compDir, "audio_meta.json");
    const mode = p === "heygen" ? "retrieve" : "generate";
    const res = mediaUseEngine(compDir, { lines: [], bgm: { mode, query: plan.query || plan.mood, prompt: plan.prompt || null } }, "bgm", meta);
    if (!res.ok || !res.meta.bgm) { report.music.anomalies.push(`${p}: ${res.error || "no track returned"}`); continue; }
    if (res.meta.bgm_pending) {
      const wait = path.join(path.dirname(res.engine), "wait-bgm.mjs");
      run("node", [wait, "--audio-meta", meta, "--hyperframes", compDir, "--timeout-ms", "900000"], { cwd: compDir, timeout: 960000 });
    }
    const bgm = readJson(meta).bgm;
    const p2 = bgm?.path && (path.isAbsolute(bgm.path) ? bgm.path : path.join(compDir, bgm.path));
    if (p2 && fs.existsSync(p2)) {
      normalizeLoudness(p2, -18);
      Object.assign(report.music, { provider: res.meta.bgm_provider || p, path: p2, mood: plan.mood, duration_s: +mediaDuration(p2).toFixed(3), license: "See provider terms (HeyGen catalog / generated output)." });
      return;
    }
    report.music.anomalies.push(`${p}: track not ready`);
  }
}

// ── sfx ─────────────────────────────────────────────────────────────────────

const SFX_ALIASES = { impact: "impact-bass-1", "impact-bass": "impact-bass-1", glitch: "glitch-1", "ui click": "click", tap: "click-soft", swoosh: "whoosh", "whoosh-long": "whoosh-cinematic", boom: "impact-bass-2", hit: "impact-bass-1", keyboard: "typing", ding: "chime", shimmer: "sparkle", cheer: "crowd", "crowd-cheer": "crowd", "ball-kick": "kick", "referee-whistle": "whistle" };

function produceSfx(cues, ctx) {
  const { compDir, report } = ctx;
  const sfxDir = ensureDir(path.join(compDir, "assets", "audio", "sfx"));
  const mediaUse = findSkillDir("media-use");
  const libDir = mediaUse && path.join(mediaUse, "audio", "assets", "sfx");
  const manifest = libDir && fs.existsSync(path.join(libDir, "manifest.json")) ? readJson(path.join(libDir, "manifest.json")) : null;
  report.sfx = { cues: [], anomalies: [], credits: new Set() };
  const resolved = new Map();
  for (const [i, cue] of cues.entries()) {
    const want = String(cue.name).toLowerCase().trim();
    let entry = resolved.get(want);
    if (!entry && manifest) {
      const key = manifest[want] ? want : manifest[SFX_ALIASES[want]] ? SFX_ALIASES[want] : Object.keys(manifest).find((k) => want.includes(k) || k.includes(want.split(" ")[0]));
      if (key) {
        const dest = path.join(sfxDir, manifest[key].file);
        fs.copyFileSync(path.join(libDir, manifest[key].file), dest);
        entry = { name: key, path: dest, duration_s: manifest[key].duration, source: "hyperframes-bundled (Pixabay Content License)" };
        report.sfx.credits.add("HyperFrames bundled SFX — Pixabay Content License (media-use/audio/assets/sfx/CREDITS.md)");
      }
    }
    if (!entry) {
      const out = path.join(sfxDir, `${want.replace(/[^a-z0-9]+/g, "-")}.wav`);
      const r = synthSfx(want, out);
      if (r.ok) entry = { name: r.name, path: out, duration_s: r.duration_s, source: "vybe-synth" };
    }
    if (!entry) { report.sfx.anomalies.push(`cue ${i} "${cue.name}": no match in any library; skipped`); continue; }
    resolved.set(want, entry);
    report.sfx.cues.push({ ...entry, at: cue.at, volume: cue.volume ?? 0.4 });
  }
  report.sfx.credits = [...report.sfx.credits];
  if (credentialPresent("heygen")) report.sfx.note = "HeyGen credential present: for effects outside the bundled set, `npx hyperframes media-use resolve --type sfx --intent \"...\"` searches the HeyGen library.";
}

// ── captions ────────────────────────────────────────────────────────────────

/** Group word timings into readable caption cues (≤ maxWords, break on punctuation/pauses). */
export function groupCaptions(words, { maxWords = 6, maxDur = 2.8, gap = 0.45 } = {}) {
  const cues = [];
  let cur = [];
  const flush = () => { if (cur.length) cues.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.text).join(" "), words: cur }); cur = []; };
  for (const w of words) {
    if (cur.length && (w.start - cur[cur.length - 1].end > gap || cur.length >= maxWords || w.end - cur[0].start > maxDur)) flush();
    cur.push(w);
    if (/[.!?;:]$/.test(w.text)) flush();
  }
  flush();
  return cues;
}

function buildCaptions(report, ctx) {
  const all = [];
  let timing = "word-level";
  const reasons = [];
  for (const line of report.voice?.lines || []) {
    let words = line.words;
    if (!words) {
      const tr = transcribeWords(line.path, { lang: ctx.lang });
      words = tr.words;
      if (!words) reasons.push(`${line.id}: ${tr.reason}${tr.install ? ` (install: ${tr.install})` : ""}`);
    }
    if (words) {
      all.push(...words.map((w) => ({ ...w, start: +(w.start + line.start).toFixed(3), end: +(w.end + line.start).toFixed(3) })));
    } else {
      // No transcription available: line-level cues only. Never fake per-word timing.
      timing = "line-level";
      all.push({ text: line.text, start: line.start, end: +(line.start + line.duration_s).toFixed(3), lineLevel: true });
    }
  }
  const cues = timing === "word-level" ? groupCaptions(all) : all.map((w) => (w.lineLevel ? { start: w.start, end: w.end, text: w.text, words: [] } : null)).filter(Boolean);
  if (timing === "line-level") {
    // Mixed case: any line that did have words still gets grouped cues.
    const worded = all.filter((w) => !w.lineLevel);
    if (worded.length) cues.push(...groupCaptions(worded));
    cues.sort((a, b) => a.start - b.start);
  }
  return { timing, cues, reasons };
}

// ── composition wiring ──────────────────────────────────────────────────────

function rel(compDir, p) {
  return path.relative(compDir, p).replace(/\\/g, "/");
}

/** Volume automation for the music bed: fade in/out + duck under each narration line. */
export function musicAutomation(duration, voiceLines, { fadeIn = 1.2, fadeOut = 2.2, duck = DUCK_LEVEL, levels = [] } = {}) {
  const pts = [{ t: 0, v: 0 }, { t: fadeIn, v: 1 }];
  for (const l of voiceLines) {
    const a = Math.max(fadeIn, l.start - 0.25);
    const b = l.start + l.duration_s + 0.35;
    if (b >= duration - fadeOut) { pts.push({ t: +a.toFixed(3), v: 1 }, { t: +(a + 0.25).toFixed(3), v: duck }); continue; }
    pts.push({ t: +a.toFixed(3), v: 1 }, { t: +(a + 0.25).toFixed(3), v: duck }, { t: +b.toFixed(3), v: duck }, { t: +(b + 0.45).toFixed(3), v: 1 });
  }
  const last = pts[pts.length - 1].v;
  pts.push({ t: +(duration - fadeOut).toFixed(3), v: last }, { t: +duration.toFixed(3), v: 0 });
  // Keep points strictly increasing in time.
  const clean = [];
  for (const p of pts) if (!clean.length || p.t > clean[clean.length - 1].t) clean.push(p);
  if (!levels.length) return { version: 1, lanes: [{ target: "volume", points: clean }] };
  // Multiply the envelope by scene levels: 40 ms drop into a scene, 0.3 s recovery after it.
  const baseAt = (t) => {
    if (t <= clean[0].t) return clean[0].v;
    for (let i = 1; i < clean.length; i++) if (t <= clean[i].t) { const a = clean[i - 1], b = clean[i]; return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); }
    return clean[clean.length - 1].v;
  };
  const levelAt = (t) => levels.reduce((m, w) => (t >= w.start && t <= w.end ? Math.min(m, w.level) : m), 1);
  const times = new Set(clean.map((p) => p.t));
  for (const w of levels) for (const t of [w.start - 0.04, w.start, w.end, w.end + 0.3]) if (t > 0 && t < duration) times.add(+t.toFixed(3));
  const points = [...times].sort((a, b) => a - b).map((t) => ({ t, v: +(baseAt(t) * levelAt(t)).toFixed(3) }));
  return { version: 1, lanes: [{ target: "volume", points }] };
}

/** Greedy lane allocation: clips that overlap in time never share a track. */
export function allocateLanes(clips, base) {
  const ends = [];
  return clips.map(({ start, end }) => {
    let lane = ends.findIndex((e) => e <= start + 1e-6);
    if (lane === -1) lane = ends.length;
    ends[lane] = end;
    return base + lane;
  });
}

// Track layout (Studio lanes): music 10, voice 11+, sfx 20+.
export function audioTracksHtml(report, compDir, duration) {
  const out = [];
  const lines = report.voice?.lines || [];
  const voiceLanes = allocateLanes(lines.map((l) => ({ start: l.start, end: l.start + l.duration_s })), 11);
  lines.forEach((l, i) => {
    out.push(`<audio id="vo-${l.id}" src="${rel(compDir, l.path)}" data-start="${l.start}" data-duration="${l.duration_s}" data-track-index="${voiceLanes[i]}" data-volume="1"></audio>`);
  });
  if (report.music?.path) {
    const auto = JSON.stringify(musicAutomation(duration, lines, { levels: report.music.levels || [] }));
    const vol = lines.length ? 0.55 : 0.8;
    out.push(`<audio id="music-bed" src="${rel(compDir, report.music.path)}" data-start="0" data-duration="${duration}" data-track-index="10" data-volume="${vol}" data-automation='${auto}'></audio>`);
  }
  const cues = (report.sfx?.cues || []).filter((c) => c.at < duration).map((c) => ({ ...c, d: +Math.min(c.duration_s, Math.max(0.05, duration - c.at)).toFixed(3) }));
  const sfxLanes = allocateLanes(cues.map((c) => ({ start: c.at, end: c.at + c.d })), 20);
  cues.forEach((c, i) => {
    out.push(`<audio id="sfx-${i + 1}-${c.name}" src="${rel(compDir, c.path)}" data-start="${c.at}" data-duration="${c.d}" data-track-index="${sfxLanes[i]}" data-volume="${c.volume}"></audio>`);
  });
  return out.join("\n      ");
}

function inject(html, marker, content) {
  const re = new RegExp(`(<!-- vybe:${marker}:start -->)[\\s\\S]*?(<!-- vybe:${marker}:end -->)`);
  if (!re.test(html)) return null;
  return html.replace(re, `$1\n      ${content}\n      $2`);
}

export function rootDuration(html) {
  const m = html.match(/data-composition-id="[^"]+"[^>]*?data-duration="([\d.]+)"/) || html.match(/data-duration="([\d.]+)"[^>]*?data-composition-id=/);
  return m ? Number(m[1]) : null;
}

// ── entry point ─────────────────────────────────────────────────────────────

export async function audioCommand(projectDir, { planFile, only } = {}) {
  const state = loadState(projectDir);
  const compDir = state.paths.composition;
  const brief = state.brief;
  let plan;
  if (planFile) plan = readJson(planFile);
  else {
    const sbFile = path.join(projectDir, "storyboard.json");
    if (!fs.existsSync(sbFile)) throw new Error("No storyboard.json and no --plan: write the storyboard first (Stage 3).");
    plan = planFromStoryboard(readJson(sbFile), brief, state);
  }
  const indexFile = path.join(compDir, "index.html");
  const html = fs.readFileSync(indexFile, "utf8");
  const duration = plan.duration || rootDuration(html) || brief.duration.seconds;
  if (plan.duration && rootDuration(html) && Math.abs(rootDuration(html) - plan.duration) > 0.05) log(`note: composition root is ${rootDuration(html)}s but the storyboard totals ${plan.duration}s; audio follows the storyboard — set the root data-duration to match.`);
  const want = (k) => !only || only.includes(k);
  const doctorHints = { musicgen: run("python", ["-c", "import transformers, torch, soundfile"], { timeout: 60000 }).ok };

  const report = { duration, provider_policy: "documented HyperFrames/media-use tools first, VYBE local fallbacks last" };
  const ctx = { compDir, state, report, doctorHints, lang: brief.lang };
  const prev = fs.existsSync(path.join(projectDir, "audio", "audio-manifest.json")) ? readJson(path.join(projectDir, "audio", "audio-manifest.json")) : {};
  // The manifest stores project-relative paths; resolve them for reuse.
  const abs = (p) => (p ? path.resolve(projectDir, p) : p);
  for (const l of prev.voice?.lines || []) l.path = abs(l.path);
  if (prev.music?.path) prev.music.path = abs(prev.music.path);
  for (const c of prev.sfx?.cues || []) c.path = abs(c.path);
  if (prev.captions?.path) prev.captions.path = abs(prev.captions.path);
  if (only) Object.assign(report, { voice: prev.voice, music: prev.music, sfx: prev.sfx, captions: prev.captions });

  if (want("voice") && plan.voice?.lines?.length) produceVoice(plan.voice, ctx);
  if (want("music") && plan.music) produceMusic(plan.music, duration, ctx);
  if (want("sfx") && plan.sfx?.length) produceSfx(plan.sfx, ctx);
  if (want("captions") && plan.captions && report.voice?.lines?.length) {
    const cap = buildCaptions(report, ctx);
    report.captions = { timing: cap.timing, count: cap.cues.length, reasons: cap.reasons };
    writeJson(path.join(compDir, "assets", "captions", "captions.json"), cap.cues);
    report.captions.path = path.join(compDir, "assets", "captions", "captions.json");
  }

  // Wire into the composition when the template exposes markers.
  const tracks = audioTracksHtml(report, compDir, duration);
  // Re-read: generation can take minutes and the composition may have been edited meanwhile.
  let next = inject(fs.readFileSync(indexFile, "utf8"), "audio", tracks || "<!-- no audio -->");
  let wired = Boolean(next);
  if (next && report.captions?.path) {
    const cues = readJson(report.captions.path);
    // Escape "<" so caption text can never close the <script> element it lives in.
    const capHtml = `<script type="application/json" id="vybe-captions">${JSON.stringify(cues).replace(/</g, "\\u003c")}</script>`;
    next = inject(next, "captions", capHtml) || next;
  }
  if (next) fs.writeFileSync(indexFile, next);

  const audioDir = ensureDir(path.join(projectDir, "audio"));
  fs.writeFileSync(path.join(audioDir, "audio-tracks.html"), tracks + "\n");
  const manifest = { ...report, wiredIntoIndex: wired, generatedAt: new Date().toISOString() };
  writeJson(path.join(audioDir, "audio-manifest.json"), portable(manifest, path.resolve(projectDir)));

  state.stages.audio = "done";
  saveState(projectDir, state);
  const anomalies = [...(report.voice?.anomalies || []), ...(report.music?.anomalies || []), ...(report.sfx?.anomalies || [])];
  const voiceFailed = plan.voice?.lines?.length && !(report.voice?.lines?.length);
  if (!wired) log("note: index.html has no <!-- vybe:audio:start/end --> markers; paste audio/audio-tracks.html into the root composition.");
  return {
    ok: !voiceFailed,
    voice: report.voice && { provider: report.voice.provider, lines: report.voice.lines.length },
    music: report.music && { provider: report.music.provider || null, tried: report.music.tried },
    sfx: report.sfx && { cues: report.sfx.cues.length },
    captions: report.captions || null,
    wiredIntoIndex: wired,
    manifest: path.join(audioDir, "audio-manifest.json"),
    anomalies,
  };
}
