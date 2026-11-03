# Visual effects (seek-safe)

Search the HyperFrames registry first (`npx hyperframes catalog --query "film grain"`)
— many of these exist as tested blocks. For effects applied to real footage or
photos (grades, LUTs, vignette, grain on media), use `/media-use` media treatments,
not CSS overlays.

| Effect | Recipe | Cost |
| --- | --- | --- |
| Glow / bloom on type | `text-shadow: 0 0 6cqmin var(--vy-glow)`; animate wrapper opacity, not the shadow | low |
| Soft light pool | absolute radial-gradient div, `mix-blend-mode: screen`, slow scale/opacity | low |
| Light leak / flare | blurred linear-gradient strip, `mix-blend-mode: screen`, `xPercent` sweep | low |
| Film grain | SVG `feTurbulence` rect at 5–12% opacity, `mix-blend-mode: overlay`, translated with `steps(n)` ease (deterministic weave) | low |
| Vignette | radial-gradient overlay **under** text (inside the scene) | low |
| Letterbox | two black bars, `scaleY` from 1.6 → 1 at open | low |
| Chromatic split | two copies of a layer tinted R/B with `mix-blend-mode: screen`, offset ±0.4cqmin for a few frames | medium |
| Motion blur | `filter: blur()` along the move for fast tweens; HyperFrames also supports authored page motion blur (see `/hyperframes-animation` `references/motion-blur.md`) | medium |
| Masks | `clipPath: inset()/circle()/polygon()` tweens; SVG `<mask>`/`<clipPath>` for shapes and text-as-window | low |
| Text as window | `background-clip: text` with an image/gradient behind, animate `background-position` | low |
| Scanlines | repeating-linear-gradient 2px stripes at 6–10% opacity | low |
| Particles (2D) | seeded positions, CSS/SVG dots; per-particle `fromTo` or one canvas drawn from time | medium |
| Particles (3D) | Three.js `Points` with a round sprite texture (`vybe-cinematic-3d`) | medium–high |
| Blur-to-sharp | `filter: blur(14px) → blur(0px)` with opacity — the premium entrance | medium |
| Depth of field (fake) | blur background layers 4–10px, keep subject sharp | medium |

`filter: blur()` on large layers is the most expensive thing you can animate;
keep it on text/small elements or short durations. Avoid stacking more than two
blend modes on full-frame layers in one scene.
