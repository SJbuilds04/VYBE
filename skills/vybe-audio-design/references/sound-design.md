# Sound design — spotting tables

## Visual event → sound

| Visual event | Sound | Placement |
| --- | --- | --- |
| Fast element entrance / swipe / whip | `whoosh` / `whoosh-short` | starts 0.08–0.12s before the motion's fastest point |
| Scene transition (cinematic) | `whoosh-cinematic` | centered on the cut |
| Hero lands / logo locks / title slam | `impact-bass-1` / `impact-bass-2` | exactly on the landing frame |
| Build toward a reveal | `riser` (10s bundled) | end = reveal time (start = reveal − duration) |
| UI tap, toggle, card select | `click` / `click-soft` | on the press frame |
| Icon/chip pops in | `pop` | on the scale overshoot peak |
| Success, positive result, end card | `chime` | 0.05s after the result appears |
| Data point / callout appears | `ping` | on the dot pop |
| Magic, sparkle, AI generation | `sparkle` | across the shimmer |
| Glitch cut, error, tech distortion | `glitch-1..3`, `error` | on the distorted frames |
| Typing / code on screen | `typing`, `key-press` | aligned to visible character steps |
| Notification card | `notification` | on entrance |

## Density

- 30s ad: 4–8 cues. 15s reel: 5–10 (faster cutting). 40s explainer: 6–12.
- No two whooshes within 0.4s. No SFX under the first word of a narration line.
- Silence is a sound: a 0.3–0.5s drop before the biggest reveal makes it land.

## Layering an impact (when a bigger hit is needed)

sub (impact-bass) + transient (click/pop at 0.6 volume) + tail (whoosh-cinematic
reversed is not available — use a short riser ending on the hit). Keep the
combined peak under −1 dBTP; `vybe qc` flags clipping.

## Licensing

The HyperFrames bundled SFX are Pixabay Content License (free, no attribution
required; credited anyway). HeyGen library items follow HeyGen's terms. VYBE
synthesized SFX and procedural music are original and license-free. Openverse
sounds: only CC0 / CC BY (attribute) — record each in `credits.md`.
