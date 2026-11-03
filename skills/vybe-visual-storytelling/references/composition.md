# Frame composition for motion

## Layout principles

- **Rule of thirds / power points** for the subject; centered symmetry only for
  hero moments (logo lockup, title card) — it reads as "important" only if rare.
- **Hierarchy by scale:** one dominant element (≥3× the next), one secondary,
  the rest small. If everything is big, nothing is.
- **Depth stack** in every frame: background (gradient, world, texture),
  midground (subject), foreground (particles, light, UI chrome, captions).
- **Negative space is direction:** leave room in the direction of motion and gaze.
- **Lead the eye with motion:** the first thing to move is the first thing seen.
  Move secondary elements later and less.

## Aspect ratios

| Ratio | Composition |
| --- | --- |
| 16:9 | horizontal arrangements; text column left/right of subject; wide establishing shots |
| 9:16 | stack vertically: hook top-third, subject middle, CTA lower-middle (above the 22% UI zone); big type; trucks become pedestals |
| 1:1 | centered or diagonal; tight framing; fewer elements |

Design for the target ratio; a 16:9 layout letterboxed into 9:16 is a defect.
VYBE templates switch layouts with `@container (max-aspect-ratio: 1/1)`.

## Color

- 60/30/10: background / surface / accent. Accent only on what matters now.
- Value contrast > hue contrast for readability.
- Keep one temperature per scene unless the contrast is the point.

## Common failures

| Failure | Fix |
| --- | --- |
| Web-page look (cards in a grid, centered, static) | add a world layer, a camera move, scale contrast |
| Everything enters the same way | assign each element a distinct verb |
| Tiny content in a huge frame | scale up the subject to 40–70% of the frame |
| Subject collides with text | dedicated zones per scene; move the hero (shared element) |
| Dead air during holds | ambient push/drift/light sweep |
