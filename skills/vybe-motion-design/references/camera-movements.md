# Camera movements

A "camera" in 2D is a transform on a wrapper that contains the whole world;
in 3D it is a Three.js camera driven by time. Never move the timed slot itself —
move an inner wrapper.

| Move | Meaning | 2D (GSAP on a world wrapper) | 3D (Three.js, in `renderAt(t)`) |
| --- | --- | --- | --- |
| Push-in / dolly-in | focus, intimacy, importance | `scale: 1 → 1.15`, `ease: "sine.inOut"` or `none` | `camera.position.z = z0 - ease(p) * d` |
| Pull-out / reveal | context, scale, "it's bigger than you think" | `scale: 1.4 → 1` | z increases; widen FOV slightly |
| Truck (lateral) | travel, comparison | `x: 0 → -W*0.3` on world; foreground layers move faster | `camera.position.x = sin(p*π) * a` |
| Crane / pedestal | aspiration, ascent | `y: 0 → H*0.2` | `camera.position.y` up while `lookAt` stays on subject |
| Orbit | object study, product hero | rotateY on a `preserve-3d` object with `perspective` parent | `camera.position = (r cos θ, h, r sin θ)`, `lookAt(target)` |
| Zoom-through | traverse scales, transitions | scale to 6+ through a hole/letter/object | move camera through geometry; swap scenes at the threshold |
| Whip pan | energy, time jump | fast x with motion blur (`filter: blur`) | rotate camera yaw 60°+ in 6–8 frames |
| Dutch tilt | unease, tech tension | `rotation: -6` on world | `camera.rotation.z` |
| Rack focus | shift attention between planes | blur fg `0 → 8px` while bg `8px → 0` | depth-of-field is costly: fake with blurred sprites |
| Handheld | documentary realism | small seeded noise on x/y/rotation (mulberry32 table, sampled by time) | same on camera position |
| Parallax | depth in 2.5D | layers move at speeds ∝ 1/depth: bg 0.2×, mid 0.5×, fg 1×, overlays 1.3× | real z positions do it for free |

## Rules

- One primary camera move per shot. Combining a push-in with an orbit is fine
  when both are slow; combining with a whip is not.
- Ease camera moves `power2.inOut` (A→B) or `sine.inOut`/`none` (continuous).
- Parallax needs at least three layers to read as depth.
- Camera cuts in 3D: define cut times as constants and drive both the camera and
  object visibility from the same constant (see `vybe-cinematic-3d`).
- In portrait formats, trucks become pedestals: lateral space is scarce, vertical
  space is abundant.
