# Changelog

All notable changes to VYBE are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [Unreleased]

## [1.1.0] — 2026-11-04

### Added
- **Series engine** (`vybe series init | add | build`): many episodes, one shared 3D world.
  - A series folder owns a deterministic engine (core + kits) that every episode inlines.
  - Each episode is one file (`CONFIG` header + `EP.init` / `EP.frame`) with its own VYBE project.
  - Generates the host page, the HUD (type-on, blink, instant counters) and the title card.
  - Rebuilds captions from the script text.
- Engine core: renderer, stars, stage, waypoint camera paths, deterministic shake, hologram
  material and canvas-screen helpers.
- Engine kits:
  - `characters`: a configurable humanoid rig that walks, runs and sits; a child; a shadow entity.
  - `space`: a ship, a cockpit with a live screen, a planet with switchable night lights, instanced fleets.
  - `places`: a night city with an openable sky rift, an underground facility.
- `references/series.md`; `/vybe` routes multi-episode requests to the series engine.
- Multi-character audio:
  - Per-line `voice`, `voiceFx` (`ai`, `radio`, `helmet`, `child`, `hologram`) and `voiceSpeed`.
  - Per-scene `musicLevel`, and `black: true` for intended cuts to black.
  - A `suspense` music mood.
  - `alert`, `static`, `powerdown` and `heartbeat` SFX.
  - Screenplay-style dialogue turns narration on.
- README showcase: *The Last Signal*, Season 1 (5 episodes, 9:16), made with VYBE.

### Fixed
- The music bed is sized from the storyboard total instead of the template's root duration.
- Audio injection re-reads `index.html`, so edits made during generation are kept.
- QC no longer fails intentional cuts to black.

## [1.0.0] — 2026-11-03

### Added
- `vybe` orchestrator skill: 10-stage autonomous pipeline (preflight → interpret → direct →
  storyboard → assets → compose → audio → render → QC loop → deliver), review mode, flag parser
  with natural-language inference, resumable state in `vybe.json`.
- Engine CLI (`skills/vybe/scripts/vybe.mjs`, zero dependencies): `doctor`, `parse`, `init`,
  `storyboard validate`, `audio`, `music`, `render`, `qc`, `finalize`, `stage`.
- Seven HyperFrames templates (cinematic, product-ad, explainer, social-reel, logo-reveal,
  documentary, kinetic-typography), sub-composition per scene, format-agnostic via container units.
- Seven style presets with token injection; six bundled OFL fonts.
- Audio pipeline: HeyGen/ElevenLabs/Gemini via HyperFrames media-use, local Kokoro, Parakeet
  word-level captions, HeyGen/Lyria/MusicGen music with an offline procedural score fallback,
  bundled/synth SFX, loudness normalization, ducking automation, caption injection.
- Quality control: FFmpeg checks (format, duration, fps, black/frozen frames, loudness, clipping,
  silence), scene/cut frame extraction + contact sheet, bounded fix budget, `quality-report.md`.
- Delivery: −14 LUFS two-pass normalization with untouched video stream, thumbnail, SRT, manifest.
- Specialist skills: motion design, cinematic 3D, typography, audio design, visual storytelling,
  video quality, image-to-motion.
- Image-to-Motion engine: image analysis, programmatic vs AI method classifier with honesty notes,
  local subject/background separation with matte sanity check, depth maps, CSS 2.5D layers and
  Three.js depth-parallax compositions, AI providers (Runway incl. Veo 3.1 / Kling 3.0, Luma Ray 3.2,
  Gemini Omni Flash, experimental Kling direct) with polling, download and provenance.
- Cross-agent discovery (`.claude/skills`, `.agents/skills`), Claude Code plugin + marketplace
  manifests, link-repair script, structural validator, unit and integration tests.
