---
name: vybe-audio-design
description: Sound design and music direction for VYBE / HyperFrames videos — choosing music by mood and arc, spotting sound effects to picture, voiceover direction and provider choice (HeyGen, ElevenLabs, Kokoro, Gemini), ducking, loudness targets, beat-synced editing and caption sync. Use when planning or fixing the audio of a video, when a video feels silent, cheap, cluttered or out of sync, or when choosing a voice or music provider.
license: MIT
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Audio Design

Sound is half of perceived quality. A mediocre picture with great sound feels
expensive; a great picture in silence feels unfinished.

Production (generation, retrieval, wiring) is done by `vybe audio` — see
`vybe/references/audio-pipeline.md`. This skill is the **direction**: what to ask for
and where it goes. Load `references/sound-design.md` for SFX spotting tables.

## Decide in this order

1. **Is narration needed?** Yes when the subject needs explanation the picture
   cannot carry (explainers, documentaries, tutorials) or the user asked. No for
   stings, kinetic type, mood pieces, most ads under 20s. Default: off.
2. **Music arc.** Map music to the story: intro (sparse) → build (layers in) →
   peak (on the reveal/climax) → resolve (on the CTA/title). Choose tempo from
   the edit: calm 70–95 BPM, confident 100–115, energetic 118–128.
3. **SFX spotting.** Mark every visible event that deserves weight. Then remove
   half. Leave room for the music.
4. **Mix.** Voice on top, music beneath, SFX between — and duck music under voice.

## Voice

| Provider | When | Notes |
| --- | --- | --- |
| HeyGen (Starfish) | best quality + native word timestamps | needs `heygen` OAuth login or `HEYGEN_API_KEY`; free allowance via `heygen auth login --oauth` |
| ElevenLabs | big voice catalog, brand voices | `ELEVENLABS_API_KEY`; word timings via transcription |
| Gemini TTS | directed delivery with style prompts | explicit choice only; `GEMINI_API_KEY` |
| Kokoro-82M | free, offline, private, deterministic | `npx hyperframes tts`; voices `am_michael`, `bm_george`, `am_adam`, `af_sky`, `af_heart`, `bf_emma`, `af_nova`; `--speed 0.9–1.15` |

Writing for voice: short sentences, one idea each, ~150 wpm (2.5 words/s),
numbers written as spoken ("twenty-nine hours"), no on-screen text read verbatim.
Leave 0.3s of air before each line and at least 0.5s at the end.

## Music by mood

| Mood | Character | Fits |
| --- | --- | --- |
| Cinematic orchestral | swells, low strings, risers, hits | trailers, space, epic reveals |
| Ambient technology | pads, soft pulses, glassy textures | science, AI, explainers |
| Futuristic electronic | synth bass, arps, 110–125 BPM | cyberpunk, launches, tech |
| Corporate uplifting | piano + light drums, major | business, SaaS, onboarding |
| Minimal | sparse piano/pulse, lots of space | Apple-style, luxury |
| Energetic | driving drums, 120–128 BPM | social, sports, hype |
| Emotional | slow minor → major lift | documentary, stories, causes |

Retrieval query wording: mood + instrumentation + energy + tempo, e.g.
"dark ambient orchestral, slow build, no vocals, 70 bpm". Never use copyrighted
commercial tracks; VYBE's procedural bed is the guaranteed offline fallback.

## Mix targets

| Layer | Level |
| --- | --- |
| Voice | −16 LUFS per line (normalized), the loudest layer |
| Music under voice | ≈ −28 to −31 LUFS effective (duck to ~0.28 of bed) |
| Music alone | ≈ −18 LUFS bed at volume 0.8 |
| SFX | 0.3–0.5 volume; impacts can peak higher for one frame |
| Final delivery | −14 LUFS integrated, ≤ −1 dBTP (done by `vybe finalize`) |

## Sync rules

- SFX land on the frame of the visual event (impact on landing, not on launch;
  whoosh starts ~0.1s before the move peaks; risers end exactly on the hit).
- Cut on beats: `npx hyperframes beats` → move scene boundaries to the grid.
- Captions come from transcription or HeyGen timestamps — never evenly spread.
- Verify with `npx hyperframes audio --dir composition --at <t>`.
