#!/usr/bin/env node
// VYBE Image-to-Motion engine CLI.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { classifyMotion, programmaticPlan } from "./lib/plan.mjs";
import { separateLayers, probeImage, imageStats } from "./lib/layers.mjs";
import { PROVIDERS, availableProviders, configured, generate } from "./lib/providers.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORMATS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] };

const HELP = `i2m — VYBE Image-to-Motion engine

  analyze <image>                         Size, aspect, tonal key, palette (+ analysis template)
  classify "<prompt>" [--method m]        Programmatic vs AI recommendation with reasons
  providers                               Image-to-video providers: configured? verified?
  layers <image> --out <dir>              Subject cut-out, filled background plate, depth map
  scaffold --image <img> --prompt "<p>" --composition <dir>
           [--mode layers|depth] [--format landscape|vertical|square] [--duration s] [--skip-removal]
                                          Write a programmatic-motion HyperFrames composition
  generate --provider <p> --image <img> --prompt "<p>" --out <clip.mp4>
           [--duration s] [--aspect 16:9|9:16|1:1] [--model m] [--image-url https://…] [--dry-run]
                                          AI image-to-video (Runway, Luma, Gemini, Kling)
  compose --clip <clip.mp4> --composition <dir> [--title "…"] [--format f]
                                          Wrap an AI clip in a HyperFrames composition`;

function flag(args, name, hasValue = true) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return hasValue ? undefined : false;
  return hasValue ? args[i + 1] : true;
}

function adaptSize(html, [w, h]) {
  return html
    .replace(/<meta name="viewport" content="width=\d+, height=\d+"\s*\/?>/, `<meta name="viewport" content="width=${w}, height=${h}" />`)
    .replace(/(html,\s*body\s*\{[^}]*?width:\s*)\d+px(;\s*height:\s*)\d+px/, `$1${w}px$2${h}px`)
    .replace(/data-width="\d+"(\s+)data-height="\d+"/g, `data-width="${w}"$1data-height="${h}"`)
    .replace(/(<canvas[^>]*?width=")\d+("\s+height=")\d+"/g, `$1${w}$2${h}"`);
}

function setConfig(html, cfg) {
  return html.replace(/(<script type="application\/json" id="i2m-config">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(cfg)}$2`);
}

function setDuration(html, d) {
  return html.replace(/(data-composition-id="main"[^>]*?data-duration=")[\d.]+"/, `$1${d}"`);
}

function ensureProject(dir) {
  fs.mkdirSync(path.join(dir, "assets", "images"), { recursive: true });
  if (!fs.existsSync(path.join(dir, "hyperframes.json"))) {
    fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2) + "\n");
  }
  const index = path.join(dir, "index.html");
  if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dir, `index.before-i2m.html`));
}

function suggestedFormat(aspect) {
  return aspect < 0.85 ? "vertical" : aspect < 1.2 ? "square" : "landscape";
}

async function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case undefined: case "help": case "--help":
      console.log(HELP); return 0;

    case "analyze": {
      const img = args[0];
      if (!img || !fs.existsSync(img)) throw new Error("analyze <image>: file not found");
      const info = probeImage(img);
      const out = { file: path.resolve(img), ...info, aspect: +info.aspect.toFixed(4), suggestedFormat: suggestedFormat(info.aspect), ...imageStats(img),
        visionChecklist: ["main subject and its boundary", "foreground / midground / background", "perspective and horizon", "light direction and shadows", "regions that could plausibly move (sky, water, hair, smoke)", "faces/people (identity must be preserved)"] };
      console.log(JSON.stringify(out, null, 2));
      return 0;
    }

    case "classify": {
      const prompt = args.filter((a) => !a.startsWith("--") && a !== flag(args, "method")).join(" ");
      const res = classifyMotion(prompt, { preferred: flag(args, "method") || "auto", availableAi: availableProviders() });
      console.log(JSON.stringify({ ...res, plan: programmaticPlan(prompt) }, null, 2));
      return 0;
    }

    case "providers": {
      const rows = Object.entries(PROVIDERS).map(([name, p]) => ({ name, configured: configured(name), env: p.env.join(name === "kling" ? " + " : " | "), defaultModel: p.defaultModel, verifiedAgainstOfficialDocs: p.verified }));
      console.log(JSON.stringify(rows, null, 2));
      return 0;
    }

    case "layers": {
      const img = args[0];
      const out = flag(args, "out");
      if (!img || !out) throw new Error("layers <image> --out <dir>");
      console.log(JSON.stringify(separateLayers(img, out, { skipRemoval: flag(args, "skip-removal", false) }), null, 2));
      return 0;
    }

    case "scaffold": {
      const img = flag(args, "image");
      const prompt = flag(args, "prompt") || "";
      const comp = flag(args, "composition");
      if (!img || !comp) throw new Error("scaffold --image <img> --prompt \"…\" --composition <dir>");
      const info = probeImage(img);
      const fmt = flag(args, "format") || suggestedFormat(info.aspect);
      if (!FORMATS[fmt]) throw new Error(`--format must be one of ${Object.keys(FORMATS).join(", ")}`);
      const duration = Number(flag(args, "duration") || 8);
      const plan = programmaticPlan(prompt, { duration });
      const mode = flag(args, "mode") || plan.mode;
      ensureProject(comp);
      const layerDir = path.join(comp, "assets", "images");
      const layers = separateLayers(img, layerDir, { skipRemoval: flag(args, "skip-removal", false) || mode === "depth" && false });
      let html;
      if (mode === "depth") {
        html = fs.readFileSync(path.join(SKILL_DIR, "assets", "depth.html"), "utf8");
        html = setConfig(html, { camera: plan.camera, intensity: plan.intensity, effects: plan.effects, duration, image: `assets/images/${path.basename(layers.source)}`, depth: "assets/images/depth.png", imageAspect: +info.aspect.toFixed(4) });
      } else {
        html = fs.readFileSync(path.join(SKILL_DIR, "assets", "layers.html"), "utf8");
        if (!layers.cutout) html = html.replace(/\s*<div id="subject"[^\n]*<\/div>/, "");
        html = setConfig(html, { camera: plan.camera, intensity: plan.intensity, effects: plan.effects, duration, hasSubject: layers.cutout, subjectSway: plan.subjectSway });
      }
      html = setDuration(adaptSize(html, FORMATS[fmt]), duration);
      fs.writeFileSync(path.join(comp, "index.html"), html);
      const record = { method: "programmatic", mode, format: fmt, plan, layers, note: "Programmatic camera/parallax/atmosphere motion. The image's pixels were not regenerated; no subject motion was synthesized.", createdAt: new Date().toISOString() };
      fs.writeFileSync(path.join(comp, "i2m-plan.json"), JSON.stringify(record, null, 2));
      console.log(JSON.stringify(record, null, 2));
      return 0;
    }

    case "generate": {
      const res = await generate({
        provider: flag(args, "provider"), imagePath: flag(args, "image"), prompt: flag(args, "prompt"), out: flag(args, "out") || "clip.mp4",
        duration: Number(flag(args, "duration") || 5), aspect: flag(args, "aspect") || "16:9", model: flag(args, "model"),
        imageUrl: flag(args, "image-url"), dryRun: flag(args, "dry-run", false),
      }, { log: (m) => process.stderr.write(m + "\n") });
      console.log(JSON.stringify(res, null, 2));
      return 0;
    }

    case "compose": {
      const clip = flag(args, "clip");
      const comp = flag(args, "composition");
      if (!clip || !comp || !fs.existsSync(clip)) throw new Error("compose --clip <clip.mp4> --composition <dir>");
      const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", clip], { encoding: "utf8" });
      const probe = JSON.parse(r.stdout);
      const duration = +Number(probe.format.duration).toFixed(3);
      const v = probe.streams.find((s) => s.width);
      const fmt = flag(args, "format") || suggestedFormat(v.width / v.height);
      ensureProject(comp);
      fs.mkdirSync(path.join(comp, "assets", "video"), { recursive: true });
      fs.copyFileSync(clip, path.join(comp, "assets", "video", "clip.mp4"));
      if (fs.existsSync(`${clip}.provenance.json`)) fs.copyFileSync(`${clip}.provenance.json`, path.join(comp, "assets", "video", "clip.mp4.provenance.json"));
      let html = fs.readFileSync(path.join(SKILL_DIR, "assets", "clip.html"), "utf8");
      html = html.replace(/(<video id="clip"[^>]*?data-duration=")[\d.]+"/, `$1${duration}"`);
      html = setDuration(setConfig(adaptSize(html, FORMATS[fmt]), { title: flag(args, "title") || "", duration }), duration);
      fs.writeFileSync(path.join(comp, "index.html"), html);
      console.log(JSON.stringify({ ok: true, composition: comp, duration, format: fmt, aiGenerated: true }, null, 2));
      return 0;
    }

    default:
      throw new Error(`unknown command "${cmd}"\n${HELP}`);
  }
}

main(process.argv.slice(2)).then((c) => process.exit(c ?? 0), (e) => { process.stderr.write(`i2m: ${e.message}\n`); process.exit(1); });
