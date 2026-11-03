# Changelog

All notable changes to VYBE are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [Unreleased]

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
