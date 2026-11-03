---
name: vybe-cinematic-3d
description: Deterministic Three.js / WebGL for HyperFrames videos — 3D scenes, particle systems, procedural geometry, product turntables, scientific models (molecules, planets, black holes), lighting rigs, camera paths and camera cuts, rendered frame-exactly from HyperFrames time. Use when a VYBE storyboard calls for 3D, depth, particles, space, a rotating product, a data sculpture, or when a Three.js layer renders black, flickers or differs between renders.
license: MIT
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Cinematic 3D

3D in a HyperFrames video is a `<canvas>` whose every frame is a pure function
of time. HyperFrames' `three` adapter publishes the time; you render it.
Authority: `/hyperframes-animation` → `adapters/three.md` when installed.

## Contract (non-negotiable)

- Import pinned: `import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.2/+esm";`
  (or an importmap pinning the same version for addons).
- Build scene, camera, renderer, materials **synchronously** at load; load any
  model/texture before render-critical seeking (Three's `DefaultLoadingManager` is
  awaited automatically). For heavy CPU setup, register
  `window.__hf.buildReady["<name>"] = promise`.
- Render only from time: `window.addEventListener("hf-seek", e => renderAt(e.detail.time)); renderAt(window.__hfThreeTime || 0);`
- No `requestAnimationFrame` loops, clocks, deltas, or unseeded `Math.random()`.
- `renderer.setPixelRatio(1); renderer.setSize(W, H, false)` with W/H from the
  root's `data-width/height`. Root must have `data-duration`.
- Mark the full-bleed canvas `data-layout-allow-overflow`.

## Skeleton

```html
<canvas id="gl" width="1920" height="1080" data-layout-allow-overflow></canvas>
<script type="module">
  import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.2/+esm";
  const root = document.getElementById("vybe-root");
  const W = +root.dataset.width, H = +root.dataset.height, D = +root.dataset.duration;
  const css = getComputedStyle(document.documentElement);
  const tok = (n, f) => css.getPropertyValue(n).trim() || f;           // read VYBE tokens
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.setClearColor(new THREE.Color(tok("--vy-bg", "#000")), 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(W > H ? 40 : 60, W / H, 0.1, 200); // wider FOV in portrait
  // … build …
  function renderAt(t) { const p = t / D; /* camera + objects from t */ renderer.render(scene, camera); }
  window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
  renderAt(window.__hfThreeTime || 0);
</script>
```

Put the canvas in the **host** (`index.html`) when the 3D world spans scenes
(camera arc across the film); put it in a scene file only when it lives in one scene.
Overlay HTML type above it; never render text in WebGL when DOM text will do.

## Recipes

- **Particles / dust / stars:** `THREE.Points` with a seeded PRNG for positions,
  vertex colors from the palette, **a round sprite** (`CanvasTexture` radial
  gradient as `map`) — default points are squares — `AdditiveBlending`,
  `depthWrite: false`. Keep every particle beyond the camera's closest z, or it
  balloons into a giant sprite when the camera passes it (a real VYBE defect).
- **Hero orb / planet:** `SphereGeometry(r, 96, 64)` + `MeshStandardMaterial`
  (metalness/roughness) + emissive halo `TorusGeometry` ring; light it up over time.
- **Black hole:** dark sphere + accretion disk = `RingGeometry` with a canvas
  gradient texture, tilted 70–80°, rotating; lensing ring = second thin torus
  facing camera; stars bend = scale a background points layer radially near center.
- **Molecule:** spheres at atom positions (`InstancedMesh` for many), cylinders
  between them (orient with `quaternion.setFromUnitVectors`); orbit camera.
- **Product turntable:** GLTF via `GLTFLoader` (importmap), `AnimationMixer.setTime(t)`
  for authored clips; studio light rig below; slow orbit 20–35° over the shot.
- **Data sculpture:** `InstancedMesh` boxes whose heights come from data, grown
  with `smoothstep` over time.
- **Procedural terrain/waves:** displace a `PlaneGeometry` in JS from `t`
  (recompute positions per frame for ≤40k vertices) or in a `ShaderMaterial`
  with a `uTime` uniform set in `renderAt`.

## Lighting

Load `references/lighting.md`. Minimum rig: key (Point/Directional), rim/back
light in a contrasting hue, and a `HemisphereLight` fill — a lit mesh with only
one light renders as a black cutout on its dark side. Drive light intensities from
the same time function at fixed ratios.

## Camera

Derive position from normalized progress `p = t / D` with smoothstep segments per
act (see the cinematic template's `renderAt`). For cuts, declare `const CUT_B = 23`
once and use it for both the camera shot selector and object visibility; check the
frames just before and after (`snapshot --at 22.9667,23`).

## Performance (headless Chrome may be software GL)

- ≤ 100k triangles, ≤ 20k particles, no post-processing passes that need frame
  history. Bloom: fake it with additive sprites/halos.
- Avoid `antialias` + huge canvases at 4K on low-RAM machines; test a draft render.
- If WebGL fails in the render environment, the canvas is black: QC catches it
  as black frames; fall back to a 2D canvas or CSS-3D version of the scene.
