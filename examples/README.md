# Examples

Real VYBE projects produced by the pipeline in this repository, kept with their full source so
you can open, edit and re-render them.

## `cinematic-teaser/` — "Light Finds Its Shape"

```text
/vybe A cinematic 10-second teaser about light finding its shape --voice kokoro
```

- **Template / style:** `cinematic` / `cinematic` preset (Fraunces + Inter, gold key, steel rim)
- **Picture:** Three.js dust field and lit orb with a continuous dolly → truck → crane camera arc,
  blur-to-sharp words, masked line reveal, title landing from depth with a flare wipe, letterbox, grain
- **Sound:** local Kokoro narration (`am_michael`), word-level captions transcribed by Parakeet,
  VYBE procedural cinematic bed ducked under the voice, bundled SFX (whoosh, sparkle, bass impact)
- **Files:** `brief.md` · `creative-direction.md` · `storyboard.json/.md` · `composition-brief.md` ·
  `quality-report.md` · `composition/` (editable) · `audio/audio-manifest.json` · `exports/`

Re-render it yourself:

```bash
node skills/vybe/scripts/vybe.mjs render examples/cinematic-teaser
node skills/vybe/scripts/vybe.mjs qc examples/cinematic-teaser
node skills/vybe/scripts/vybe.mjs finalize examples/cinematic-teaser
```

Or open it in HyperFrames Studio: `cd examples/cinematic-teaser/composition && npx hyperframes preview`.
