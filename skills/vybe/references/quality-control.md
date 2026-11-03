# Quality control (Stage 8)

QC has two halves. Never skip the second.

## A · Technical (`vybe qc <project>`)

Deterministic FFmpeg checks on the latest render:

| Check | Fails when | Warns when |
| --- | --- | --- |
| Resolution / fps | ≠ brief | — |
| Duration | differs from root `data-duration` by > max(0.15s, 2 frames) | — |
| Audio stream | composition has `<audio>` but the render has none | audio/video lengths differ > 0.25s |
| Black frames | ≥0.4s fully black away from head/tail, or black for more than half the film | long black head/tail |
| Frozen picture | — | ≥3s static (intentional hold or dead air?) |
| Loudness | true peak > −0.1 dBFS (clipping) | integrated > −9 or < −28 LUFS; peak > −1 dBTP |
| Silence | — | ≥2s silence while a music bed should play |

It extracts a frame at each scene's midpoint, both sides of every cut, and the
last frame into `previews/qc-NN/` (plus `contact-sheet.jpg`), appends the attempt
to `quality-report.md`, and counts the attempt against `--max-fixes` (default 3).

## B · Visual review (you, with vision)

Open `contact-sheet.jpg`, then individual frames where something looks off, and
the cut pairs. Check, in order:

1. **Broken assets** — missing images, unstyled text in the top-left (scene CSS
   outside `<template>`), black canvas (Three.js not rendering), default fonts.
2. **Typography** — overlapping text, clipped words, text under UI safe zones,
   text over busy backgrounds without contrast, widows on titles.
3. **Composition** — empty frames, everything centered and tiny, subject covered
   by text or hero object (the product-ad template once had its phone over the
   title), awkward crops in portrait.
4. **Transitions** — the frame before and after each cut should feel designed:
   no flash of the wrong scene, no slivers of the previous card, no pop-in.
5. **Consistency** — palette/type/motion language identical across scenes.
6. **Audio sync** — captions match speech, SFX land on the visible event
   (`npx hyperframes audio --dir composition --at <t>`).

If no vision capability is available: say so in `quality-report.md`, rely on
`hyperframes check` (layout, overlap, contrast, craft audits) and the technical
QC, and tell the user the visual review was not performed.

With `GEMINI_API_KEY` set, `npx hyperframes snapshot --describe "<question>"`
adds a Gemini description per frame — useful as a second opinion, not a replacement.

## Fix loop

For each defect: identify the source file and the cause, fix the **source**
(never patch the MP4), re-run `hyperframes check`, re-render (`vybe render`),
re-run `vybe qc`. Fill in the "Visual review" block of each attempt in
`quality-report.md` (defect → fix). When the budget is exhausted, stop rendering
and deliver with remaining issues listed — never loop indefinitely.

`vybe-video-quality` has the full defect taxonomy and fix recipes.
