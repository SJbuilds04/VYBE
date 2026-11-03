# Transitions

In HyperFrames, scenes are slots that tile the root timeline. A transition is
authored as **the outgoing scene's exit + the incoming scene's entrance**, with
the host providing anything that must span both (a flash, a shared object).
Overlap slots by a few frames when both sides must be visible at once.

| # | Transition | Feels | Recipe |
| --- | --- | --- | --- |
| 1 | Hard cut on motion | modern, punchy | out-scene still moving at its last frame; in-scene element already moving in the same direction at its first |
| 2 | Match cut (shape) | clever, cinematic | the last shape of A (a circle) sits exactly where B's first shape (the O in a word) appears; same size, same position |
| 3 | Shared element | premium continuity | keep the object in the **host**, move it at global time while scenes swap around it (`product-ad` template) |
| 4 | Mask wipe | editorial | in-scene root `clipPath: inset(0 100% 0 0) → inset(0 0 0 0)`, 0.4–0.7s `expo.inOut` |
| 5 | Directional card push | social, energetic | out `yPercent: 0 → -100`, in `yPercent: 100 → 0` (`power3.in` / `power3.out`), same 0.35s |
| 6 | Zoom-through | scale, discovery | out root `scale 1 → 6, opacity → 0` (`expo.in` 0.6s); in root `scale 0.4 → 1` (`expo.out`) |
| 7 | Type as camera | kinetic | rotate/scale the word stack past the frame so its counter becomes the next background (`kinetic-typography` s2) |
| 8 | Whip pan | fast, travel | out `x: 0 → -W` with `filter: blur(0 → 30px)`; in from `+W` with blur → 0; 0.25s each, overlap 2 frames |
| 9 | Light-leak / flare wipe | cinematic warmth | a blurred gradient strip (`mix-blend-mode: screen`) sweeps across the cut (`cinematic` s3) |
| 10 | Flash frame | impact | host white/accent layer opacity 0 → 1 → 0 over 3–4 frames on the downbeat |
| 11 | Glitch / RGB split | tech, cyberpunk | duplicate layer with `mix-blend-mode: screen`, offset x ±8px in steps for 4–6 frames; registry glitch blocks first |
| 12 | Dissolve with scale | memory, time passing | out `opacity 1 → 0, scale 1 → 1.04`; in `opacity 0 → 1, scale 1.04 → 1`; 0.8–1.2s overlap |
| 13 | Fade through black | act break | once per film at most |
| 14 | Morph | transformation | SVG path morph (MorphSVG is a GSAP bonus plugin — check availability) or clip-path polygon → polygon with equal point counts |

HyperFrames also ships shader transitions and registry transition blocks: search
`npx hyperframes catalog --query "<transition you want>"` before hand-building.
Shader transitions force the layered-composite path: put full-bleed fills on a
child, not the composition root.

**Design the cut, not the scenes.** Write each transition in the storyboard as
"A's last frame → B's first frame" and snapshot both sides
(`npx hyperframes snapshot --at <cut-0.04>,<cut+0.04> --no-end`).
