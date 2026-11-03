# Audio pipeline (Stage 6)

`vybe audio <project>` produces and wires every sound. Each layer tries the
documented HyperFrames path first and VYBE's local fallback last, and records
which provider actually ran in `audio/audio-manifest.json`.

## Provider ladders

| Layer | Auto order | Notes |
| --- | --- | --- |
| Voice | HeyGen → ElevenLabs → **Kokoro-82M (local)** | HeyGen/ElevenLabs/Gemini run through `/media-use`'s `audio.mjs` engine and need its skill + a credential. Kokoro runs via `npx hyperframes tts`. An explicitly requested provider never falls back silently. |
| Music | HeyGen catalog → Google Lyria → MusicGen (local) → **VYBE procedural bed** | Lyria needs `GEMINI_API_KEY`/`GOOGLE_API_KEY`; MusicGen needs `transformers torch soundfile`. The procedural bed (FFmpeg synthesis, chord pads + optional pulse) always works offline and is labeled as such. |
| SFX | HeyGen library → **HyperFrames bundled library** (19 Pixabay-licensed files) → VYBE synthesized | Named cues resolve by key/alias: whoosh, whoosh-short, whoosh-cinematic, impact(-bass), riser, click(-soft), pop, chime, ping, sparkle, glitch-1..3, typing, key-press, notification, error. |
| Captions | word timestamps from HeyGen TTS, else `npx hyperframes transcribe` (Parakeet → whisper.cpp) | No transcription available ⇒ line-level captions, flagged `timing: "line-level"`. Word timings are never invented. |

Credentials are detected by presence only (`HEYGEN_API_KEY`/`~/.heygen/credentials`,
`ELEVENLABS_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`). Free upgrades worth
mentioning in the report: `heygen auth login --oauth` (free TTS/music/SFX
allowance), `npx hyperframes models install parakeet` (accurate local captions).

## The plan

Derived automatically from `storyboard.json` (scene narration → voice lines at
scene start + `narrationOffset`; scene `sfx[].at` → absolute cue times; `music.mood`
→ bed). Write `audio-plan.json` only to override:

```json
{
  "voice": { "provider": "auto", "voiceId": "am_michael", "speed": 1, "lang": "en",
             "lines": [{ "id": "s1", "text": "…", "start": 0.4 }] },
  "music": { "provider": "auto", "mood": "cinematic", "query": "dark orchestral space", "bpm": 70 },
  "sfx":   [{ "name": "whoosh-cinematic", "at": 3.6, "volume": 0.4 }],
  "captions": true
}
```

Kokoro voices: `am_michael` (cinematic), `bm_george` (documentary), `am_adam`
(explainer), `af_sky` (promo), `af_heart` (social/default), `bf_emma`, `af_nova`.
Procedural moods: cinematic, emotional, ambient, minimal, corporate, energetic,
futuristic (keywords map automatically).

## Mixing (what gets written into `index.html`)

- Voice lines: `<audio id="vo-<scene>">` at volume 1, normalized to −16 LUFS.
- Music bed: one `<audio id="music-bed">` across the film, normalized to −18 LUFS,
  `data-volume` 0.8 (0.55 under narration), with a `data-automation` volume lane:
  1.2s fade-in, 2.2s fade-out, and a duck to 0.28 from 0.25s before each line to
  0.35s after it.
- SFX: `<audio id="sfx-N-name">` at 0.4 (set per cue), trimmed to the film end.
- Delivery: `vybe finalize` runs two-pass loudnorm on the final mix to −14 LUFS /
  −1 dBTP without re-encoding video.

For deeper mixing (EQ, compression, reverb on a track, bus groups, voice carve)
use `/hyperframes-audio` — it owns `data-fx-chain`; don't add a `volume` tween to
a track that already has an automation lane.

## Sync

- Cut picture to narration phrases: after audio, compare each voice line's
  `duration_s` with its scene; retime scenes that are too short, re-run audio.
- Beat sync: with a music file, `npx hyperframes beats` (or
  `npx hyperframes audio <file> --only beats,downbeats,bpm --json`) and snap scene
  boundaries and hits to beats.
- Verify: `npx hyperframes audio --dir composition --range 0,<dur>` lists what plays when.
