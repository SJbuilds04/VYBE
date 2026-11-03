# Rendering environment

## Local render (HyperFrames)

`npx hyperframes render [dir] --output out.mp4 --quality draft|looks|delivery --fps 30`

- Read the summary's second line: capture mode (`beginframe` fast vs `screenshot`),
  GPU mode, stage timings. `screenshot` + software GL is the slow path.
- `--workers N` caps parallel Chrome processes (~256 MB each). `--low-memory-mode`
  pins 1 worker + screenshot capture — use under ~1.5 GB free RAM.
- `--browser-timeout`, `--protocol-timeout`, `--player-ready-timeout` for heavy
  compositions on slow machines.
- `--docker --strict` for byte-reproducible renders (Docker must be running).
- Partial renders for debugging: `--start <s> --end <s>` (MP4, whole fps, SDR).
- Keep renders out of the project tree you lint; VYBE writes to `<project>/renders/`.

## Hosted / distributed

`npx hyperframes cloud render` (HeyGen-hosted, no local Chrome/FFmpeg),
`lambda render` (AWS), `cloudrun render` (GCP) — read `/hyperframes-cli`
references before using; they need accounts and may bill.

## Long renders and agents

Many agent shells kill commands after a timeout. For long renders, run in the
background (Claude Code: `run_in_background`; elsewhere
`HYPERFRAMES_RENDER_DETACHED=1` in its own process group) and verify the output
file afterwards. Never report a render that you did not see finish.

## Encoding facts

HyperFrames outputs H.264 yuv420p MP4 by default; `--format webm|mov` for alpha
(ProRes 4444 / VP9). `vybe finalize` copies the video stream untouched and only
re-encodes audio (AAC 256k, 48 kHz) after loudness normalization, with `+faststart`
for web playback.
