# Style engine

Machine-readable presets live in `assets/styles/styles.json` (tokens, motion,
camera, transitions, lighting, texture, sound). `vybe init` writes a preset's
tokens into the `vybe:tokens` block of `composition/index.html` as CSS custom
properties (`--vy-bg`, `--vy-ink`, `--vy-accent`, `--vy-font-display`, …) and adds
`@font-face` for its fonts. Every template reads only these variables, so a style
swap is a token swap.

## Presets at a glance

| Preset | Look | Motion | Camera | Signature transitions | Sound |
| --- | --- | --- | --- | --- | --- |
| `apple-minimal` | light or pure black, Inter, huge type, one accent | calm, `power3.out`, generous holds | slow push-in, gentle orbit | clean cut, white flash, shared element | soft piano/pulse |
| `cinematic` | low-key, warm key/cool rim, Fraunces serif, grain, letterbox | measured, `expo.out`, long beats | dolly, crane, parallax truck | flare wipe, match cut, act fades | orchestral swell, risers, bass hits |
| `cyberpunk` | near-black, cyan/magenta neon, Orbitron, scanlines | fast, `power4.out`, stutter steps | fly-through, dutch tilt, whip | RGB-split glitch, slice | dark synthwave, glitches |
| `scientific` | deep navy, teal/amber, grids, Space Grotesk + mono labels | curious, precise | orbit model, zoom across scales | zoom-through, diagram morph | ambient pulse, pings |
| `kinetic-typography` | flat color fields, Anton, extreme scale | rhythmic, `back.out`, on the beat | type-as-camera, 90° rotations | word becomes the frame | beat-forward track |
| `corporate` | navy/blue, cards, Inter bold | confident, tidy | push to metric, lateral slides | panel slide, grid assemble | uplifting corporate |
| `experimental` | black + acid accent, generative geometry | unpredictable, `expo.inOut` | impossible paths, infinite zoom | displacement, pixel slice | IDM textures |

## Choosing

- Use the brand's own system when one exists (`--project`, a site, a logo): extract
  its colors/fonts and override tokens; the preset only supplies motion/camera.
- **Blend** two presets when the brief straddles them ("Apple-style ad for an AI
  product" = apple-minimal tokens + one cyberpunk accent glow in the hero scene).
  Write the blend into `creative-direction.md`.
- **Custom** when the user describes a look no preset covers ("1970s NASA
  documentary", "risograph zine", "vaporwave mall"). Build tokens from the
  description: palette (5 colors, AA contrast), a bundled font that fits
  (Inter, Space Grotesk, Fraunces, JetBrains Mono, Anton, Orbitron) or a
  user-supplied font file with `@font-face`, texture, motion tempo. Never force
  a preset onto a custom brief.

## Applying a custom palette

Edit the token block in `composition/index.html` directly:

```css
/* vybe:tokens:start */
:root { --vy-bg: #1b1410; --vy-ink: #f6e7cf; --vy-accent: #ff7a1a; /* … all keys */ }
/* vybe:tokens:end */
```

Keep every key the templates use: `bg bg-2 ink muted accent accent-2 glow
font-display font-body font-mono display-weight tracking-display`. A named font
needs an `@font-face` pointing at a local file in `assets/fonts/` (HyperFrames
lint `font_family_without_font_face`).
