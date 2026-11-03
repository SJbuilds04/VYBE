---
name: vybe-video-quality
description: Rendered-video quality assurance for VYBE / HyperFrames — technical checks with FFmpeg (resolution, duration, fps, black or frozen frames, loudness, clipping, audio sync), frame extraction and vision-based review, a defect taxonomy with causes and fixes, and a bounded fix-and-re-render loop. Use after rendering a video, when a render looks wrong (black frames, unstyled text, flicker, overlap, silent audio), or before delivering any video.
license: MIT
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Video Quality

Never declare a video done because the render command exited 0. Done means:
technical checks pass, a human-grade look at the frames found nothing wrong, and
any remaining issue is written down.

## Loop

1. `npx hyperframes check` in `composition/` must pass before rendering
   (lint + runtime + layout + motion + contrast + craft).
2. Render (`vybe render <project>`).
3. Technical QC: `vybe qc <project>` — or manually:
   ```bash
   ffprobe -v error -show_format -show_streams out.mp4
   ffmpeg -i out.mp4 -an -vf "blackdetect=d=0.2:pic_th=0.98:pix_th=0.03" -f null -
   ffmpeg -i out.mp4 -an -vf "freezedetect=n=0.0008:d=2" -f null -
   ffmpeg -i out.mp4 -vn -af "ebur128=peak=true" -f null -
   ffmpeg -ss <t> -i out.mp4 -frames:v 1 -vf scale=1280:-2 frame.png
   ```
4. Visual review of scene midpoints and both sides of every cut (vision model).
5. Fix the **source**, re-check, re-render, re-QC. Budget: 3 attempts by default
   (`--max-fixes`). Then stop and report what remains.

Record each attempt in `quality-report.md`: measurements, failures, warnings,
whether vision was used, defects found → fixes applied.

## Defect taxonomy (symptom → cause → fix)

Load `references/rendering.md` for render-environment issues.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Tiny unstyled text top-left in a scene | `<style>` outside the sub-composition `<template>` | move styles inside `<template>` |
| Scene static for its whole slot, render waited 45s | host `data-composition-id` ≠ scene id ≠ timeline key | make all three identical |
| Whole video blank / frozen at t=0 | timeline registered before async build, or wrong key | register at end of build; key = root id |
| Black 3D layer | WebGL failed / rendered outside `hf-seek` / missing `data-duration` | follow `vybe-cinematic-3d` contract; check console in `check` |
| Giant squares in particle field | Points without sprite, or camera passing through particles | round sprite map; keep particles beyond camera z |
| Element jumps at a scene start | `from()` instead of `fromTo()`, or two fromTo on one prop | `fromTo`; `set` + `to` for the second |
| Text stutters while spacing/size animates | tweening letterSpacing/width/fontSize | animate per-glyph `x` / `scale` |
| Text overlaps between cards | covered layers still present underneath | hide covered layers after the cover lands |
| Text hidden under a dark layer | decorative overlay above text in the host | move overlay into the scene under the text |
| Wrong aspect/layout in vertical | fixed px or landscape-only layout | container units + `@container (max-aspect-ratio: 1/1)` rules |
| Unread final line | CTA appears too late | enter ≥2s before end |
| Empty first frame | everything animates in from nothing | put the title/hero on screen at t=0 |
| Silent render | `<audio>` without `id`, or not inside the root | add ids; re-run `vybe audio` |
| Music drowns voice | no ducking lane / bed too loud | automation lane duck to ~0.28; bed −18 LUFS |
| Clipping (true peak > 0) | stacked SFX on a loud bed | lower SFX volume; finalize limits to −1 dBTP |
| Captions drift | estimated timings / wrong line start | transcribe (Parakeet/Whisper); line start = scene start + offset |
| Black frames mid-video | slot gap (slots don't tile), or scene ends early | make slots contiguous; extend `data-duration` |
| Duration mismatch | root `data-duration` ≠ storyboard total | set root to the total; re-render |

## Vision review prompt (use on the contact sheet, then on suspect frames)

"For each frame: is any text overlapping, clipped, too small or low-contrast? Is
anything broken (unstyled text, missing image, black area, placeholder text left
in)? Is the composition balanced with a clear focal point? Does it match the
brief's style? List concrete defects with frame time and location."

If the agent has no vision capability, state it in the report; rely on
`hyperframes check` craft/layout/contrast audits plus FFmpeg checks, and
recommend the user watch the video before publishing.
