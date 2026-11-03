# Animation principles for motion graphics

The classic twelve, translated to type, UI and graphics in a seekable timeline.

| Principle | In motion graphics | GSAP expression |
| --- | --- | --- |
| Squash & stretch | impacts on landing shapes, buttons pressed | `scaleY: 0.85, scaleX: 1.1` for 0.06s then `back.out` |
| Anticipation | a tiny counter-move before a big one | `x: -12` (0.15s, `power2.in`) then `x: 600` |
| Staging | one focal point per moment; dim/blur the rest | `filter: blur(6px), opacity: .4` on secondary layers |
| Straight-ahead vs pose-to-pose | always pose-to-pose: author the end state in CSS, tween from an offset | `fromTo(offset → 0)` |
| Follow-through & overlap | children settle after the parent stops | stagger children +0.05–0.1s with softer ease |
| Slow in / slow out | everything eases, except constant drifts | `expo.out`, `power3.inOut`, `sine.inOut` |
| Arcs | organic paths curve | animate `x` and `y` with different eases, or MotionPath |
| Secondary action | glints, particles, shadow growth support the main move | separate tweens, lower amplitude |
| Timing | weight = duration; big things move slower | see table below |
| Exaggeration | overshoot sells energy | `back.out(1.6–2.6)`, scale from 2.4 |
| Solid drawing | consistent perspective and light | one light direction for all shadows/glints |
| Appeal | clarity + rhythm + restraint | fewer, better moves |

## Timing table (30 fps)

| Element | Enter | Exit | Notes |
| --- | --- | --- | --- |
| Letter | 0.4–0.6s, stagger 0.03–0.06 | 0.25s | per-glyph |
| Headline | 0.7–1.2s | 0.4–0.6s | blur/mask/rise |
| Body line | 0.5–0.7s | 0.3s | |
| Icon / chip | 0.35–0.5s `back.out` | 0.2s | |
| Card / panel | 0.6–0.9s | 0.35s | add slight rotationX for depth |
| Full-frame wipe | 0.3–0.6s | — | cut on motion |
| Camera move | 1.5–6s | — | `power2.inOut` or `sine.inOut` |
| Hero object | 1.2–2.4s `expo.out` | 0.8s | |

## Ease vocabulary

- `expo.out` — confident arrival, Apple-like. Default for premium.
- `power3.out` — friendly, neutral.
- `back.out(1.4–2.6)` — playful pop; kinetic type, icons, CTAs.
- `elastic.out(1, 0.5)` — cartoon; use once per film at most.
- `power2.inOut` / `power3.inOut` — camera and position changes between two states.
- `sine.inOut` — breathing, ambient, loops.
- `steps(n)` — typewriter, film-gate jitter, stop-motion feel.
- `none` — constant drift (Ken Burns, starfields, progress bars).

## Rhythm

Build the timeline on a grid: at 120 BPM, beat = 0.5s; phrases = 2s (4 beats);
sections = 8s. Land big changes on phrase boundaries, small ones on beats, accents
on off-beats. Without music, use a 0.4–0.6s grid anyway — regularity reads as intent.
