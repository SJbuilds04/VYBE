// Unit tests for the series engine (no network, no rendering).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseInvocation } from "../../skills/vybe/scripts/lib/args.mjs";
import { resolveKits, titleLines, parseEpisodeConfig, scriptCaptions, initSeries, addEpisode, buildSeries, loadSeries, hudHtml, ENGINE_DIR, KITS } from "../../skills/vybe/scripts/lib/series.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vybe-series-"));

test("series: kits resolve in load order with dependencies", () => {
  assert.deepEqual(resolveKits(["space"]), ["characters", "space"]);
  assert.deepEqual(resolveKits(["places", "characters"]), ["characters", "places"]);
  assert.throws(() => resolveKits(["dragons"]), /Unknown kit/);
});

test("series: title lines balance long names", () => {
  assert.deepEqual(titleLines("the-last-signal"), ["THE LAST", "SIGNAL"]);
  assert.deepEqual(titleLines("Night Shift"), ["NIGHT SHIFT"]);
});

test("series: episode CONFIG is required and validated", () => {
  assert.equal(parseEpisodeConfig('/*CONFIG {"duration": 10, "titleAt": 7} CONFIG*/ const EP = {};').duration, 10);
  assert.throws(() => parseEpisodeConfig("const EP = {};"), /CONFIG/);
  assert.throws(() => parseEpisodeConfig('/*CONFIG {"duration": 10} CONFIG*/'), /titleAt/);
});

test("series: captions come from the script text, split at sentences, timed to the clip", () => {
  const cues = scriptCaptions({ voice: { lines: [{ text: "Twenty eighty-nine. Humanity has gone silent.", start: 1, duration_s: 3 }] } }, { replace: [["^Twenty eighty-nine\\.", "2089."]] });
  assert.equal(cues[0].text, "2089. Humanity has gone silent.");
  assert.ok(cues[0].start >= 1 && cues.at(-1).end <= 4);
  const long = scriptCaptions({ voice: { lines: [{ text: "Warning. This technology does not belong to humanity.", start: 0, duration_s: 4 }] } });
  assert.ok(long.length >= 2 && long.every((c) => c.text.split(" ").length <= 7));
  for (let i = 1; i < long.length; i++) assert.ok(long[i].start >= long[i - 1].end - 1e-9);
});

test("series: HUD instant entries switch without a type-on", () => {
  const html = hudHtml({ format: "vertical" }, { hud: [{ start: 1, end: 2, text: "00:09", instant: true }, { start: 2, end: 3, text: "ALERT", blink: true }] });
  assert.match(html, /tl\.set\("#hud-0"/);
  assert.doesNotMatch(html, /tl\.fromTo\("#hud-0"/);
  assert.match(html, /immediateRender: false, yoyo: true/);
});

test("series: engine sources and the starter episode parse", () => {
  const src = [path.join(ENGINE_DIR, "core.js"), ...KITS.map((k) => path.join(ENGINE_DIR, "kits", `${k}.js`)), path.join(ENGINE_DIR, "episode-starter.js")]
    .map((f) => fs.readFileSync(f, "utf8").replace(/\{\{\w+\}\}/g, "1")).join("\n");
  assert.doesNotThrow(() => new Function("THREE", "document", src));
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /Math\.random|Date\.now|performance\.now/, "engine must stay deterministic");
});

test("series: init → add → build produces one composition per episode", () => {
  const out = tmp();
  const { brief } = parseInvocation(["a vertical 3d series about a lighthouse keeper"], { cwd: out });
  brief.name = "lighthouse";
  const r = initSeries(brief, { episodes: 2, kits: ["places"], skipHyperframesInit: true });
  assert.deepEqual(r.kits, ["places"]);
  assert.deepEqual(r.episodes.map((e) => e.project), ["../lighthouse-ep01", "../lighthouse-ep02"]);
  assert.ok(fs.existsSync(path.join(r.seriesDir, "engine", "kits", "space.js")), "all kits are copied so the series can opt in later");
  addEpisode(r.seriesDir, { title: "The Storm", skipHyperframesInit: true });
  const series = loadSeries(r.seriesDir);
  assert.equal(series.episodes.length, 3);
  assert.match(fs.readFileSync(path.join(r.seriesDir, "episodes", "ep03.js"), "utf8"), /THE STORM/);
  const built = buildSeries(r.seriesDir, [1, 3]);
  assert.deepEqual(built.built.map((b) => b.episode), [1, 3]);
  const html = fs.readFileSync(path.join(out, "vybe-output", "lighthouse-ep01", "composition", "index.html"), "utf8");
  assert.match(html, /data-width="1080" data-height="1920"/);
  assert.match(html, /function makeCity/);
  assert.doesNotMatch(html, /function makeShip/, "unused kits are not inlined");
  assert.match(fs.readFileSync(path.join(out, "vybe-output", "lighthouse-ep01", "composition", "compositions", "title.html"), "utf8"), /<span>LIGHTHOUSE<\/span>/);
  assert.throws(() => initSeries(brief, { skipHyperframesInit: true }), /already exists/);
});
