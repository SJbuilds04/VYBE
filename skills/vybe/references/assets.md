# Assets (Stage 4)

Order of preference, per visual need:

1. **Procedural** — CSS gradients/shapes, SVG (paths, filters, masks), canvas,
   Three.js geometry, particles, generated textures. Original, resolution-free,
   license-free, and usually better than stock for motion graphics.
2. **User-supplied media** — copied into `composition/assets/images/` by `init`
   (`--image`), or found in the `--project` codebase (logos, screenshots,
   product shots). Never modify the originals.
3. **Resolved media** (when HyperFrames' `/media-use` is installed):
   `npx hyperframes media-use resolve --type image|icon|logo --intent "<what>" --project composition`
   Logos come from official sources only (theSVG → GitHub avatar → favicon); never
   redraw a real brand mark. HeyGen-backed search needs the `heygen` CLI signed in.
4. **Generated media** — only through a configured, documented provider
   (`resolve` generation ladder, Codex `image_gen`, local mflux). Confirm before an
   agent-initiated paid call. If nothing is available, fall back to procedural and
   say so; never pretend an image was generated.

## Useful local operations

```bash
npx hyperframes remove-background in.jpg -o assets/images/cutout.png        # subject cut-out (stills)
npx hyperframes remove-background clip.mp4 -o fg.webm -b bg-plate.mp4        # + background plate (video only)
node <vybe-image-to-motion>/scripts/i2m.mjs layers in.jpg --out assets/images  # stills: cut-out + filled plate + depth map
npx hyperframes capture <url>                                                # site capture (product videos)
npx hyperframes catalog --query "<effect in plain English>"                  # registry blocks before hand-building
npx hyperframes add <block>                                                  # install a registry block
```

Search the registry before hand-building a named effect (glitch, film grain,
shimmer sweep, chart, code window, map, confetti). Registry items are already
seek-safe and lint-clean.

## Organization and credits

- Images → `composition/assets/images/`, video → `assets/video/`, fonts →
  `assets/fonts/`, audio → `assets/audio/{voice,music,sfx}/` (written by `vybe audio`).
- Every external asset gets a line in `P/credits.md`:
  `- assets/images/x.jpg — <source URL or provider> — <license> — <attribution if required>`.
- Openverse/CC media: keep only CC0 / CC BY / CC BY-SA (respect share-alike), and
  record the attribution string exactly.
