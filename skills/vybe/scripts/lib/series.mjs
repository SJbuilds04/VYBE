// Series engine: many episodes, one shared 3D world.
//
// A series folder owns a copy of the engine (core + kits) that every episode inlines, so
// characters, sets, look and title card stay identical across episodes and can be extended
// once for all of them:
//   <series>/series.json        name, title, format, kits, palette, episodes → project dirs
//   <series>/engine/core.js     renderer, stars, stage, paths, shake, hologram, screen helpers
//   <series>/engine/kits/*.js   optional building blocks (characters, space, places)
//   <series>/episodes/epNN.js   one file per episode: CONFIG header + EP.init / EP.frame
// `buildSeries` compiles each episode into its own VYBE project's composition/, keeping the
// audio wired by `vybe audio` and rebuilding captions from the script text.
import fs from "node:fs";
import path from "node:path";
import { FORMATS } from "./args.mjs";
import { initProject } from "./project.mjs";
import { SKILL_DIR, ensureDir, readJson, writeJson, slugify } from "./util.mjs";

export const ENGINE_DIR = path.join(SKILL_DIR, "assets", "series-engine");
export const KITS = ["characters", "space", "places"];
const KIT_DEPS = { space: ["characters"] };
const SERIES_FILE = "series.json";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pad = (n) => String(n).padStart(2, "0");

/** Kits in load order, with dependencies added. */
export function resolveKits(kits = []) {
  const want = new Set();
  for (const k of kits) {
    if (!KITS.includes(k)) throw new Error(`Unknown kit "${k}" (available: ${KITS.join(", ")}).`);
    want.add(k);
    for (const d of KIT_DEPS[k] || []) want.add(d);
  }
  return KITS.filter((k) => want.has(k));
}

/** Split a series name into 1–2 balanced title lines: "the last signal" → ["THE LAST", "SIGNAL"]. */
export function titleLines(name) {
  const words = String(name).replace(/[-_]+/g, " ").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length < 3) return [words.join(" ")];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

export function parseEpisodeConfig(src) {
  const m = src.match(/\/\*CONFIG([\s\S]*?)CONFIG\*\//);
  if (!m) throw new Error("Episode file has no /*CONFIG {...} CONFIG*/ header.");
  const cfg = JSON.parse(m[1]);
  for (const k of ["duration", "titleAt"]) if (typeof cfg[k] !== "number") throw new Error(`Episode CONFIG needs a numeric "${k}".`);
  return cfg;
}

export function loadSeries(seriesDir) {
  const file = path.join(seriesDir, SERIES_FILE);
  if (!fs.existsSync(file)) throw new Error(`No ${SERIES_FILE} in ${seriesDir}. Create one with "vybe series init".`);
  return readJson(file);
}

/** Engine source inlined into each episode: core first, then kits in dependency order. */
export function engineSource(seriesDir, series) {
  const parts = [fs.readFileSync(path.join(seriesDir, "engine", "core.js"), "utf8")];
  for (const k of resolveKits(series.kits)) parts.push(fs.readFileSync(path.join(seriesDir, "engine", "kits", `${k}.js`), "utf8"));
  return parts.join("\n");
}

/** Captions from the script (not the transcript), timed to each voice clip: ≤6 words per cue, split at sentence ends. */
export function scriptCaptions(manifest, { replace = [] } = {}) {
  const cues = [];
  for (const l of manifest?.voice?.lines || []) {
    let text = l.text;
    for (const [pattern, to] of replace) text = text.replace(new RegExp(pattern), to);
    const chunks = [];
    let cur = [];
    for (const w of text.split(/\s+/).filter(Boolean)) {
      cur.push(w);
      if (cur.length >= 6 || (/[.!?]$/.test(w) && cur.length >= 2)) { chunks.push(cur); cur = []; }
    }
    if (cur.length) { if (cur.length < 2 && chunks.length) chunks[chunks.length - 1].push(...cur); else chunks.push(cur); }
    const total = chunks.reduce((a, c) => a + c.join(" ").length, 0), t0 = l.start + 0.05, span = Math.max(0.6, l.duration_s - 0.1);
    let acc = 0;
    for (const c of chunks) {
      const a = t0 + (acc / total) * span;
      acc += c.join(" ").length;
      cues.push({ start: +a.toFixed(2), end: +(t0 + (acc / total) * span).toFixed(2), text: c.join(" ") });
    }
  }
  return cues;
}

function block(html, marker) {
  const m = html.match(new RegExp(`<!-- vybe:${marker}:start -->[\\s\\S]*?<!-- vybe:${marker}:end -->`));
  return m ? m[0] : `<!-- vybe:${marker}:start --><!-- vybe:${marker}:end -->`;
}

function captionsBlock(cues) {
  const json = JSON.stringify(cues).replace(/</g, "\\u003c");
  return `<!-- vybe:captions:start -->\n      <script type="application/json" id="vybe-captions">${json}</script>\n      <!-- vybe:captions:end -->`;
}

function palette(series) {
  return { bg: "#02040a", ink: "#e6eef6", accent: "#39d0ff", danger: "#ff3b3b", ...(series.palette || {}) };
}

export function hostHtml(series, cfg, { world, script, audio, captions }) {
  const { width, height } = FORMATS[series.format];
  const p = palette(series);
  const blackTweens = (cfg.black || []).map(([a, b, op = 1]) => `tl.to("#blackout", { opacity: ${op}, duration: 0.02, ease: "none" }, ${a}); tl.to("#blackout", { opacity: ${b === cfg.titleAt ? 0.7 : 0}, duration: 0.6, ease: "power1.out" }, ${b});`).join("\n      ");
  const dimForTitle = (cfg.black || []).some(([, b]) => b === cfg.titleAt) ? "" : `tl.to("#blackout", { opacity: 0.7, duration: 0.02, ease: "none" }, ${cfg.titleAt});`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${esc(series.name)} — Ep. ${pad(cfg.n)} — VYBE</title>
    <!-- Generated by "vybe series build" from the series engine + episodes/ep${pad(cfg.n)}.js. Edit those, then rebuild. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Orbitron"; src: url("assets/fonts/Orbitron-Variable.woff2") format("woff2"); font-weight: 400 900; }
      @font-face { font-family: "JetBrains Mono"; src: url("assets/fonts/JetBrainsMono-Variable.woff2") format("woff2"); font-weight: 100 800; }
      @font-face { font-family: "Inter"; src: url("assets/fonts/Inter-Variable.woff2") format("woff2"); font-weight: 100 900; }
      /* vybe:tokens:start */
      :root { --vy-bg: ${p.bg}; --vy-ink: ${p.ink}; --vy-accent: ${p.accent}; --vy-accent-2: ${p.danger}; --vy-font-display: "Orbitron"; --vy-font-body: "Inter"; --vy-font-mono: "JetBrains Mono"; }
      /* vybe:tokens:end */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
      #vybe-root { position: relative; width: 100%; height: 100%; overflow: hidden; container-type: size; background: #000; color: var(--vy-ink); font-family: var(--vy-font-body), sans-serif; }
      #world { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .slot { position: absolute; inset: 0; }
      #vignette { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 14%, transparent 72%, rgba(0,0,0,0.65) 100%); }
      #blackout { position: absolute; inset: 0; background: #000; opacity: 0; z-index: 6; pointer-events: none; }
      #captions { position: absolute; left: 9cqw; right: 9cqw; bottom: ${height > width ? 25 : 10}cqh; z-index: 25; display: flex; justify-content: center; pointer-events: none; }
      .cap { position: absolute; bottom: 0; max-width: 100%; text-align: center; font-weight: 600; font-size: 4.2cqmin; line-height: 1.3; color: #f2f5f8; opacity: 0; background: rgba(0,0,0,0.42); padding: 0.6cqmin 1.8cqmin; border-radius: 1.2cqmin; text-shadow: 0 0.3cqmin 1.2cqmin rgba(0,0,0,0.95), 0 0 0.5cqmin rgba(0,0,0,0.9); }
      .cap .cw { display: inline-block; margin: 0 0.12em; }
    </style>
  </head>
  <body>
    <div id="vybe-root" data-composition-id="main" data-start="0" data-duration="${cfg.duration}" data-width="${width}" data-height="${height}">
      <canvas id="world" width="${width}" height="${height}" data-layout-allow-overflow></canvas>
      <div id="vignette"></div>
      <div id="blackout"></div>
      <div id="hud" class="slot" data-composition-id="hud" data-composition-src="compositions/hud.html" data-start="0" data-duration="${cfg.duration}" data-track-index="2" data-width="${width}" data-height="${height}"></div>
      <div id="title" class="slot" data-composition-id="title" data-composition-src="compositions/title.html" data-start="${cfg.titleAt}" data-duration="${+(cfg.duration - cfg.titleAt).toFixed(3)}" data-track-index="3" data-width="${width}" data-height="${height}"></div>
      <div id="captions" aria-hidden="true"></div>
      ${captions}
      ${audio}
    </div>

    <script type="module">
      import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.2/+esm";
${world}
${script}
      // ── host: build the world, render frames from HyperFrames time ──
      const rootEl = document.getElementById("vybe-root");
      const W = createWorld(document.getElementById("world"), Number(rootEl.dataset.width), Number(rootEl.dataset.height), EP.fov || 60);
      const rand = mulberry32(EP.seed || 1);
      const stars = makeStars(W.scene, rand);
      const S = EP.init(W, rand);
      function renderAt(t) {
        const f = EP.frame(t, W, S);
        for (const [k, g] of Object.entries(S.sets)) g.visible = f.sets.includes(k);
        stars.visible = f.sets.includes("stars");
        W.scene.fog = f.fog || null;
        W.camera.fov = f.fov || EP.fov || 60; W.camera.updateProjectionMatrix();
        W.camera.position.copy(f.pos); W.camera.lookAt(f.look);
        if (f.roll) W.camera.rotateZ(f.roll);
        stars.position.copy(f.pos);
        W.renderer.render(W.scene, W.camera);
      }
      window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
      renderAt(window.__hfThreeTime || 0);
    </script>

    <script>
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#blackout", { opacity: 1 }, { opacity: 0, duration: 1.0, ease: "power1.out", immediateRender: true }, 0);
      ${blackTweens}
      ${dimForTitle}
      const capData = document.getElementById("vybe-captions");
      if (capData) {
        const host = document.getElementById("captions");
        const cues = JSON.parse(capData.textContent);
        cues.forEach((cue, i) => {
          const el = document.createElement("div");
          el.className = "cap"; el.id = \`cap-\${i}\`;
          const words = cue.words && cue.words.length ? cue.words : [{ text: cue.text }];
          el.innerHTML = words.map((w) => \`<span class="cw">\${w.text.replace(/</g, "&lt;")}</span>\`).join(" ");
          host.appendChild(el);
          tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out" }, cue.start);
          const next = cues[i + 1] ? cues[i + 1].start : Infinity;
          tl.to(el, { opacity: 0, duration: 0.1 }, Math.min(cue.end + 0.25, next - 0.1));
        });
      }
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

export function hudHtml(series, cfg) {
  const { width, height } = FORMATS[series.format];
  const p = palette(series);
  const items = (cfg.hud || []).map((h, i) => `<div class="hud-item hud-${h.color || "cy"} hud-${h.pos || "top"}${h.big ? " hud-big" : ""}" id="hud-${i}">${esc(h.text)}</div>`).join("\n        ");
  const tweens = (cfg.hud || []).map((h, i) => {
    const s = `#hud-${i}`;
    const enter = h.instant
      ? `tl.set("${s}", { opacity: 1, clipPath: "inset(0 0% 0 0)" }, ${h.start});`
      : `tl.fromTo("${s}", { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "steps(${Math.max(6, Math.min(24, h.text.length))})" }, ${h.start});`;
    const blink = h.blink ? `\n        tl.fromTo("${s}", { opacity: 1 }, { opacity: 0.25, duration: 0.18, immediateRender: false, yoyo: true, repeat: ${Math.max(1, Math.floor((h.end - h.start - 0.6) / 0.36) * 2 - 1)}, ease: "steps(1)" }, ${h.start + 0.55});` : "";
    return `${enter}${blink}\n        tl.to("${s}", { opacity: 0, duration: ${h.instant ? 0.01 : 0.25}, ease: "power1.in" }, ${h.end});`;
  }).join("\n        ");
  return `<!doctype html>
<html><head><meta charset="UTF-8" /></head><body>
  <template>
    <style>
      #hud-root { position: absolute; inset: 0; pointer-events: none; }
      .hud-item { position: absolute; left: 8cqw; right: 8cqw; text-align: center; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 4.2cqmin; letter-spacing: 0.12em; line-height: 1.35; opacity: 0; padding: 1.4cqmin 2cqmin; border: 0.3cqmin solid currentColor; background: rgba(2,6,10,0.55); }
      .hud-cy { color: ${p.accent}; } .hud-red { color: ${p.danger}; } .hud-white { color: ${p.ink}; }
      .hud-top { top: 15cqh; } .hud-center { top: 44cqh; } .hud-upper { top: 30cqh; }
      .hud-big { font-size: 12cqmin; border: none; background: none; letter-spacing: 0.3em; }
    </style>
    <div id="hud-root" data-composition-id="hud" data-width="${width}" data-height="${height}">
        ${items}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
        ${tweens}
      window.__timelines["hud"] = tl;
    </script>
  </template>
</body></html>
`;
}

export function titleHtml(series, cfg) {
  const { width, height } = FORMATS[series.format];
  const p = palette(series);
  const main = (series.title || titleLines(series.name)).map((l) => `<span>${esc(l)}</span>`).join("");
  const lines = (cfg.titleLines || []).map((l, i) => `<div class="t-sub" id="t-sub-${i}">${esc(l)}</div>`).join("\n        ");
  const subTweens = (cfg.titleLines || []).map((l, i) => `tl.fromTo("#t-sub-${i}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "steps(${Math.min(30, Math.max(1, l.length))})" }, ${1.0 + i * 1.3});`).join("\n        ");
  return `<!doctype html>
<html><head><meta charset="UTF-8" /></head><body>
  <template>
    <style>
      #t-root { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3cqmin; pointer-events: none; z-index: 10; }
      #t-wrap { position: relative; text-align: center; }
      .t-main { font-family: "Orbitron", sans-serif; font-weight: 800; font-size: 13cqmin; line-height: 1.08; letter-spacing: 0.16em; color: ${p.ink}; }
      .t-main span { display: block; }
      #t-r, #t-c { position: absolute; left: 0; right: 0; top: 0; mix-blend-mode: screen; }
      #t-r { color: ${p.danger}; } #t-c { color: ${p.accent}; }
      #t-rule { width: 46cqmin; height: 0.35cqmin; background: ${p.accent}; }
      .t-sub { font-family: "JetBrains Mono", monospace; font-weight: 600; font-size: 3.4cqmin; letter-spacing: 0.22em; color: #9fb4c8; text-align: center; }
    </style>
    <div id="t-root" data-composition-id="title" data-width="${width}" data-height="${height}">
      <div id="t-wrap">
        <div class="t-main" id="t-main">${main}</div>
        <div class="t-main" id="t-r" data-layout-ignore>${main}</div>
        <div class="t-main" id="t-c" data-layout-ignore>${main}</div>
      </div>
      <div id="t-rule"></div>
        ${lines}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#t-main", { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.5, ease: "expo.out" }, 0.1);
      tl.fromTo("#t-r", { opacity: 0.9, x: -18 }, { opacity: 0, x: 0, duration: 0.7, ease: "steps(7)" }, 0.1);
      tl.fromTo("#t-c", { opacity: 0.9, x: 18 }, { opacity: 0, x: 0, duration: 0.7, ease: "steps(7)" }, 0.1);
      tl.fromTo("#t-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.inOut" }, 0.6);
        ${subTweens}
      tl.fromTo("#t-wrap", { scale: 1 }, { scale: 1.03, duration: 5, ease: "none" }, 0.2);
      window.__timelines["title"] = tl;
    </script>
  </template>
</body></html>
`;
}

/** Compile episodes (default: all) into their projects' composition/. */
export function buildSeries(seriesDir, only = []) {
  const series = loadSeries(seriesDir);
  if (!FORMATS[series.format]) throw new Error(`series.json format "${series.format}" is not one of ${Object.keys(FORMATS).join(", ")}.`);
  const world = engineSource(seriesDir, series);
  const results = [];
  for (const ep of series.episodes.filter((e) => !only.length || only.includes(e.n))) {
    const epFile = path.join(seriesDir, "episodes", `ep${pad(ep.n)}.js`);
    const script = fs.readFileSync(epFile, "utf8");
    const cfg = { ...parseEpisodeConfig(script), n: ep.n };
    const projectDir = path.resolve(seriesDir, ep.project);
    const comp = path.join(projectDir, "composition");
    const indexPath = path.join(comp, "index.html");
    const prev = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
    const manifest = readJson(path.join(projectDir, "audio", "audio-manifest.json"), null);
    const cues = manifest ? scriptCaptions(manifest, { replace: series.captionReplace || [] }) : null;
    ensureDir(path.join(comp, "compositions"));
    fs.writeFileSync(indexPath, hostHtml(series, cfg, { world, script, audio: block(prev, "audio"), captions: cues ? captionsBlock(cues) : block(prev, "captions") }));
    fs.writeFileSync(path.join(comp, "compositions", "hud.html"), hudHtml(series, cfg));
    fs.writeFileSync(path.join(comp, "compositions", "title.html"), titleHtml(series, cfg));
    results.push({ episode: ep.n, composition: comp, duration: cfg.duration, audio: /<audio /.test(prev), captions: cues ? cues.length : null });
  }
  return { series: series.name, built: results };
}

function starterEpisode(n, title, seed) {
  return fs.readFileSync(path.join(ENGINE_DIR, "episode-starter.js"), "utf8")
    .replaceAll("{{NN}}", pad(n)).replaceAll("{{TITLE}}", title.toUpperCase()).replaceAll("{{SEED}}", String(seed));
}

function createEpisodeProject(brief, slug, n, { skipHyperframesInit }) {
  const state = initProject({ ...brief, name: `${slug}-ep${pad(n)}`, template: "cinematic" }, { skipHyperframesInit });
  // The series host replaces the template's scenes.
  const scenes = path.join(state.paths.composition, "compositions");
  for (const f of fs.readdirSync(scenes)) if (f.endsWith(".html")) fs.rmSync(path.join(scenes, f));
  return state.paths.project;
}

/** Create a series folder (engine copy, series.json, episode stubs) and one VYBE project per episode. */
export function initSeries(brief, { episodes = 1, kits = ["characters"], title, skipHyperframesInit = false } = {}) {
  const slug = slugify(brief.name);
  const seriesDir = path.join(brief.outDir, slug);
  if (fs.existsSync(path.join(seriesDir, SERIES_FILE))) throw new Error(`A series already exists at ${seriesDir}; use "vybe series add".`);
  ensureDir(path.join(seriesDir, "episodes"));
  const resolved = resolveKits(kits);
  ensureDir(path.join(seriesDir, "engine", "kits"));
  fs.copyFileSync(path.join(ENGINE_DIR, "core.js"), path.join(seriesDir, "engine", "core.js"));
  for (const k of KITS) fs.copyFileSync(path.join(ENGINE_DIR, "kits", `${k}.js`), path.join(seriesDir, "engine", "kits", `${k}.js`));
  const series = {
    name: brief.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    title: title || titleLines(brief.name),
    format: brief.format.key,
    fps: brief.fps,
    kits: resolved,
    palette: { bg: "#02040a", ink: "#e6eef6", accent: "#39d0ff", danger: "#ff3b3b" },
    captionReplace: [],
    brief: { prompt: brief.prompt, style: brief.style?.preset || null },
    episodes: [],
  };
  writeJson(path.join(seriesDir, SERIES_FILE), series);
  fs.writeFileSync(path.join(seriesDir, "series-bible.md"), bibleStub(series));
  for (let n = 1; n <= episodes; n++) addEpisode(seriesDir, { brief, skipHyperframesInit });
  return { seriesDir, ...loadSeries(seriesDir) };
}

/** Add the next episode: a starter episode file and its own VYBE project. */
export function addEpisode(seriesDir, { brief, title, skipHyperframesInit = false } = {}) {
  const series = loadSeries(seriesDir);
  const n = series.episodes.reduce((m, e) => Math.max(m, e.n), 0) + 1;
  const slug = path.basename(seriesDir);
  const epBrief = brief || { ...readJson(path.join(path.resolve(seriesDir, series.episodes[0].project), "vybe.json")).brief };
  epBrief.outDir = path.dirname(seriesDir);
  const projectDir = createEpisodeProject(epBrief, slug, n, { skipHyperframesInit });
  const epTitle = title || `Episode ${n}`;
  fs.writeFileSync(path.join(seriesDir, "episodes", `ep${pad(n)}.js`), starterEpisode(n, epTitle, 1000 + n));
  series.episodes.push({ n, title: epTitle, project: path.relative(seriesDir, projectDir).replace(/\\/g, "/") });
  writeJson(path.join(seriesDir, SERIES_FILE), series);
  return { episode: n, project: projectDir, file: path.join(seriesDir, "episodes", `ep${pad(n)}.js`) };
}

function bibleStub(series) {
  return `# ${series.name} — series bible

Locked decisions every episode reuses, so the show looks and sounds like one series.

## Format
- ${series.format} · ${FORMATS[series.format].width}×${FORMATS[series.format].height} · ${series.fps} fps
- Title card: ${series.title.join(" / ")}

## Look
- Palette: background ${series.palette.bg} · ink ${series.palette.ink} · accent ${series.palette.accent} · danger ${series.palette.danger}
- Type: Orbitron (title) · JetBrains Mono (HUD, screens) · Inter (captions)

## Cast (3D, built in code: engine/kits)
- _Name each character, the rig that plays them and their colours._

## Sets
- _Name each set, its origin in world space and what kit builds it._

## Voices
| Character | Voice | Treatment (\`voiceFx\`) | Speed |
| --- | --- | --- | --- |
| Narrator | \`bm_george\` | none | 0.9 |

## Sound
- Music mood, signature SFX, when the music drops to silence.
`;
}
