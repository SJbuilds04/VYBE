# Composition brief — Light Finds Its Shape

| Scene | File | Window | Techniques |
| --- | --- | --- | --- |
| s1 Emergence | `composition/compositions/s1.html` | 0–3.6s | GSAP blur-to-sharp word stagger, stack dissolve |
| s2 Light arrives | `composition/compositions/s2.html` | 3.6–6.8s | rule draw (`scaleX`), clip-path mask reveal |
| s3 Title | `composition/compositions/s3.html` | 6.8–10s | per-glyph scale/blur landing, screen-blend flare wipe, hold push |
| host | `composition/index.html` | 0–10s | Three.js dust field + orb + halo (`hf-seek` driven), haze, grain weave, letterbox, captions builder, audio tracks |

- The camera arc and light-up live in the host Three.js `renderAt(t)` as fractions of the root
  duration, so retiming the film retimes the camera.
- Captions: `assets/captions/captions.json` (Parakeet word timings) injected as `#vybe-captions`.
- Audio: voice `vo-s1`/`vo-s2` (tracks 11), ducked music bed (track 10), SFX lanes 20–21.
- No registry blocks used. Fonts: Fraunces, Inter (bundled OFL).
- To edit: `cd composition && npx hyperframes preview`.
