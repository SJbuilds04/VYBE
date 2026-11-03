# Invocation details

`vybe parse` is the source of truth; this file explains its decisions so you can
override them deliberately.

## Precedence

1. Explicit flag (`--format vertical`).
2. Explicit words in the prompt ("a 30-second vertical reel").
3. Template-native default (social-reel → vertical).
4. Global default (landscape, 30 fps, high quality, music + SFX on, voice off).

## Template inference (first match wins)

| Prompt mentions | Template |
| --- | --- |
| logo, sting, ident, brand reveal | `logo-reveal` |
| kinetic, typography, lyric, word-by-word, music video | `kinetic-typography` |
| reel, tiktok, shorts, instagram, social clip, story | `social-reel` |
| ad, advert, commercial, product, launch, showcase, promo | `product-ad` |
| documentary, history of, archival, retrospective | `documentary` |
| explain, how does/to, what is, tutorial, educational | `explainer` |
| anything else | `cinematic` |

A template is a **starting skeleton**, not the answer. The storyboard decides the
scene count and content; mix techniques across templates freely (a product ad can
borrow the cinematic Three.js space; an explainer can end on a logo sting).

## Style inference

Only strong cues select a preset: "apple-style/minimal" → apple-minimal; "neon,
cyberpunk, synthwave" → cyberpunk; "scientific, molecules, anatomy, physics,
black holes" → scientific; "corporate, business, investor" → corporate;
"abstract, generative, glitch" → experimental; "cinematic, epic, trailer" →
cinematic. Anything else is the creative director's call (`style-engine.md`).
`--style "<free text>"` is a custom direction — honor it literally.

## Voice

On when `--voice` is given or the prompt asks for narration/voice-over. For
explainers and documentaries `voice.suggested` is true: add narration when the
subject cannot be understood from picture + on-screen text alone, and say why in
`brief.md`. Never narrate a logo sting or a kinetic typography piece unless asked.

## Duration

Prompt durations are parsed ("30-second", "45s", "1 minute"). Template defaults:
logo-reveal 8 · kinetic 18 · reel 20 · product-ad 30 · cinematic 30 ·
documentary 40 · explainer 40. Narration may push the length: the storyboard is
allowed to grow up to 15% beyond the target; more than that needs a reason in
`brief.md`.

## Missing subject

If `parse` warns "No subject given", ask exactly one question: what the video is
about. Everything else has a default.
