# Storyboard contract

`storyboard.json` is the plan every later stage reads: the composition is built
from it, `vybe audio` derives voice lines, SFX cue times and music mood from it,
and `vybe qc` samples frames at its scene midpoints and cuts.

## Schema

```jsonc
{
  "title": "Black Holes in 30 Seconds",
  "concept": "Gravity as a story about light that cannot escape.",   // one sentence
  "thumbnail": 21.5,                       // optional: seconds, best hero frame
  "music": { "mood": "cinematic", "bpm": 70, "query": "dark ambient space orchestral", "notes": "swell into scene 4" },
  "scenes": [
    {
      "id": "s1",                          // unique; becomes compositions/s1.html
      "name": "Cold open",
      "duration": 4,                       // seconds; scenes play back to back
      "purpose": "hook",                   // hook | context | build | proof | climax | resolve | cta
      "composition": "Tiny star bottom-left, vast black frame, slow drift of dust",
      "text": ["Nothing escapes."],        // exact on-screen strings ([] if none)
      "background": "Three.js starfield, deep z, fog",
      "animation": "Words surface from blur one at a time; dust parallax",
      "camera": "Slow dolly-in toward the star",
      "transition": "Light streak wipes into scene 2 (match on the streak)",
      "sfx": [{ "name": "whoosh-cinematic", "at": 3.6 }],   // `at` = seconds into THIS scene
      "music": "Low drone, no percussion",
      "narration": "Some things pull so hard that not even light gets away.",  // required (string) when voice is on
      "narrationOffset": 0.3,              // optional: when the line starts inside the scene
      "technique": ["three.js", "gsap"]    // optional: helps composition-brief.md
    }
  ]
}
```

Rules enforced by `vybe storyboard validate`: required fields above; durations
> 0; SFX inside their scene; narration present when voice is on; total within
±15% of the brief. Warnings: >3.2 on-screen words/second, narration longer than
its scene (~155 wpm), more than half the scenes fading, identical animation in
every scene, no camera movement anywhere, scenes longer than 12s.

## Writing good scenes

- **One idea per scene**, stated in `purpose`. If two things happen, it is two scenes.
- **Durations follow content:** read time (0.3s/word + 0.5s), narration length,
  and the beat grid (`60/bpm`); round to beats when music leads.
- **Transitions are designed at the cut**, describing both sides ("the ring
  becomes the O of the title").
- **SFX on visible events only** (impact on a landing, whoosh on a fast move,
  click on UI). 3–8 cues per 30s is typical; more is noise.
- **Narration and picture complement each other** — never read on-screen text
  aloud verbatim; the picture shows, the voice explains.
- Typical arcs: 30s ad = hook 3 · problem/desire 5 · product 8 · proof 6 · CTA 5
  (+3 buffer). 40s explainer = question 4 · model 10 · mechanism 12 · example 8 ·
  takeaway 6.
