// End to end with real tools: init → storyboard → audio → check + render → QC → finalize.
// Uses the 7s logo-reveal at draft quality to stay fast. Set VYBE_TEST_VOICE=1 to
// also synthesize narration with local Kokoro and transcribe captions (slower).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, ffprobeJson } from "../../skills/vybe/scripts/lib/util.mjs";

const VYBE = path.resolve("skills/vybe/scripts/vybe.mjs");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "vybe-e2e-"));
const voice = process.env.VYBE_TEST_VOICE === "1";

function vybe(args, timeout = 1800000) {
  const r = run("node", [VYBE, ...args], { timeout });
  return { ...r, json: (() => { try { return JSON.parse(r.stdout); } catch { return null; } })() };
}

test("end-to-end: a real MP4 with music, SFX, QC report and exports", { timeout: 3600000 }, () => {
  const init = vybe(["init", "--", "Animated logo reveal for Nova", "--quality", "draft", "--out", OUT, ...(voice ? ["--voice", "kokoro"] : [])]);
  assert.ok(init.ok, init.stderr);
  const P = init.json.project;

  fs.writeFileSync(path.join(P, "storyboard.json"), JSON.stringify({
    title: "Nova", concept: "Scattered shards find each other and become a star.", thumbnail: 5,
    music: { mood: "futuristic", bpm: 116 },
    scenes: [{
      id: "sting", duration: 7, purpose: "climax", composition: "Mark assembles center, wordmark below",
      text: ["NOVA", "Your tagline here"], background: "Deep violet radial", animation: "Seeded shards converge, shockwave, per-glyph spread",
      camera: "Gentle push", transition: "Hold", music: "Pulse builds to the lock", sfx: [{ name: "whoosh", at: 0.3 }, { name: "impact", at: 1.75 }, { name: "chime", at: 3.1 }],
      narration: voice ? "Nova. Built to shine." : "", narrationOffset: 3.2,
    }],
  }));
  const sb = vybe(["storyboard", "validate", P]);
  assert.ok(sb.ok, JSON.stringify(sb.json));

  const audio = vybe(["audio", P]);
  assert.ok(audio.ok, audio.stderr + audio.stdout);
  assert.equal(audio.json.wiredIntoIndex, true);

  const render = vybe(["render", P]);
  assert.ok(render.ok, render.stdout.slice(-2000) + render.stderr);
  assert.ok(fs.statSync(render.json.render.output).size > 50000);

  const probe = ffprobeJson(render.json.render.output);
  assert.ok(probe.streams.some((s) => s.codec_type === "audio"), "render has an audio stream");
  assert.ok(Math.abs(Number(probe.format.duration) - 7) < 0.2);

  const qc = vybe(["qc", P, "--json"]);
  assert.ok(qc.json.pass, qc.json.summary);
  assert.ok(qc.json.frames.length >= 2);

  const fin = vybe(["finalize", P]);
  assert.ok(fin.ok);
  for (const f of ["final.mp4", "thumbnail.png", "manifest.json"]) assert.ok(fs.existsSync(path.join(P, "exports", f)), f);
  if (voice) assert.ok(fs.existsSync(path.join(P, "exports", "captions.srt")));
  // Source is preserved next to the delivery.
  assert.ok(fs.existsSync(path.join(P, "composition", "compositions", "sting.html")));
});
