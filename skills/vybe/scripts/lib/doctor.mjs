// Environment + capability report. Tells the agent what VYBE can actually do on
// this machine so it never plans around a provider that is not there.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, has, credentialPresent, findSkillDir, SKILL_DIR } from "./util.mjs";

const HYPERFRAMES_SKILLS = ["hyperframes", "hyperframes-core", "hyperframes-cli", "hyperframes-animation", "hyperframes-creative", "media-use", "hyperframes-audio", "hyperframes-registry"];
const VYBE_SPECIALISTS = ["vybe-motion-design", "vybe-cinematic-3d", "vybe-typography", "vybe-audio-design", "vybe-visual-storytelling", "vybe-video-quality", "vybe-image-to-motion"];

function hyperframesDoctor() {
  const r = run("npx", ["--yes", "hyperframes", "doctor", "--json"], { timeout: 180000 });
  try {
    const start = r.stdout.indexOf("{");
    return JSON.parse(r.stdout.slice(start));
  } catch {
    return null;
  }
}

function check(doc, name) {
  return doc?.checks?.find((c) => c.name === name) || null;
}

export function doctor({ quick = false } = {}) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const report = {
    vybe: { skillDir: SKILL_DIR },
    system: {
      node: { ok: nodeMajor >= 22, version: process.versions.node, need: ">=22" },
      ffmpeg: { ok: has("ffmpeg") },
      ffprobe: { ok: has("ffprobe") },
      memoryGB: { total: +(os.totalmem() / 1e9).toFixed(1), free: +(os.freemem() / 1e9).toFixed(1) },
    },
    hyperframes: { ok: false, version: null, checks: {} },
    skills: { hyperframes: {}, vybe: {} },
    credentials: {},
    capabilities: {},
    blockers: [],
    notes: [],
  };

  const v = run("npx", ["--yes", "hyperframes", "--version"], { timeout: 180000 });
  if (v.ok) {
    report.hyperframes.ok = true;
    report.hyperframes.version = v.stdout.trim().split(/\s+/).pop();
  }

  const doc = quick ? null : hyperframesDoctor();
  if (doc) {
    for (const name of ["Chrome", "TTS (Kokoro)", "whisper-cpp", "BGM (MusicGen)", "@google/genai", "Memory"]) {
      const c = check(doc, name);
      if (c) report.hyperframes.checks[name] = { ok: c.ok, detail: c.detail };
    }
  }

  for (const s of HYPERFRAMES_SKILLS) report.skills.hyperframes[s] = Boolean(findSkillDir(s));
  const skillsRoot = path.dirname(SKILL_DIR);
  for (const s of VYBE_SPECIALISTS) {
    report.skills.vybe[s] = fs.existsSync(path.join(skillsRoot, s, "SKILL.md")) || Boolean(findSkillDir(s));
  }

  for (const p of ["heygen", "elevenlabs", "gemini", "runway", "luma", "kling"]) report.credentials[p] = credentialPresent(p);

  const kokoro = doc ? Boolean(check(doc, "TTS (Kokoro)")?.ok) : null;
  const whisper = doc ? Boolean(check(doc, "whisper-cpp")?.ok) : null;
  const musicgen = doc ? Boolean(check(doc, "BGM (MusicGen)")?.ok) : null;
  const c = report.credentials;

  report.capabilities = {
    render: report.hyperframes.ok && report.system.ffmpeg.ok && (doc ? Boolean(check(doc, "Chrome")?.ok) : true),
    voice: [c.heygen && "heygen", c.elevenlabs && "elevenlabs", c.gemini && "gemini", kokoro !== false && "kokoro"].filter(Boolean),
    music: [c.heygen && "heygen-catalog", c.gemini && "lyria", musicgen && "musicgen", report.system.ffmpeg.ok && "vybe-procedural"].filter(Boolean),
    sfx: [c.heygen && "heygen-library", report.skills.hyperframes["media-use"] && "hyperframes-bundled", report.system.ffmpeg.ok && "vybe-synth"].filter(Boolean),
    transcription: [
      "parakeet (installs via `npx hyperframes models install parakeet`)",
      whisper ? "whisper-cpp" : "whisper-cpp (built on first use; needs cmake)",
      c.heygen && "heygen",
    ].filter(Boolean),
    imageToVideo: ["runway", "luma", "gemini", "kling"].filter((p) => c[p]),
    programmaticImageMotion: true,
    vision: "agent-dependent: use the host model's image input on extracted frames; Gemini `snapshot --describe` when GEMINI_API_KEY is set",
  };

  if (!report.system.node.ok) report.blockers.push(`Node ${process.versions.node} is too old; HyperFrames needs Node >= 22.`);
  if (!report.system.ffmpeg.ok || !report.system.ffprobe.ok) report.blockers.push("FFmpeg/FFprobe not on PATH. Install FFmpeg (https://ffmpeg.org/download.html).");
  if (!report.hyperframes.ok) report.blockers.push("HyperFrames CLI unavailable: `npx hyperframes --version` failed (network or npm issue).");
  if (!report.skills.hyperframes["hyperframes-core"]) report.notes.push("HyperFrames agent skills not found. Install with `npx skills add heygen-com/hyperframes` or `npx hyperframes skills update` for the full composition contract.");
  if (report.system.memoryGB.free < 1.5) report.notes.push(`Only ${report.system.memoryGB.free} GB RAM free: render with --workers 1 --low-memory-mode.`);
  if (!c.heygen && !c.elevenlabs) report.notes.push("No cloud voice credentials: narration falls back to local Kokoro (free, on-device).");
  if (!c.heygen && !c.gemini && !musicgen) report.notes.push("No music provider configured: VYBE's procedural ambient bed (FFmpeg synthesis) is the music fallback.");
  report.ok = report.blockers.length === 0;
  return report;
}

export function formatDoctor(r) {
  const yes = (b) => (b ? "✓" : "✗");
  const lines = [
    "VYBE doctor",
    `  ${yes(r.system.node.ok)} Node ${r.system.node.version}`,
    `  ${yes(r.system.ffmpeg.ok)} FFmpeg   ${yes(r.system.ffprobe.ok)} FFprobe`,
    `  ${yes(r.hyperframes.ok)} HyperFrames ${r.hyperframes.version || "(unavailable)"}`,
    `    RAM ${r.system.memoryGB.free}/${r.system.memoryGB.total} GB free`,
    "  HyperFrames skills: " + Object.entries(r.skills.hyperframes).map(([k, v]) => `${yes(v)}${k}`).join(" "),
    "  VYBE specialists:   " + Object.entries(r.skills.vybe).map(([k, v]) => `${yes(v)}${k}`).join(" "),
    "  Credentials (presence only): " + Object.entries(r.credentials).map(([k, v]) => `${yes(v)}${k}`).join(" "),
    `  Voice:  ${r.capabilities.voice.join(" → ") || "none"}`,
    `  Music:  ${r.capabilities.music.join(" → ") || "none"}`,
    `  SFX:    ${r.capabilities.sfx.join(" → ") || "none"}`,
    `  Image-to-video providers: ${r.capabilities.imageToVideo.join(", ") || "none (programmatic image motion only)"}`,
  ];
  for (const b of r.blockers) lines.push(`  BLOCKER: ${b}`);
  for (const n of r.notes) lines.push(`  note: ${n}`);
  lines.push(r.ok ? "  Ready to make videos." : "  Not ready: fix the blockers above.");
  return lines.join("\n");
}
