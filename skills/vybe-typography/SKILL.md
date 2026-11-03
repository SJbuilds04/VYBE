---
name: vybe-typography
description: Typography for motion — type systems, font pairing with bundled OFL fonts, scale and readability rules for video, kinetic typography techniques, per-letter/word animation, captions design and safe zones, in HyperFrames compositions. Use when choosing fonts, sizing or animating text in a VYBE video, building kinetic type or lyric videos, styling captions, or when text overlaps, clips, is unreadable or looks generic.
license: MIT
metadata:
  author: SJ BUILDS
  version: "1.0.0"
  part-of: vybe
---

# VYBE Typography

In motion graphics, type is often the main actor. Treat it like footage: it has
weight, scale, rhythm and a camera.

## Bundled fonts (OFL, in `vybe/assets/fonts/`, copied into every project)

| Family | Character | Good for |
| --- | --- | --- |
| Inter (variable 100–900) | neutral, precise | apple-minimal, corporate, UI, captions |
| Space Grotesk (300–700) | technical, quirky | scientific, experimental, tech |
| Fraunces (variable serif) | warm, literary, high contrast | cinematic, documentary, editorial |
| JetBrains Mono (100–800) | code, data | labels, numbers, terminal looks |
| Anton (400, condensed) | loud, poster | kinetic typography, social hooks |
| Orbitron (variable) | sci-fi display | cyberpunk titles (short words only) |

Every named family needs `@font-face { src: url("assets/fonts/<file>.woff2") }` in
the file that uses it (HyperFrames lint). A user brand font: copy the file into
`assets/fonts/` and declare it the same way; check its license allows embedding.

**Pairings:** Fraunces + Inter (cinematic) · Inter + JetBrains Mono (product/tech) ·
Space Grotesk + JetBrains Mono (science) · Anton + Space Grotesk (social/kinetic) ·
Orbitron (titles only) + Space Grotesk (everything else).

## Readability rules for video (enforced by `hyperframes check` craft audits)

- Minimum reading size: **2.6% of the short side** → `2.7cqmin` (28px at 1080p).
  Body 2.8–3.4cqmin; headlines 6–12cqmin; hero words 15–34cqmin.
- Hold time ≈ 0.3s per word + 0.5s; a closing line ≥ 2s.
- ≤ 3.2 on-screen words per second across a scene; ≤ ~10 words per line.
- Contrast WCAG AA (4.5:1 body, 3:1 large). Over imagery, add a scrim or shadow.
- No `<br>` in body copy; use `max-width` (e.g. `78cqw`) and let it wrap.
  Display titles may break deliberately with block `<span>`s per line.
- Tracking: tighten large display (−0.02 to −0.05em), open up small caps labels
  (+0.2 to +0.5em). Never animate `letter-spacing` (it snaps) — spread glyphs with `x`.
- Safe zones: vertical video keeps reading text out of the top 12%, bottom 22%
  and right 14%.

## Kinetic techniques

| Technique | How |
| --- | --- |
| Blur-to-sharp words | words in inline-block spans, `fromTo {opacity:0,y:30,filter:blur(14px)}`, stagger 0.12–0.16 |
| Slam | one word per beat, `scale 2.4 → 1` with `back.out(1.6)`, color field flips behind |
| Mask rise | line wrapper `overflow:hidden`, inner text `yPercent 110 → 0` |
| Center-out reveal | `clipPath: inset(0 50% 0 50%) → inset(0)` |
| Glyph spread | per-letter `x` offsets toward center collapsing to 0 |
| Typewriter | `clipPath` inset with `steps(n)` ease, or per-char opacity sets |
| Outline echo | duplicate word with `-webkit-text-stroke`, transparent fill, offset trail |
| Type as camera | scale/rotate the whole word stack past the frame into the next scene |
| Word swap | stack two words in a fixed box; `yPercent` the old out and new in |
| Highlight | inline-block `.hl` span scales with `back.out` or a marker bar `scaleX 0→1` behind it |
| Count-up | tabular-nums + `onUpdate` writing `Math.round(v)` |

## Captions (word-synced)

`vybe audio` injects `<script type="application/json" id="vybe-captions">` cues
(`{start, end, text, words:[{text,start,end}]}`) and every VYBE template contains
a caption builder that creates one element per cue and lights each word at its
transcribed `start`. Style per brand:

- Position inside the safe zone, above lower-third graphics, never covering the subject.
- 3–6 words per cue, max 2 lines, 3–3.4cqmin, weight 600+, scrim or shadow.
- Highlight the active word (opacity 0.45 → 1, or accent color via a class).
- Social: uppercase, bold, pop scale on each cue; cinematic: sentence case, subtle fade.
- Never caption with estimated word timings; line-level timing must look line-level.
