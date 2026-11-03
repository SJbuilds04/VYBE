# Formats, frame rates and rendering

| `--format` | Canvas | Use for | Safe zone (keep text inside) |
| --- | --- | --- | --- |
| `landscape` | 1920×1080 | YouTube, web, presentations | 5% margins (title-safe ≈ 90%) |
| `vertical` | 1080×1920 | Reels, TikTok, Shorts, Stories | top 12%, bottom 22%, right 14% reserved for platform UI |
| `square` | 1080×1080 | feed posts, LinkedIn | 6% margins |
| `landscape-4k` / `vertical-4k` / `square-4k` | 3840×2160 / 2160×3840 / 2160×2160 | high-end delivery | as above |

`vybe init` sets the canvas on every root/slot; container units keep layouts
proportional. Check portrait layouts specifically — a landscape composition
squeezed into 9:16 is a defect, not a format.

**Frame rate:** 30 fps default; 60 for fast UI/kinetic motion or sports energy;
24 for a film look (cinematic/documentary). Set with `--fps`.

**Quality:** `--quality draft|standard|high` → HyperFrames `draft|looks|delivery`
(`looks` = CRF 16; `delivery` = highest). Draft for iteration, high for delivery.

**Render command** (via `vybe render`): `npx hyperframes render --output … --quality …
--fps …` (+ `--low-memory-mode` under 1.5 GB free RAM, `--workers N` to cap
Chrome processes, ~256 MB each). 4K renders are 4× the pixels: expect 3–4× the time.

**Durations that work:** logo sting 5–8s · social reel 12–30s · product ad 15–45s ·
explainer 30–90s · documentary intro 30–60s. Hooks land in the first 1.5s on
social formats.

Verify every output with `ffprobe` (done by `vybe qc`): resolution, fps,
duration = root `data-duration`, yuv420p, audio present when tracks exist.
