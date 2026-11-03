// Unit tests for the VYBE engine (no network, no rendering).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseInvocation, projectName, inferTemplate, durationFromText } from "../../skills/vybe/scripts/lib/args.mjs";
import { validateStoryboard, storyboardMarkdown } from "../../skills/vybe/scripts/lib/storyboard.mjs";
import { adaptTemplateHtml, tokenCss, loadStyles, initProject, loadState } from "../../skills/vybe/scripts/lib/project.mjs";
import { groupCaptions, musicAutomation, audioTracksHtml, planFromStoryboard, rootDuration, allocateLanes } from "../../skills/vybe/scripts/lib/audio.mjs";
import { resolveMood, buildExpression } from "../../skills/vybe/scripts/lib/music.mjs";
import { parseIntervals, parseLoudness, gridLayout, sampleTimes } from "../../skills/vybe/scripts/lib/qc.mjs";
import { captionsToSrt } from "../../skills/vybe/scripts/lib/finalize.mjs";
import { srtTime, slugify } from "../../skills/vybe/scripts/lib/util.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vybe-test-"));

// ── invocation ──────────────────────────────────────────────────────────────

test("parse: defaults for a plain prompt", () => {
  const { brief } = parseInvocation("/vybe Create a cinematic 30-second video explaining black holes");
  assert.equal(brief.template, "explainer");
  assert.equal(brief.format.key, "landscape");
  assert.equal(brief.duration.seconds, 30);
  assert.equal(brief.duration.source, "prompt");
  assert.equal(brief.style.preset, "scientific"); // "black holes" is a scientific cue; cinematic loses to the earlier rule
  assert.equal(brief.voice.enabled, false);
  assert.equal(brief.voice.suggested, true);
  assert.equal(brief.music.enabled, true);
  assert.equal(brief.quality.hyperframes, "delivery");
  assert.equal(brief.fps, 30);
});

test("parse: flags combine and override prose", () => {
  const { brief } = parseInvocation(["/vybe", "robotics", "--format", "square", "--duration", "20", "--style", "cyberpunk", "--voice", "kokoro", "--no-music", "--no-sfx", "--review", "--quality", "draft", "--fps", "60"]);
  assert.equal(brief.format.key, "square");
  assert.equal(brief.format.width, 1080);
  assert.equal(brief.duration.seconds, 20);
  assert.equal(brief.style.preset, "cyberpunk");
  assert.deepEqual([brief.voice.enabled, brief.voice.provider], [true, "kokoro"]);
  assert.equal(brief.music.enabled, false);
  assert.equal(brief.sfx.enabled, false);
  assert.equal(brief.review, true);
  assert.equal(brief.quality.hyperframes, "draft");
  assert.equal(brief.fps, 60);
  assert.equal(brief.captions.enabled, true);
});

test("parse: social reels default to vertical; prose formats win", () => {
  assert.equal(parseInvocation("a reel about robotics").brief.format.key, "vertical");
  assert.equal(parseInvocation("demo --template social-reel").brief.format.key, "vertical");
  assert.equal(parseInvocation("an instagram square post about tea").brief.format.key, "square");
  assert.equal(parseInvocation("a product ad --format vertical").brief.format.key, "vertical");
});

test("parse: custom style text is preserved, not forced into a preset", () => {
  const { brief } = parseInvocation(['make a teaser', '--style', '1970s NASA documentary']);
  assert.equal(brief.style.preset, null);
  assert.equal(brief.style.custom, "1970s NASA documentary");
});

test("parse: narration requested in prose turns voice on", () => {
  assert.equal(parseInvocation("an explainer about DNA with narration").brief.voice.enabled, true);
  assert.equal(parseInvocation("an explainer about DNA, no narration").brief.voice.enabled, false);
});

test("parse: MSYS-mangled /vybe token is stripped", () => {
  const { brief } = parseInvocation(["C:/Program Files/Git/vybe", "logo", "reveal", "for", "Nova"]);
  assert.equal(brief.template, "logo-reveal");
  assert.ok(!brief.name.includes("program-files"));
});

test("parse: errors on bad values", () => {
  assert.throws(() => parseInvocation("x --format cinema"), /Unknown --format/);
  assert.throws(() => parseInvocation("x --fps 33"), /Unsupported --fps/);
  assert.throws(() => parseInvocation("x --voice=robot"), /Unknown voice provider/);
  // A bare word after --voice that is not a provider stays part of the prompt.
  assert.equal(parseInvocation("--voice robots explained").brief.prompt, "robots explained");
  assert.throws(() => parseInvocation("x --duration 1000"), /outside/);
  assert.throws(() => parseInvocation("x --image does-not-exist.png"), /Image not found/);
});

test("parse: missing subject produces a warning", () => {
  assert.match(parseInvocation("/vybe --format vertical").warnings.join(" "), /No subject/);
});

test("helpers: names, templates, durations, slugs", () => {
  assert.equal(projectName("Create a cinematic 30-second video explaining black holes"), "cinematic-explaining-black-holes");
  assert.equal(inferTemplate("animated logo reveal"), "logo-reveal");
  assert.equal(inferTemplate("an apple-style advertisement for an iPhone"), "product-ad");
  assert.equal(inferTemplate("a kinetic typography music video"), "kinetic-typography");
  assert.equal(durationFromText("make it 1 minute long"), 60);
  assert.equal(durationFromText("a 45s clip"), 45);
  assert.equal(slugify("  Hello, World!  "), "hello-world");
  assert.equal(srtTime(3723.456), "01:02:03,456");
});

// ── storyboard ──────────────────────────────────────────────────────────────

const scene = (id, d, extra = {}) => ({ id, duration: d, composition: "c", text: ["Hi"], background: "b", animation: `anim ${id}`, camera: "push", transition: "cut", sfx: [], music: "m", ...extra });

test("storyboard: valid board passes and computes timeline", () => {
  const r = validateStoryboard({ title: "T", concept: "C", scenes: [scene("a", 4), scene("b", 6)] }, { expectedDuration: 10 });
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.totalDuration, 10);
  assert.deepEqual(r.timeline[1], { id: "b", start: 4, end: 10 });
});

test("storyboard: catches missing fields, duration drift, narration, sfx range", () => {
  const r = validateStoryboard({ title: "T", concept: "C", scenes: [{ id: "a", duration: 3 }, scene("a", 3, { sfx: [{ name: "pop", at: 9 }] })] }, { expectedDuration: 20, voice: true });
  assert.equal(r.ok, false);
  const all = r.errors.join("\n");
  for (const re of [/missing `composition`/, /duplicate id/, /outside the scene/, /narration/, /brief asks for 20s/]) assert.match(all, re);
});

test("storyboard: craft warnings for fades, reading speed, static camera", () => {
  const fade = (id) => scene(id, 2, { transition: "fade", animation: "fade in", camera: "static", text: ["one two three four five six seven eight nine ten"] });
  const r = validateStoryboard({ title: "T", concept: "C", scenes: [fade("a"), fade("b"), fade("c")] }, {});
  const w = r.warnings.join("\n");
  assert.match(w, /rely on fades/);
  assert.match(w, /same animation/);
  assert.match(w, /No camera movement/);
  assert.match(w, /hard to read/);
});

test("storyboard: markdown lists every scene", () => {
  const md = storyboardMarkdown({ title: "T", concept: "C", scenes: [scene("a", 4), scene("b", 6, { narration: "Hello" })] });
  assert.match(md, /\| 2 \| b \| 4\.0–10\.0s/);
  assert.match(md, /Narration:\*\* “Hello”/);
});

// ── project scaffolding ─────────────────────────────────────────────────────

test("adaptTemplateHtml: rewrites canvas size everywhere and swaps tokens + fonts", () => {
  const html = `<meta name="viewport" content="width=1920, height=1080" /><style>\n      html, body { width: 1920px; height: 1080px; }\n      /* vybe:tokens:start */:root{--vy-bg:#000}/* vybe:tokens:end */</style>
<div id="vybe-root" data-composition-id="main" data-width="1920" data-height="1080"></div><div data-width="1920" data-height="1080"></div><canvas id="c" width="1920" height="1080"></canvas>`;
  const styles = loadStyles();
  const out = adaptTemplateHtml(html, { width: 1080, height: 1920, preset: styles.presets.cyberpunk, styles });
  assert.match(out, /width=1080, height=1920/);
  assert.match(out, /width: 1080px; height: 1920px/);
  assert.equal((out.match(/data-width="1080" data-height="1920"/g) || []).length, 2);
  assert.match(out, /<canvas id="c" width="1080" height="1920">/);
  assert.match(out, /--vy-accent: #00f0ff;/);
  assert.match(out, /--vy-font-display: "Orbitron";/);
  assert.match(out, /@font-face \{ font-family: "Orbitron"; src: url\("assets\/fonts\/Orbitron-Variable.woff2"\)/);
});

test("style presets: every preset defines every token the templates read", () => {
  const keys = ["bg", "bg-2", "ink", "muted", "accent", "accent-2", "glow", "font-display", "font-body", "font-mono", "display-weight", "tracking-display"];
  const styles = loadStyles();
  assert.equal(Object.keys(styles.presets).length, 7);
  for (const [name, p] of Object.entries(styles.presets)) {
    for (const k of keys) assert.ok(p.tokens[k] !== undefined, `${name} missing ${k}`);
    for (const k of ["font-display", "font-body", "font-mono"]) assert.ok(styles.fonts[p.tokens[k]], `${name}: font ${p.tokens[k]} not bundled`);
    assert.match(tokenCss(p), /vybe:tokens:start/);
  }
});

test("initProject: isolated directory with full structure (no network)", () => {
  const out = tmp();
  const { brief } = parseInvocation(["logo reveal for Nova", "--out", out]);
  const a = initProject(brief, { skipHyperframesInit: true });
  const b = initProject(brief, { skipHyperframesInit: true });
  assert.notEqual(a.paths.project, b.paths.project, "second run must not overwrite the first");
  for (const p of ["vybe.json", "brief.md", "previews", "exports", "sources", "composition/index.html", "composition/compositions/sting.html", "composition/assets/fonts/Inter-Variable.woff2"]) {
    assert.ok(fs.existsSync(path.join(a.paths.project, p)), `missing ${p}`);
  }
  assert.equal(a.template, "logo-reveal");
  assert.equal(JSON.parse(fs.readFileSync(path.join(a.paths.project, "vybe.json"))).qc.maxAttempts, 3);
});

// ── audio ───────────────────────────────────────────────────────────────────

test("captions: grouping breaks on punctuation, pauses and length", () => {
  const w = (text, start, end) => ({ text, start, end });
  const cues = groupCaptions([w("Every", 0, 0.4), w("story", 0.4, 0.8), w("begins.", 0.8, 1.2), w("Then", 2.0, 2.2), w("light", 2.2, 2.5)]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "Every story begins.");
  assert.equal(cues[1].start, 2.0);
});

test("music automation: fades, ducks under every line, strictly increasing", () => {
  const auto = musicAutomation(20, [{ start: 3, duration_s: 2 }, { start: 9, duration_s: 3 }]);
  const pts = auto.lanes[0].points;
  assert.equal(auto.lanes[0].target, "volume");
  assert.deepEqual(pts[0], { t: 0, v: 0 });
  assert.deepEqual(pts[pts.length - 1], { t: 20, v: 0 });
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].t > pts[i - 1].t, "points must increase");
  assert.ok(pts.some((p) => p.t >= 3 && p.t <= 5 && p.v < 0.5), "ducked during line 1");
  assert.ok(pts.some((p) => p.t >= 9 && p.t <= 12 && p.v < 0.5), "ducked during line 2");
});

test("audio tracks: every <audio> has an id and stays inside the film", () => {
  const html = audioTracksHtml({
    voice: { lines: [{ id: "s1", start: 0.3, duration_s: 2, path: "/p/c/assets/audio/voice/s1.wav" }] },
    music: { path: "/p/c/assets/audio/music/bed.wav" },
    sfx: { cues: [{ name: "pop", at: 1, duration_s: 0.2, volume: 0.4, path: "/p/c/assets/audio/sfx/pop.mp3" }, { name: "late", at: 30, duration_s: 1, volume: 0.4, path: "/p/c/x.mp3" }] },
  }, "/p/c", 10);
  const tags = html.match(/<audio [^>]*>/g);
  assert.equal(tags.length, 3, "cue after the end is dropped");
  for (const t of tags) assert.match(t, /\sid="[^"]+"/);
  assert.match(html, /src="assets\/audio\/voice\/s1.wav"/);
  assert.match(html, /data-automation='\{"version":1/);
});

test("audio plan derives absolute times from the storyboard", () => {
  const sb = { music: { mood: "cinematic" }, scenes: [scene("a", 4, { narration: "Hi there.", sfx: [{ name: "whoosh", at: 3.5 }] }), scene("b", 5, { narration: "Bye.", narrationOffset: 0.5, sfx: [{ name: "impact", at: 0 }] })] };
  const plan = planFromStoryboard(sb, parseInvocation("x --voice").brief, { template: "cinematic" });
  assert.deepEqual(plan.voice.lines.map((l) => l.start), [0.3, 4.5]);
  assert.deepEqual(plan.sfx.map((s) => s.at), [3.5, 4]);
  assert.equal(plan.music.mood, "cinematic");
  assert.equal(plan.duration, 9);
});

test("lane allocation keeps overlapping clips on separate tracks", () => {
  assert.deepEqual(allocateLanes([{ start: 0, end: 5 }, { start: 1, end: 2 }, { start: 2.5, end: 3 }, { start: 6, end: 7 }], 20), [20, 21, 21, 20]);
});

test("rootDuration reads the root data-duration", () => {
  assert.equal(rootDuration('<div id="vybe-root" data-composition-id="main" data-start="0" data-duration="12.5" data-width="1">'), 12.5);
});

test("procedural music: mood resolution and lazily gated chords", () => {
  assert.equal(resolveMood("dark synthwave"), "futuristic");
  assert.equal(resolveMood("calm science"), "ambient");
  assert.equal(resolveMood("something else"), "ambient");
  const expr = buildExpression({ mood: "energetic", duration: 10, bpm: 122 });
  assert.match(expr, /if\(between\(t,/);
  assert.match(expr, /random\(1\)/, "energetic has hats");
  assert.doesNotMatch(buildExpression({ mood: "cinematic", duration: 10, bpm: 70 }), /random/);
});

// ── qc / finalize ───────────────────────────────────────────────────────────

test("qc parsers: black/freeze/silence intervals and loudness summary", () => {
  const black = parseIntervals("[blackdetect @ 0x1] black_start:2.5 black_end:3.1 black_duration:0.6", "black");
  assert.deepEqual(black, [{ start: 2.5, end: 3.1, duration: 0.6 }]);
  const fr = parseIntervals("lavfi.freezedetect.freeze_start: 4\nlavfi.freezedetect.freeze_end: 7.5", "freeze");
  assert.deepEqual(fr, [{ start: 4, end: 7.5, duration: 3.5 }]);
  const sil = parseIntervals("silence_start: 9.2", "silence");
  assert.equal(sil[0].end, null);
  const loud = parseLoudness("…\nSummary:\n\n  Integrated loudness:\n    I:         -14.2 LUFS\n  Loudness range:\n    LRA:         6.1 LU\n  True peak:\n    Peak:        -1.3 dBFS");
  assert.deepEqual(loud, { integratedLUFS: -14.2, lra: 6.1, truePeakDBFS: -1.3 });
});

test("qc frame sampling covers midpoints, both sides of cuts and the end", () => {
  const { mids, cuts } = sampleTimes([{ id: "a", start: 0, end: 4 }, { id: "b", start: 4, end: 10 }], 10);
  assert.deepEqual(mids.map((m) => m.t), [2, 7, 9.9]);
  assert.deepEqual(cuts.map((c) => c.t), [3.88, 4.15]);
  assert.equal(gridLayout(5, 4), "0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0");
});

test("captions.srt formatting", () => {
  assert.equal(captionsToSrt([{ start: 0.3, end: 1.75, text: "Hello there." }]), "1\n00:00:00,300 --> 00:00:01,750\nHello there.\n");
});

// ── security regressions ────────────────────────────────────────────────────
import { portable, shellFree } from "../../skills/vybe/scripts/lib/util.mjs";

test("portable(): absolute paths become project-relative, URLs and text untouched", () => {
  const base = path.resolve("/tmp/proj");
  const out = portable({ a: path.join(base, "renders", "r.mp4"), u: "https://cdn.example/x.js", t: "plain text", n: 3, arr: [path.join(base, "x.png")] }, base);
  assert.deepEqual(out, { a: "renders/r.mp4", u: "https://cdn.example/x.js", t: "plain text", n: 3, arr: ["x.png"] });
});

test("shellFree(): npx never goes through cmd.exe on Windows", () => {
  const [file, args] = shellFree("npx", ["hyperframes", "tts", 'say "hi" & calc %PATH%']);
  if (process.platform === "win32") {
    assert.equal(file, process.execPath, "spawned with node directly");
    assert.match(args[0], /npx-cli\.js$/);
    assert.equal(args[3], 'say "hi" & calc %PATH%', "argument passed through verbatim, unparsed");
  } else {
    assert.equal(file, "npx");
  }
});

test("state on disk never stores absolute paths; loadState restores them", () => {
  const out = tmp();
  const { brief } = parseInvocation(["portable state test", "--out", out]);
  const s = initProject(brief, { skipHyperframesInit: true });
  const raw = fs.readFileSync(path.join(s.paths.project, "vybe.json"), "utf8");
  assert.ok(!raw.includes(JSON.stringify(out).slice(1, -1)) && !raw.includes(out), "no absolute output dir in vybe.json");
  assert.equal(path.isAbsolute(loadState(s.paths.project).paths.composition), true);
});

// ── multi-character films ───────────────────────────────────────────────────
test("screenplay dialogue turns voice on; per-line voice, fx, speed reach the plan", () => {
  assert.equal(parseInvocation("SHIP AI: Warning. Unknown signal detected.").brief.voice.enabled, true);
  const sb = { scenes: [scene("a", 4, { narration: "Hello.", voice: "am_adam", voiceFx: "radio", voiceSpeed: 0.8 })] };
  const line = planFromStoryboard(sb, parseInvocation("x --voice").brief, { template: "cinematic" }).voice.lines[0];
  assert.deepEqual([line.voiceId, line.fx, line.speed], ["am_adam", "radio", 0.8]);
});

test("musicLevel scenes shape the bed: silence inside, recovery after", () => {
  const sb = { scenes: [scene("a", 10), scene("b", 2, { musicLevel: 0, black: true }), scene("c", 8)] };
  const levels = planFromStoryboard(sb, parseInvocation("x").brief, { template: "cinematic" }).music.levels;
  assert.deepEqual(levels, [{ start: 10, end: 12, level: 0 }]);
  const pts = musicAutomation(20, [], { levels }).lanes[0].points;
  const at = (t) => pts.find((p) => p.t === t)?.v;
  assert.equal(at(10), 0);
  assert.equal(at(12), 0);
  assert.ok(at(9.96) > 0.9, "full level just before the cut");
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].t > pts[i - 1].t);
});
