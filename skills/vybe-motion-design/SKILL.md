---
name: vybe-motion-design
description: Motion design craft for VYBE / HyperFrames videos — animation principles, easing and timing, choreography and staggering, scene transitions, camera movement, and visual effects (blur, glow, masks, grain, light leaks), written as seek-safe GSAP recipes. Use when designing or fixing how things move in a video — entrances, exits, transitions between scenes, camera moves, rhythm, or when motion feels generic, floaty, stiff or repetitive.
license: MIT
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Motion Design

Motion is the message. Every movement must say something about the subject —
weight, speed, confidence, wonder — or it should not exist.

All recipes are for HyperFrames: one paused GSAP timeline per composition,
deterministic, seekable. Use `fromTo` for entrances, transforms + opacity +
`clipPath` + `filter` for animation, never layout properties.

## References (load the one you need)

| File | For |
| --- | --- |
| `references/animation-principles.md` | the 12 principles applied to UI/type/graphics, easing vocabulary, timing tables |
| `references/transitions.md` | 14 transition recipes with GSAP code, and when to use each |
| `references/camera-movements.md` | dolly, truck, crane, orbit, zoom-through, whip, rack focus, parallax — 2D and 3D |
| `references/visual-effects.md` | glow, bloom, light leak, film grain, chromatic split, motion blur, masks, morphs |

## The ten rules

1. **Choreograph, don't animate.** Plan who moves first, who answers, who holds.
   A scene is a sentence: subject → verb → object.
2. **Ease is personality.** `expo.out` = premium/confident; `back.out` = playful;
   `power2.inOut` = mechanical camera; `sine.inOut` = breathing/ambient; `none` =
   constant drift. Pick 2–3 eases per film and stay consistent.
3. **Fast in, slow settle.** Most entrances: 0.5–0.9s, 80% of the travel in the
   first 30% of the time.
4. **Exits are quicker than entrances** (≈60%) and use `.in` eases.
5. **Stagger reveals hierarchy** — 0.04–0.08s for letters, 0.1–0.18s for words,
   0.3–0.6s for list items. Never stagger everything identically.
6. **Overlap actions.** The next element starts before the previous finishes
   (position parameter `"<0.2"` / absolute times). Sequential = robotic.
7. **Hold to read.** ≈0.3s per word + 0.5s; closing lines ≥2s.
8. **Always something alive.** During holds, a slow push (`scale 1→1.04`), drift
   or light sweep keeps the frame from dying — but only one ambient motion per layer.
9. **Vary transitions.** At most one fade-through-black per film. Prefer cuts on
   motion, match cuts, mask wipes, zoom-throughs, shared elements.
10. **Respect the beat.** If there is music, every major change lands on a beat
    (`60/bpm`); hits land *on* the downbeat, anticipation starts before it.

## Seek-safe GSAP patterns

```js
const tl = gsap.timeline({ paused: true });
// Entrance: blur-to-sharp rise (premium)
tl.fromTo("#s1-title", { opacity: 0, y: 40, filter: "blur(12px)" },
  { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, 0.2);
// Mask wipe reveal (editorial)
tl.fromTo("#s1-line", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "expo.inOut" }, 0.5);
// Per-glyph spread (instead of letterSpacing — which lint rejects)
gsap.utils.toArray("#s1-word .ch").forEach((c, i, all) => {
  const off = (i - (all.length - 1) / 2) * -30;
  tl.fromTo(c, { x: off, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "expo.out" }, 1 + Math.abs(i - (all.length - 1) / 2) * 0.05);
});
// Count-up (seekable: onUpdate runs on every seek)
const n = { v: 0 }, el = document.getElementById("s1-num");
tl.fromTo(n, { v: 0 }, { v: 97, duration: 1.4, ease: "expo.out", onUpdate: () => (el.textContent = Math.round(n.v)) }, 1.2);
// Ambient hold
tl.fromTo("#s1-stack", { scale: 1 }, { scale: 1.04, duration: 3, ease: "sine.inOut" }, 0);
window.__timelines["s1"] = tl;
```

Splitting text: wrap words/letters in `<span class="w|ch" style="display:inline-block">`
(transforms are no-ops on inline elements). Keep spaces outside the spans.

## Before you hand off

- No two consecutive scenes share the same entrance motion.
- No property tweened twice on the same element at overlapping times.
- `npx hyperframes check` Motion section is clean; for choreography audits run
  the `animation-map.mjs` script shipped with HyperFrames' `/hyperframes-animation` skill when installed.
