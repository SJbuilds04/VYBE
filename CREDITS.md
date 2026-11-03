# Credits and third-party notices

VYBE (© SJ BUILDS, MIT) orchestrates the tools below. It does not bundle, fork or
relicense them unless stated, and claims no ownership of them.

## Runtime dependencies (used, not bundled)

| Project | Owner | License | How VYBE uses it |
| --- | --- | --- | --- |
| [HyperFrames](https://hyperframes.heygen.com) | HeyGen | see its repository | composition runtime, CLI (init, lint, check, snapshot, render, tts, transcribe, remove-background, audio), agent skills, media-use audio engine |
| [GSAP](https://gsap.com) | GreenSock / Webflow | GSAP standard license (free) | animation timelines, loaded from jsDelivr by compositions |
| [Three.js](https://threejs.org) | three.js authors | MIT | 3D and shader layers, loaded from jsDelivr by compositions |
| [FFmpeg](https://ffmpeg.org) | FFmpeg developers | LGPL/GPL (per build) | probing, synthesis of procedural audio, loudness, QC analysis, frame extraction |
| Kokoro-82M | hexgrad | Apache-2.0 | local TTS via `npx hyperframes tts` |
| Parakeet TDT 0.6B v3 | NVIDIA | CC-BY-4.0 | local transcription via `npx hyperframes transcribe` |
| whisper.cpp | ggml authors | MIT | fallback transcription via HyperFrames |
| Chrome headless shell | Google | BSD-style | rendering, managed by HyperFrames |

## Bundled assets

| Asset | License | Location |
| --- | --- | --- |
| Inter, Space Grotesk, Fraunces, JetBrains Mono, Anton, Orbitron (Latin WOFF2 builds from Fontsource) | SIL Open Font License 1.1 | `skills/vybe/assets/fonts/` (`OFL.txt` lists each copyright) |

VYBE ships no music or sound files. The procedural music bed and synthesized SFX are generated
locally by VYBE's own code and are original works free of third-party rights. Sound effects from
the HyperFrames bundled library (Pixabay Content License) are copied into a project only when used,
and recorded in that project's `audio/audio-manifest.json`.

## Optional services (only when the user configures them)

HeyGen (voice, music catalog, SFX library), ElevenLabs (voice), Google Gemini API (TTS, Lyria
music, Omni Flash image-to-video), Runway API (Gen-4.5, Veo 3.1, Kling 3.0), Luma Agents API
(Ray 3.2), Kling Open Platform. Output from these services is subject to each provider's terms;
VYBE records provider, model and request metadata in `.provenance.json` files and manifests.

## Specifications and tools

- [Agent Skills specification](https://agentskills.io/specification)
- [Skills CLI](https://github.com/vercel-labs/skills) (Vercel Labs) for installation
- Claude Code plugin marketplace format (Anthropic)

## Inspiration

The repository layout (skills folder with per-agent discovery links, plugin manifests) follows
conventions used by public Agent Skills projects, including BRAG. No BRAG source code is used;
VYBE is an independent implementation.
