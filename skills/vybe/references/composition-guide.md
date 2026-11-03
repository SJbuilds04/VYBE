# Composition guide (Stage 5)

VYBE compositions are standard HyperFrames projects. When `/hyperframes-core` is
installed it is the authority — read it before writing HTML. This page is the
subset VYBE relies on plus the lessons its templates were tested against.

## Project shape (what `vybe init` scaffolds)

```text
composition/
├── index.html            host: root #vybe-root (data-composition-id="main"), tokens,
│                         persistent layers (3D canvas, grain, progress, hero), scene slots,
│                         captions layer, <!-- vybe:audio --> and <!-- vybe:captions --> markers
├── compositions/s1.html  one sub-composition per storyboard scene (<template> root)
├── assets/{fonts,images,audio,video,captions}/
├── hyperframes.json · package.json (pinned CLI) · meta.json
```

## Host slot ↔ scene file (the contract)

```html
<!-- index.html -->
<div id="s2" class="slot" data-composition-id="s2" data-composition-src="compositions/s2.html"
     data-start="4" data-duration="5" data-track-index="1" data-width="1920" data-height="1080"></div>
```

```html
<!-- compositions/s2.html -->
<template>
  <style> #s2-root { position: absolute; inset: 0; } /* style the root by #id, never a class */ </style>
  <div id="s2-root" data-composition-id="s2" data-width="1920" data-height="1080"> … </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    // scene-local time: 0 = this scene's data-start
    window.__timelines["s2"] = tl;          // key == data-composition-id == host id
  </script>
</template>
```

- Host slot `data-composition-id` = scene root `data-composition-id` = timeline key.
- `<style>` and `<script>` go **inside** `<template>` (the head is discarded).
- Prefix every id in a scene with the scene id (`#s2-title`); ids must be unique
  across the assembled page.
- Root `data-duration` on `#vybe-root` = storyboard total. Slots tile it back to back.
- `vybe init` rewrites every `data-width/height` pair for the chosen format; keep
  them paired on new slots.

## Rules that bite (each one failed a real VYBE template once)

- One paused GSAP timeline per composition, registered **after** it is fully built.
- Use `fromTo` for entrances inside scenes (scenes are re-seeked). Don't chain a
  second `fromTo` on the same target/property; use `set` + `to`.
- Never tween `letterSpacing`/`width`/`top`/`left` — animate per-glyph `x`, `scale`,
  `clipPath`, `opacity`, `filter`. (`gsap_non_transform_motion`)
- No overlapping tweens on the same property of the same element.
- SVG rotation: use `svgOrigin: "cx cy"`, not `transformOrigin` in px.
- No `Math.random()`, `Date.now()`, `performance.now()` — seeded PRNG (mulberry32).
- `repeat: -1` only with a finite root duration; prefer finite `repeat`.
- Never tween `visibility`/`display`/`autoAlpha` on a timed slot; animate children.
- Don't overlay decorative layers (vignette, grain at full opacity) above text in
  the host — put them inside the scene under the text, or keep opacity low.
- Size with container units (`cqmin`, `cqw`, `cqh`; `#vybe-root` has
  `container-type: size`) so one composition works in 16:9, 9:16 and 1:1.
  Use `@container (max-aspect-ratio: 1/1)` for portrait-specific layout.
- Text ≥ `2.7cqmin`; closing line on screen ≥ 2s; something on screen at t=0.
- Mark intentional overflow (full-bleed canvas, light flares) with
  `data-layout-allow-overflow`.
- Every `<audio>` needs an `id`; never add `crossorigin` to media.
- Three.js: render from `hf-seek` time only, pin `setPixelRatio(1)` and size,
  root `data-duration` required. See `vybe-cinematic-3d`.

## Template catalog

| Template | Shows how to | Notable techniques |
| --- | --- | --- |
| `cinematic` | build a 3D world behind type | Three.js dust field + lit orb + halo, camera arc across acts, letterbox, SVG grain, flare wipe, blur-to-sharp words |
| `product-ad` | keep a hero continuous across scenes | host-level CSS 3D device moved at global time, features cascade, count-up stat, CTA end card, portrait-aware layout |
| `explainer` | teach with diagrams | self-drawing SVG rings (`pathLength` + dasharray), leader-line callouts, 3D card assemble, progress rail |
| `social-reel` | hook in frame 0, punch cuts | full-bleed color cards with directional clip wipes, stat + bars, safe-zone padding, bouncing CTA |
| `logo-reveal` | assemble a mark | seeded shard convergence, shockwave ring, per-glyph wordmark spread, bloom |
| `documentary` | tell history with stills | Ken Burns wrapper, procedural archival plate (swap for real images), quote card, timeline draw, film grain weave |
| `kinetic-typography` | cut on the beat | one word per beat, color-field flips, type-as-camera rotation, center-out mask reveal with outline echo |

Adapting a template: rename/rewrite scene files to match storyboard ids, delete
unused scenes, add new ones by copying the closest scene file. Borrow layers
across templates (copy the cinematic Three.js block into a product ad, the
explainer rail into a reel).

## Before rendering

```bash
cd composition && npx hyperframes lint && npx hyperframes check
npx hyperframes snapshot --at <every scene midpoint> -o ../previews/snap --no-end
```

`check` must pass. Read its Craft warnings — they are usually right. Look at
every snapshot (contact-sheet.jpg) yourself.
