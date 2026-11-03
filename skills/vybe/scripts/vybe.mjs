#!/usr/bin/env node
// VYBE engine CLI — deterministic helpers the /vybe skill calls at each stage.
// The creative work (direction, storyboard, composition code) is done by the
// agent; this tool handles everything that must be exact and repeatable.
import path from "node:path";
import fs from "node:fs";
import { parseInvocation } from "./lib/args.mjs";
import { doctor, formatDoctor } from "./lib/doctor.mjs";
import { initProject, loadState, setStage } from "./lib/project.mjs";
import { validateStoryboardFile, storyboardMarkdown } from "./lib/storyboard.mjs";
import { audioCommand } from "./lib/audio.mjs";
import { generateMusic } from "./lib/music.mjs";
import { qcCommand } from "./lib/qc.mjs";
import { finalizeCommand } from "./lib/finalize.mjs";
import { renderCommand } from "./lib/render.mjs";
import { readJson, slugify } from "./lib/util.mjs";
import { initSeries, addEpisode, buildSeries } from "./lib/series.mjs";

const HELP = `vybe — VYBE engine (SJ BUILDS)

Usage: node vybe.mjs <command> [options]

  doctor [--json] [--quick]          Environment + provider capability report
  parse  -- <invocation...>          Parse a /vybe invocation into a brief (JSON)
  init   -- <invocation...>          Parse + create an isolated output project
         [--template <t>] [--style-preset <p>]
  storyboard validate <project>      Validate storyboard.json, write storyboard.md
  audio <project> [--plan audio-plan.json] [--only voice,music,sfx,captions]
                                     Produce voiceover / music / SFX / captions
  music --mood <m> --duration <s> --out <file.wav> [--bpm n] [--seed n]
                                     Procedural ambient music bed (offline)
  render <project> [--draft] [--workers n] [--low-memory]
                                     check + render via HyperFrames, logs attempt
  qc <project> [--video file] [--json]
                                     Technical QC + frame extraction + report
  finalize <project>                 Exports: final.mp4, thumbnail.png, captions.srt
  stage <project> <stage> <status>   Record pipeline progress in vybe.json

  series init [--name <n>] [--episodes n] [--kits characters,space,places] [--title "LINE|LINE"] -- <invocation...>
                                     A series: one shared 3D world (engine/), one file per
                                     episode (episodes/epNN.js), one VYBE project per episode
  series add <series-dir> [--title <t>]
                                     Add the next episode (starter file + project)
  series build <series-dir> [n...]   Compile episodes into their projects' composition/

Exit codes: 0 ok · 1 failure/QC fail · 2 usage error.`;

function takeFlag(args, name, hasValue = true) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return hasValue ? undefined : false;
  const [, value] = args.splice(i, hasValue ? 2 : 1);
  return hasValue ? value : true;
}

function afterDashDash(args) {
  const i = args.indexOf("--");
  return i === -1 ? args : args.slice(i + 1);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const args = [...rest];
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      return 0;

    case "doctor": {
      const json = takeFlag(args, "json", false);
      const report = doctor({ quick: takeFlag(args, "quick", false) });
      console.log(json ? JSON.stringify(report, null, 2) : formatDoctor(report));
      return report.ok ? 0 : 1;
    }

    case "parse": {
      const { brief, warnings } = parseInvocation(afterDashDash(args));
      console.log(JSON.stringify({ brief, warnings }, null, 2));
      return 0;
    }

    case "init": {
      // --template stays in the invocation: the parser owns it so format defaults follow it.
      const stylePreset = takeFlag(args, "style-preset");
      const skip = takeFlag(args, "skip-hyperframes-init", false);
      const { brief, warnings } = parseInvocation(afterDashDash(args));
      const state = initProject(brief, { stylePreset, skipHyperframesInit: skip });
      console.log(JSON.stringify({ project: state.paths.project, composition: state.paths.composition, template: state.template, stylePreset: state.stylePreset, scaffold: state.scaffold, warnings }, null, 2));
      return 0;
    }

    case "storyboard": {
      const [sub, rawProject] = args;
      if (sub !== "validate" || !rawProject) throw usage("storyboard validate <project>");
      const project = path.resolve(rawProject);
      const file = path.join(project, "storyboard.json");
      const state = loadState(project);
      const result = validateStoryboardFile(file, { expectedDuration: state.brief.duration.seconds, voice: state.brief.voice.enabled });
      if (result.ok) {
        fs.writeFileSync(path.join(project, "storyboard.md"), storyboardMarkdown(readJson(file)));
        setStage(project, "storyboard", "done");
      }
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }

    case "audio": {
      // Absolute: child processes (render, transcribe) run with other working directories.
      const project = args[0] ? path.resolve(args.shift()) : args.shift();
      if (!project) throw usage("audio <project> [--plan file] [--only list]");
      const plan = takeFlag(args, "plan");
      const only = takeFlag(args, "only");
      const result = await audioCommand(project, { planFile: plan, only: only ? only.split(",") : null });
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }

    case "music": {
      const mood = takeFlag(args, "mood") || "ambient";
      const duration = Number(takeFlag(args, "duration"));
      const out = takeFlag(args, "out");
      const bpm = takeFlag(args, "bpm");
      const seed = takeFlag(args, "seed");
      if (!duration || !out) throw usage("music --mood <m> --duration <s> --out <file.wav>");
      const result = generateMusic({ mood, duration, out, bpm: bpm ? Number(bpm) : undefined, seed: seed ? Number(seed) : undefined });
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }

    case "render": {
      // Absolute: child processes (render, transcribe) run with other working directories.
      const project = args[0] ? path.resolve(args.shift()) : args.shift();
      if (!project) throw usage("render <project>");
      const result = renderCommand(project, {
        draft: takeFlag(args, "draft", false),
        workers: takeFlag(args, "workers"),
        lowMemory: takeFlag(args, "low-memory", false),
        skipCheck: takeFlag(args, "skip-check", false),
      });
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }

    case "qc": {
      // Absolute: child processes (render, transcribe) run with other working directories.
      const project = args[0] ? path.resolve(args.shift()) : args.shift();
      if (!project) throw usage("qc <project> [--video file]");
      const result = qcCommand(project, { video: takeFlag(args, "video") });
      const json = takeFlag(args, "json", false);
      console.log(json ? JSON.stringify(result, null, 2) : result.summary);
      return result.pass ? 0 : 1;
    }

    case "finalize": {
      // Absolute: child processes (render, transcribe) run with other working directories.
      const project = args[0] ? path.resolve(args.shift()) : args.shift();
      if (!project) throw usage("finalize <project>");
      const result = finalizeCommand(project, { thumbnailAt: takeFlag(args, "thumbnail-at") });
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }

    case "stage": {
      const [project, stage, status] = args;
      if (!project || !stage || !status) throw usage("stage <project> <stage> <status>");
      const state = setStage(path.resolve(project), stage, status);
      console.log(JSON.stringify(state.stages, null, 2));
      return 0;
    }

    case "series": {
      const sub = args.shift();
      const skip = takeFlag(args, "skip-hyperframes-init", false);
      if (sub === "init") {
        const name = takeFlag(args, "name");
        const episodes = Number(takeFlag(args, "episodes") || 1);
        const kits = (takeFlag(args, "kits") || "characters").split(",").map((k) => k.trim()).filter(Boolean);
        const title = takeFlag(args, "title");
        const { brief, warnings } = parseInvocation(afterDashDash(args));
        if (name) brief.name = slugify(name);
        const r = initSeries(brief, { episodes, kits, title: title ? title.split("|") : undefined, skipHyperframesInit: skip });
        console.log(JSON.stringify({ series: r.seriesDir, name: r.name, format: r.format, kits: r.kits, episodes: r.episodes, warnings }, null, 2));
        return 0;
      }
      if (sub === "add") {
        const dir = args.shift();
        if (!dir) throw usage("series add <series-dir> [--title <t>]");
        console.log(JSON.stringify(addEpisode(path.resolve(dir), { title: takeFlag(args, "title"), skipHyperframesInit: skip }), null, 2));
        return 0;
      }
      if (sub === "build") {
        const dir = args.shift();
        if (!dir) throw usage("series build <series-dir> [n...]");
        console.log(JSON.stringify(buildSeries(path.resolve(dir), args.map(Number).filter(Boolean)), null, 2));
        return 0;
      }
      throw usage("series init|add|build");
    }

    default:
      throw usage(`unknown command "${cmd}"`);
  }
}

function usage(msg) {
  const err = new Error(`usage: ${msg}\nRun "node vybe.mjs help" for all commands.`);
  err.exitCode = 2;
  return err;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    process.stderr.write(`vybe: ${err.message}\n`);
    process.exit(err.exitCode || 1);
  },
);
