// Procedural, license-free audio built with FFmpeg's expression synthesizer.
// It is VYBE's last-resort fallback so a video is never silent because no music
// or SFX provider is configured. It is labeled as procedural in every report.
import path from "node:path";
import { run, ensureDir, mediaDuration } from "./util.mjs";

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chord = [root midi, ...intervals]. Voiced around C3–C5.
const CHORDS = {
  Am: [57, 0, 3, 7, 12], F: [53, 0, 4, 7, 12], C: [48, 0, 4, 7, 12, 16], G: [55, 0, 4, 7, 12],
  E: [52, 0, 4, 7, 12], Dm: [50, 0, 3, 7, 12], Em: [52, 0, 3, 7, 12],
  Cmaj7: [48, 0, 4, 7, 11, 16], Fmaj7: [53, 0, 4, 7, 11], Dmaj7: [50, 0, 4, 7, 11, 16],
  Bm7: [47, 0, 3, 7, 10, 15], Gmaj7: [55, 0, 4, 7, 11], A6: [57, 0, 4, 7, 9],
};

export const MOODS = {
  cinematic: { bpm: 70, prog: ["Am", "F", "C", "G"], beatsPerChord: 8, drums: false, swell: true, bright: 3600 },
  emotional: { bpm: 66, prog: ["Am", "F", "C", "E"], beatsPerChord: 8, drums: false, swell: true, bright: 3200 },
  ambient: { bpm: 80, prog: ["Dmaj7", "Bm7", "Gmaj7", "A6"], beatsPerChord: 8, drums: false, pulse: true, bright: 4200 },
  minimal: { bpm: 96, prog: ["Cmaj7", "Fmaj7"], beatsPerChord: 8, drums: false, pulse: true, bright: 5200 },
  corporate: { bpm: 108, prog: ["C", "G", "Am", "F"], beatsPerChord: 4, drums: "soft", bright: 6000 },
  energetic: { bpm: 122, prog: ["Am", "Am", "F", "G"], beatsPerChord: 4, drums: "full", bright: 7000 },
  futuristic: { bpm: 116, prog: ["Dm", "Dm", "F", "Em"], beatsPerChord: 4, drums: "full", detune: 0.008, bright: 5400 },
};

const MOOD_WORDS = [
  ["cinematic", /cinematic|orchestr|epic|trailer|dramatic|documentar/],
  ["emotional", /emotion|sad|tender|nostalg|heartfelt|melanch/],
  ["futuristic", /futur|cyber|synth|neon|dark electronic|sci-?fi/],
  ["energetic", /energ|hype|upbeat|driving|sport|fast|high-?energy|edm/],
  ["corporate", /corporate|business|uplift|optimis|confident/],
  ["minimal", /minimal|apple|clean|premium|piano/],
  ["ambient", /ambient|calm|tech|science|scientific|curious|space|soft/],
];

export function resolveMood(text) {
  const t = String(text || "").toLowerCase();
  if (MOODS[t]) return t;
  return (MOOD_WORDS.find(([, re]) => re.test(t)) || ["ambient"])[0];
}

const f = (n) => Number(n.toFixed(4));

/** Build the per-channel aevalsrc expression. Exported for tests. */
export function buildExpression({ mood, duration, bpm, channel = 0 }) {
  const m = MOODS[mood];
  const beat = 60 / bpm;
  const chordLen = beat * m.beatsPerChord;
  const xf = Math.min(1.2, chordLen * 0.3); // crossfade between chords
  const detune = (m.detune || 0.0035) * (channel ? -1 : 1);
  const terms = [];
  const nChords = Math.ceil(duration / chordLen) + 1;
  for (let i = 0; i < nChords; i++) {
    const [root, ...iv] = CHORDS[m.prog[i % m.prog.length]];
    const s = i * chordLen;
    const e = s + chordLen;
    const env = `clip((t-${f(s - xf)})/${f(xf)},0,1)*clip((${f(e + xf)}-t)/${f(xf)},0,1)`;
    const voices = iv.map((step, k) => {
      const hz = midiHz(root + step);
      const amp = k === 0 ? 0.16 : 0.1;
      return `${amp}*(sin(2*PI*${f(hz)}*t)+0.6*sin(2*PI*${f(hz * (1 + detune))}*t)+0.18*sin(2*PI*${f(hz * 2)}*t))`;
    });
    const sub = `0.22*sin(2*PI*${f(midiHz(root - 12))}*t)`;
    // FFmpeg's if() is lazy, so only the one or two chords sounding at time t
    // are evaluated. Without the gate every chord is computed on every sample.
    terms.push(`if(between(t,${f(s - xf)},${f(e + xf)}),(${env})*(${voices.join("+")}+${sub}),0)`);
  }
  let expr = `(${terms.join("+")})*(0.86+0.14*sin(2*PI*0.17*t+${channel}))`;
  if (m.swell) expr = `(${expr})*(0.55+0.45*clip(t/${f(duration * 0.7)},0,1))`;
  const bt = `mod(t,${f(beat)})`;
  if (m.pulse) expr += `+0.07*sin(2*PI*${f(midiHz(CHORDS[m.prog[0]][0] + 24))}*t)*exp(-${bt}*9)`;
  if (m.drums) {
    const kickAmp = m.drums === "full" ? 0.55 : 0.32;
    expr += `+${kickAmp}*sin(2*PI*(45+90*exp(-${bt}*28))*${bt})*exp(-${bt}*7)`;
    const half = `mod(t+${f(beat / 2)},${f(beat)})`;
    expr += `+${m.drums === "full" ? 0.06 : 0.035}*(2*random(${channel + 1})-1)*exp(-${half}*45)`;
  }
  return expr;
}

export function generateMusic({ mood = "ambient", duration, out, bpm, seed }) {
  const key = resolveMood(mood);
  const m = MOODS[key];
  const tempo = bpm || m.bpm;
  const d = Math.max(2, Number(duration));
  ensureDir(path.dirname(path.resolve(out)));
  const left = buildExpression({ mood: key, duration: d, bpm: tempo, channel: 0 });
  const right = buildExpression({ mood: key, duration: d, bpm: tempo, channel: 1 });
  const fadeOut = Math.min(3, d * 0.2);
  const filters = [
    `lowpass=f=${m.bright}`,
    "highpass=f=28",
    "aecho=0.8:0.6:70|140:0.22|0.14",
    `afade=t=in:d=${Math.min(1.5, d * 0.15).toFixed(2)}`,
    `afade=t=out:st=${(d - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`,
    "loudnorm=I=-18:TP=-2:LRA=11",
    "aresample=44100",
  ].join(",");
  const r = run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `aevalsrc=exprs='${left}|${right}':s=44100:d=${d}`,
    "-af", filters, "-t", String(d), "-c:a", "pcm_s16le", out,
  ], { timeout: 600000 });
  if (!r.ok) return { ok: false, error: (r.stderr || r.error || "ffmpeg failed").trim().slice(-800) };
  return {
    ok: true, path: out, provider: "vybe-procedural", mood: key, bpm: tempo,
    duration_s: +mediaDuration(out).toFixed(3), seed: seed ?? null,
    license: "Original procedural audio generated locally by VYBE; no third-party content.",
  };
}

// Minimal synthesized SFX set (used only when no SFX library is available).
const SFX_RECIPES = {
  whoosh: { d: 0.9, expr: "(2*random(1)-1)*sin(PI*clip(t/0.9,0,1))^2*0.5", af: "highpass=f=400,lowpass=f=5000" },
  "whoosh-short": { d: 0.45, expr: "(2*random(1)-1)*sin(PI*clip(t/0.45,0,1))^2*0.5", af: "highpass=f=700,lowpass=f=6000" },
  impact: { d: 1.4, expr: "0.9*sin(2*PI*(38+70*exp(-t*14))*t)*exp(-t*3.2)+0.25*(2*random(1)-1)*exp(-t*22)", af: "lowpass=f=2400" },
  riser: { d: 3, expr: "(0.35*(2*random(1)-1)+0.25*sin(2*PI*(180+620*t*t/9)*t))*(t/3)^2", af: "highpass=f=200" },
  click: { d: 0.06, expr: "0.6*sin(2*PI*2200*t)*exp(-t*90)", af: "highpass=f=800" },
  pop: { d: 0.18, expr: "0.7*sin(2*PI*(900-500*t/0.18)*t)*exp(-t*28)", af: "anull" },
  chime: { d: 1.6, expr: "0.3*(sin(2*PI*1318.5*t)+0.6*sin(2*PI*1975.5*t)+0.4*sin(2*PI*2637*t))*exp(-t*2.6)", af: "anull" },
  glitch: { d: 0.35, expr: "0.4*sgn(sin(2*PI*(220+1800*random(2))*t))*(lt(mod(t,0.07),0.04))", af: "lowpass=f=6000" },
  // Pea whistle: bright tone with a fast "trill" wobble, two short blasts.
  whistle: { d: 0.9, expr: "0.35*sin(2*PI*(2900+120*sin(2*PI*38*t))*t)*(lt(t,0.32)+between(t,0.42,0.82))*(0.6+0.4*sin(2*PI*38*t))", af: "highpass=f=1200,lowpass=f=7000" },
  // Ball kick: short leather thump with a soft click transient.
  kick: { d: 0.3, expr: "0.9*sin(2*PI*(95+160*exp(-t*40))*t)*exp(-t*18)+0.2*(2*random(1)-1)*exp(-t*90)", af: "lowpass=f=3000" },
  // Crowd/cheer: band-limited noise swell (voices-like formant band), rises then settles.
  crowd: { d: 3.2, expr: "(2*random(1)-1)*(0.15+0.5*sin(PI*clip(t/3.2,0,1)))*(0.8+0.2*sin(2*PI*5.3*t))", af: "bandpass=f=1100:width_type=o:w=2.2,lowpass=f=4500" },
};

export const SYNTH_SFX = Object.keys(SFX_RECIPES);

export function synthSfx(name, out) {
  const key = SFX_RECIPES[name] ? name : Object.keys(SFX_RECIPES).find((k) => name.toLowerCase().includes(k.split("-")[0]));
  if (!key) return { ok: false, error: `No synth recipe for "${name}". Available: ${SYNTH_SFX.join(", ")}` };
  const { d, expr, af } = SFX_RECIPES[key];
  ensureDir(path.dirname(path.resolve(out)));
  const r = run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `aevalsrc=exprs='${expr}':s=44100:d=${d}`, "-af", `${af},afade=t=out:st=${(d * 0.8).toFixed(3)}:d=${(d * 0.2).toFixed(3)},aformat=channel_layouts=stereo`, out]);
  if (!r.ok) return { ok: false, error: (r.stderr || r.error).trim().slice(-400) };
  return { ok: true, name: key, path: out, duration_s: d, source: "vybe-synth", license: "Original procedural audio generated locally by VYBE." };
}
