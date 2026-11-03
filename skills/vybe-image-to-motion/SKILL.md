---
name: vybe-image-to-motion
description: Animate a still image into video. Analyzes the image, plans the motion, and picks the right technique — programmatic 2.5D (camera moves, depth-map parallax, subject/background layer separation, particles, fog, light) or AI image-to-video (Runway Gen-4.5 / Veo 3.1 / Kling 3.0, Luma Ray 3.2, Gemini Omni Flash) for organic motion like walking, faces, water or hair — then composes the result in HyperFrames with music, SFX and text. Use when someone supplies an image and asks to animate it, bring it to life, add parallax or a camera move, make a person/object move, or use a photo as a moving shot in a VYBE video.
license: MIT
compatibility: Requires Node.js 22+, FFmpeg and the HyperFrames CLI. AI image-to-video needs a provider key (RUNWAYML_API_SECRET, LUMA_AGENTS_API_KEY, GEMINI_API_KEY, or KLING_ACCESS_KEY + KLING_SECRET_KEY); programmatic motion is free and offline.
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Image-to-Motion

`I = node <this skill>/scripts/i2m.mjs`. Works standalone or as Stages 4–5 of
`/vybe` (then the composition directory is the VYBE project's `composition/`).

## The honesty rule

Programmatic motion moves a camera, layers, light and particles around the
**original pixels**. It cannot make a person walk, smile or turn their head, make
water flow, or show the back of a product. Never describe programmatic output as
"the person walks" or "realistic motion". If the request needs pixel-level motion
and no AI provider ran, say so plainly and deliver the camera-motion version as
what it is. AI clips carry a `.provenance.json` and are always labeled AI-generated.

## 1 · Analyze

```bash
I analyze <image>            # size, aspect → suggested format, tonal key, palette
```

Then look at the image (vision) and write `sources/image-analysis.md`: main
subject and boundary, foreground/midground/background, perspective and horizon,
light direction, regions that could move, faces (identity must be preserved).

## 2 · Plan and choose the method

```bash
I classify "<the user's motion request>" [--method programmatic|ai]
I providers                  # which AI providers are configured (presence only)
```

| Request involves | Method |
| --- | --- |
| zoom, push-in, pull-out, pan, orbit-feel, parallax, depth | programmatic |
| particles, dust, snow, rain, fog, light sweep, glow, flare | programmatic |
| background drifting while the subject stays stable | programmatic (layers) |
| gentle float/sway of a separated object | programmatic (layers, `subjectSway`) |
| people/animals moving, facial expressions, hands | AI |
| hair/cloth/leaves/flames moving, water/smoke flowing | AI |
| transformations (melt, bloom, explode), full 360° turns | AI |

The user's explicit `--method` always wins. A **hybrid** (AI clip + programmatic
overlays and camera) is often best: generate the organic motion, then add VYBE
camera, light, type and sound in HyperFrames.

Write `sources/motion-plan.md`: camera move, object/background motion, light,
particles, duration, intensity, method + reason, and what will *not* move.

## 3a · Programmatic

```bash
I scaffold --image <img> --prompt "<request>" --composition <dir> [--mode layers|depth] [--format f] [--duration s]
cd <dir> && npx hyperframes check && npx hyperframes snapshot --frames 5 -o ../previews/i2m
```

- **layers** (default): `npx hyperframes remove-background` cuts the subject and
  a background plate; the subject hole is filled with a blurred copy; plate,
  fog, subject, particles and light move with depth-scaled parallax. Best when
  there is a clear subject.
- **depth**: a Three.js shader displaces the image by a depth map (subject mask +
  ground gradient) as a virtual camera moves — true 2.5D parallax across the
  whole frame. Best for landscapes, interiors, scenes without one subject.
  Keep `intensity` ≤ 1 for faces (strong offsets warp them).
- Tune via the `#i2m-config` JSON in `index.html` (camera: push · pull ·
  pan-left · pan-right · rise · orbit; intensity 0.5–1.5; effects: particles ·
  snow · rain · fog · light-sweep; subjectSway).
- Without a cut-out (removal unavailable) it degrades to single-layer motion —
  report that.

## 3b · AI image-to-video

```bash
I generate --provider <p> --image <img> --prompt "<motion prompt>" --out sources/clip.mp4 --duration 5 --aspect 16:9 --dry-run   # inspect request (keys redacted)
I generate --provider <p> --image <img> --prompt "<motion prompt>" --out sources/clip.mp4 --duration 5 --aspect 16:9
I compose --clip sources/clip.mp4 --composition <dir> [--title "…"]
```

| Provider | Models | Notes |
| --- | --- | --- |
| `runway` | `gen4.5` (default), `gen4_turbo`, `veo3.1`, `veo3.1_fast`, `kling3.0_pro`, `kling3.0_standard` | one key reaches Runway, Google Veo 3.1 and Kling 3.0; durations 2–10s (Veo 4/6/8, Kling 3–15) |
| `luma` | `ray-3.2` | 5s with a start frame; prefers a public `--image-url`, inline data for small files |
| `gemini` | `gemini-omni-1.1-flash` | Interactions API, 16:9 or 9:16; Veo 3.1 *preview* models were retired 2026-10-22 |
| `kling` | `kling-v2-1` (direct) | **experimental** adapter (endpoint from secondary docs); prefer `runway` + `kling3.0_pro` |

Write the motion prompt like a shot description: subject + action + camera +
mood + "keep the subject's identity and composition". Generation costs money:
confirm with the user before an agent-initiated paid call unless they asked for
AI motion explicitly. Never retry a failed paid generation more than once without
asking. Errors (auth, quota, moderation, timeout) are reported verbatim.

Details, sources and caveats: `references/providers.md`.

## 4 · Deliver

The composition gets the normal VYBE treatment: `vybe audio` (music/SFX/voice;
markers are present), `vybe render`, `vybe qc`, `vybe finalize`. Standalone:
`npx hyperframes render --output out.mp4` in the composition directory. Keep the
source image, layers, depth map, `i2m-plan.json` and any `.provenance.json`.
