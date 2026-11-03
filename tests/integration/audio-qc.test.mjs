// Real FFmpeg work: procedural music + SFX, audio wiring into a project, QC on
// synthetic videos (clean vs. planted black frames), and delivery finalization.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, mediaDuration, writeJson } from "../../skills/vybe/scripts/lib/util.mjs";
import { generateMusic, synthSfx, SYNTH_SFX } from "../../skills/vybe/scripts/lib/music.mjs";
import { parseInvocation } from "../../skills/vybe/scripts/lib/args.mjs";
import { initProject, loadState, saveState } from "../../skills/vybe/scripts/lib/project.mjs";
import { audioCommand } from "../../skills/vybe/scripts/lib/audio.mjs";
import { qcCommand, parseLoudness } from "../../skills/vybe/scripts/lib/qc.mjs";
import { finalizeCommand } from "../../skills/vybe/scripts/lib/finalize.mjs";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "vybe-aq-"));

function loudness(file) {
  return parseLoudness(run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr);
}

test("procedural music: right length, normalized, never clipping", { timeout: 300000 }, () => {
  const out = path.join(TMP, "bed.wav");
  const r = generateMusic({ mood: "energetic", duration: 6, out });
  assert.ok(r.ok, r.error);
  assert.ok(Math.abs(mediaDuration(out) - 6) < 0.15);
  const l = loudness(out);
  assert.ok(Math.abs(l.integratedLUFS + 18) < 1.5, `I=${l.integratedLUFS}`);
  assert.ok(l.truePeakDBFS < 0, `peak ${l.truePeakDBFS}`);
});

test("synthesized SFX: every recipe renders", { timeout: 120000 }, () => {
  for (const n of SYNTH_SFX) assert.ok(synthSfx(n, path.join(TMP, `${n}.wav`)).ok, n);
});

test("audio stage: storyboard → music + SFX wired into index.html (no voice)", { timeout: 600000 }, async () => {
  const { brief } = parseInvocation(["logo sting for Nova", "--out", TMP]);
  const state = initProject(brief, { skipHyperframesInit: true });
  const P = state.paths.project;
  writeJson(path.join(P, "storyboard.json"), {
    title: "Nova", concept: "Shards become a star.", music: { mood: "futuristic" },
    scenes: [{ id: "sting", duration: 7, composition: "c", text: ["NOVA"], background: "b", animation: "a", camera: "push", transition: "hold", music: "m", sfx: [{ name: "whoosh", at: 0.3 }, { name: "impact", at: 1.75 }, { name: "nonexistent-sound-xyz", at: 3 }] }],
  });
  const res = await audioCommand(P, {});
  assert.ok(res.ok);
  assert.equal(res.music.provider, "vybe-procedural");
  assert.equal(res.sfx.cues, 2, "unknown cue skipped, not faked");
  assert.ok(res.anomalies.some((a) => a.includes("nonexistent-sound-xyz")));
  assert.equal(res.wiredIntoIndex, true);
  const html = fs.readFileSync(path.join(state.paths.composition, "index.html"), "utf8");
  assert.match(html, /<audio id="music-bed" [^>]*data-automation=/);
  assert.equal((html.match(/<audio /g) || []).length, 3);
  const manifest = JSON.parse(fs.readFileSync(res.manifest, "utf8"));
  assert.ok(manifest.music.license.includes("Original procedural"));
});

function fakeRenderedProject(name, videoArgs) {
  const { brief } = parseInvocation(["qc fixture", "--out", TMP, "--name", name, "--duration", "4"]);
  const state = initProject(brief, { skipHyperframesInit: true });
  const html = path.join(state.paths.composition, "index.html");
  fs.writeFileSync(html, fs.readFileSync(html, "utf8").replace(/(data-composition-id="main"[^>]*?data-duration=")[\d.]+"/, '$14"'));
  const video = path.join(state.paths.project, "renders", "render-01.mp4");
  fs.mkdirSync(path.dirname(video), { recursive: true });
  const r = run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...videoArgs, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-t", "4", video]);
  assert.ok(r.ok, r.stderr);
  const s = loadState(state.paths.project);
  s.renders = [{ n: 1, output: video, quality: "draft", draft: false }];
  saveState(state.paths.project, s);
  return state.paths.project;
}

test("QC: clean video passes, frames + contact sheet + report are produced", { timeout: 300000 }, () => {
  const P = fakeRenderedProject("qc-clean", ["-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=4"]);
  const res = qcCommand(P);
  assert.equal(res.pass, true, res.summary);
  assert.ok(res.frames.length >= 5);
  assert.ok(fs.existsSync(res.contactSheet));
  assert.match(fs.readFileSync(path.join(P, "quality-report.md"), "utf8"), /Attempt 1 — technical pass/);
});

test("QC: planted black frames and a wrong resolution fail", { timeout: 300000 }, () => {
  const P = fakeRenderedProject("qc-black", ["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=4", "-vf", "drawbox=enable='between(t,1.4,2.4)':x=0:y=0:w=iw:h=ih:color=black:t=fill"]);
  const res = qcCommand(P);
  assert.equal(res.pass, false);
  const all = res.failures.join("\n");
  assert.match(all, /Unintended black frames 1\.[34]/);
  assert.match(all, /Resolution 1280×720/);
});

test("QC budget: attempts are counted and exhausted", { timeout: 300000 }, () => {
  const P = fakeRenderedProject("qc-budget", ["-f", "lavfi", "-i", "color=c=black:s=1920x1080:d=4"]);
  const s = loadState(P);
  s.qc.maxAttempts = 2;
  saveState(P, s);
  assert.equal(qcCommand(P).exhausted, false);
  const second = qcCommand(P);
  assert.equal(second.attempt, 2);
  assert.equal(second.exhausted, true);
  assert.match(second.summary, /budget exhausted/);
});

test("finalize: normalizes audio to -14 LUFS without touching video, writes exports", { timeout: 300000 }, () => {
  const P = fakeRenderedProject("finalize", ["-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=4", "-f", "lavfi", "-i", "sine=f=330:d=4", "-af", "volume=-24dB", "-c:a", "aac", "-shortest"]);
  qcCommand(P);
  const res = finalizeCommand(P);
  assert.ok(res.ok);
  for (const f of ["final.mp4", "thumbnail.png", "manifest.json"]) assert.ok(fs.existsSync(path.join(P, "exports", f)), f);
  assert.equal(res.loudness.normalized, true);
  assert.ok(Math.abs(res.loudness.outputI + 14) < 1.2, `out I=${res.loudness.outputI}`);
  assert.ok(res.missingDocs.includes("creative-direction.md"), "reports missing docs honestly");
});

test("finalize refuses when nothing was rendered", () => {
  const { brief } = parseInvocation(["nothing rendered", "--out", TMP]);
  const state = initProject(brief, { skipHyperframesInit: true });
  const res = finalizeCommand(state.paths.project);
  assert.equal(res.ok, false);
  assert.match(res.error, /No non-draft render/);
});
