# VYBE workflow — exact commands per stage

`V = node <VYBE>/scripts/vybe.mjs`. `P` = the project directory printed by `init`.
`C` = `P/composition` (the HyperFrames project). Every command prints JSON
(except `doctor`/`qc` without `--json`) and exits non-zero on failure.

## 0 · Preflight

```bash
V doctor --json        # once per session; ~20-60s (runs `hyperframes doctor`)
```

Read `blockers` (stop and report them), `capabilities.voice|music|sfx|imageToVideo`
(what will actually run), `skills.hyperframes` (whether `/hyperframes-core` etc. are
installed) and `notes` (e.g. low RAM → render will use `--low-memory-mode`).
If HyperFrames skills are missing, VYBE still works; offer
`npx skills add heygen-com/hyperframes` in the final report.

## 1 · Interpret

```bash
V init -- <the user's full invocation, flags included>
```

Creates `vybe-output/<slug>/` (never overwrites: `-2`, `-3`…), scaffolds `C` with
the official `npx hyperframes init` (fallback: minimal project files), copies the
chosen template + bundled fonts, applies the format and the style preset tokens,
copies user images into `C/assets/images/`, and writes `P/vybe.json` (state) and
`P/brief.md`. Then **fill in the Interpretation section of `brief.md`**: subject,
audience, platform, core message, intended feeling, assets, narration decision,
and every assumption you made instead of asking.

Override the template's preset with `--style-preset <key>` on `init` when the
direction calls for it, or edit the `vybe:tokens` block in `C/index.html` later.

## 2 · Direct

Write `P/creative-direction.md` (template in `creative-direction.md`). Decide the
style (preset, blend, or custom) with `style-engine.md`. This is where the video
stops being generic — spend real thought here.

## 3 · Storyboard

Write `P/storyboard.json` (schema in `storyboard.md`), then:

```bash
V storyboard validate P
```

It checks required fields, the total against the brief duration (±15%), reading
speed, narration fit, fade monotony and camera stillness, and writes
`P/storyboard.md`. Fix every error; treat warnings as craft notes.

**`--review` gate:** show the user `creative-direction.md` (summary) and
`storyboard.md` (table), then stop. Continue only after approval; apply their
changes to the JSON and re-validate.

## 4 · Assets

See `assets.md`. Procedural (CSS/SVG/canvas/Three.js) first. User media is copied
in by `init`. External media only via documented tools, each with a license line
in `P/credits.md`. Image animation → `vybe-image-to-motion`.

## 5 · Compose

Adapt the scaffolded template to the storyboard (`composition-guide.md`): one
sub-composition per storyboard scene in `C/compositions/`, timed host slots in
`C/index.html`, root `data-duration` = storyboard total. Then:

```bash
cd C && npx hyperframes lint      # fast loop while authoring
cd C && npx hyperframes check     # full gate: runtime, layout, motion, contrast, craft
cd C && npx hyperframes snapshot --at <scene midpoints> -o ../previews/snap --no-end
```

Look at the snapshot images yourself before moving on. Write
`P/composition-brief.md`: scene → file map, techniques per scene, registry blocks
used, anything a future editor must know.

## 6 · Audio

```bash
V audio P                          # derives the plan from storyboard.json
V audio P --plan P/audio-plan.json # or an explicit plan (audio-pipeline.md)
V audio P --only music             # redo one layer
```

Writes files into `C/assets/audio/`, injects `<audio>` tracks (voice, ducked music
bed, SFX) and caption data between the `vybe:audio` / `vybe:captions` markers in
`C/index.html`, and records providers + licenses in `P/audio/audio-manifest.json`.
Narration changes scene timing: if voice lines run longer than their scenes,
retime the storyboard and composition, then run audio again.

## 7 · Render

```bash
V render P               # check gate + render at the brief's quality and fps
V render P --draft       # fast draft for a look-see
```

Runs `npx hyperframes check` (aborts on failure), then `npx hyperframes render`
into `P/renders/render-NN.mp4`; adds `--low-memory-mode` automatically under
1.5 GB free RAM. Renders take roughly 1–4× the video length on a laptop; for long
videos run it as a background task if your agent supports that, and wait for it.

## 8 · QC loop

```bash
V qc P            # technical checks + frames → P/previews/qc-NN/, appends quality-report.md
```

Then the visual review in `quality-control.md`. Fix sources → `V render P` →
`V qc P`. Stop at `maxFixAttempts` (QC prints "budget exhausted") and deliver with
the remaining issues listed.

## 9 · Deliver

```bash
V finalize P      # exports/final.mp4 (loudness -14 LUFS, video untouched), thumbnail.png, captions.srt, manifest.json
```

Write `P/share-copy.md` if `--social` was given. Finish with the delivery report
(see SKILL.md). Optionally offer `cd C && npx hyperframes preview` for editing.
