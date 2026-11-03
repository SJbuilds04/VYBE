# Creative direction — Light Finds Its Shape

**Concept.** Darkness yielding to form: every scene is light discovering something a little
more defined, ending on the name.
**Metaphor / through-line.** One dark orb in deep space that the light slowly "finds" — unlit,
then rim-lit, then crowned by a halo ring that frames the title.
**Audience & feeling.** Creators and developers meeting VYBE for the first time; they should
leave with a feeling of quiet ambition — premium, cinematic, inevitable.
**Directions considered.** Safe: logo on black with a flare · Bold: fast kinetic type ·
Unexpected: the camera discovers the brand inside a 3D world → chosen: the 3D world, because the
product's promise is motion and depth, and a single continuous camera arc proves it.

## Visual identity
- Style: `cinematic` preset — low-key, warm key vs cool rim, serif display.
- Palette: bg #07080b · surface #12151c · ink #f2efe8 · accent #d9a441 (gold) · accent-2 #5b8db8 (steel blue).
- Typography: Fraunces 500 (display, −0.02em) · Inter 500 caps, +0.42em (kickers/tagline).
- Texture & lighting: SVG film grain at 7%, vignette, letterbox bars that settle at open; light
  is motivated by an off-screen key that rises across acts.
- Depth stack: background — Three.js dust in fog; midground — the orb and halo; foreground — type,
  flare, captions, letterbox.

## Motion language
- Easing: entrances `expo.out`, camera `smoothstep`, exits `power2.in`.
- Rhythm: long breaths (~1.1s per word reveal); one idea per act.
- Signature move: blur-to-sharp words; letters of the title landing from depth.
- Camera: dolly-in (act 1) → lateral truck (act 2) → crane-up push (act 3), one continuous arc.
- Transitions: blur-forward dissolve → masked slide-out → flare wipe over the title.

## Sound direction
- Music: VYBE procedural cinematic bed (A minor pads, sub drone), swelling toward the title.
- SFX: cinematic whoosh on the act-1 exit, sparkle as the light arrives, bass impact on the title.
- Voice: Kokoro `am_michael`, two short lines, ducking the bed; the title lands in silence of voice.

## Risks
- Particles near camera ballooning into squares → particles kept beyond camera z, round sprites.
- Text over the lit orb → orb kept off-axis in act 2; title has a glow scrim.
