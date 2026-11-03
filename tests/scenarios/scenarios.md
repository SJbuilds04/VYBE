# Benchmark scenarios

Agent-level scenarios for evaluating a VYBE install end to end. Each is a prompt you give your
agent, plus objective acceptance criteria checked against the project folder. Automated tests
cover the engine underneath (see `tests/README.md`); these measure the whole skill, including the
agent's creative work, and need a human or vision model for the visual criteria.

| # | Scenario | Invocation | Must have |
| --- | --- | --- | --- |
| 1 | Cinematic from a simple prompt | `/vybe A cinematic 20-second teaser about the ocean at night` | cinematic style, ≥3 distinct scenes, camera movement in ≥2, music bed, QC pass |
| 2 | Product advertisement | `/vybe An Apple-style ad for a smartwatch called Pulse` | apple-minimal tokens, hero continuity across scenes, CTA end card held ≥2s |
| 3 | Educational explainer | `/vybe Explain how vaccines train the immune system in 40 seconds` | diagram that builds, numbered process or mechanism, takeaway; `voice.suggested` considered and justified in `brief.md` |
| 4 | Vertical Instagram reel | `/vybe A 15-second Instagram reel about robotics` | 1080×1920, hook visible at t=0, text inside safe zones, cuts every ≤1.5s |
| 5 | Animated logo reveal | `/vybe Animated logo reveal for "Nova"` | 5–8s, mark assembly + impact SFX on the lock, lockup held ≥2s |
| 6 | 3D scientific visualization | `/vybe A 3D visualization of a water molecule, scientific style` | Three.js layer, seeded/deterministic, orbit camera, labels readable |
| 7 | Video with narration | `/vybe Explain black holes in 30 seconds --voice` | voice lines per scene, music ducked under voice, `captions.srt`, word-level timing when Parakeet/HeyGen present |
| 8 | Video without narration | `/vybe A kinetic typography piece about focus --no-voice` | no `<audio id="vo-*">`, rhythm on a beat grid |
| 9 | Music + sound effects | `/vybe A 20-second cyberpunk city intro` | music bed + ≥4 SFX cues on visible events, no clipping (QC true peak < −0.1 dBFS) |
| 10 | User-provided images | `/vybe Animate this image cinematically --image ./photo.jpg` | i2m classification recorded, programmatic method unless AI was available/requested, provenance/honesty note in the report |

## Universal acceptance criteria (every scenario)

- `vybe-output/<name>/` contains brief, creative direction, storyboard (json + md), composition
  brief, quality report, `composition/` source and `exports/final.mp4` + `thumbnail.png`.
- `vybe storyboard validate` passes; `npx hyperframes check` passes in `composition/`.
- `vybe qc` reports a technical pass (or the budget was exhausted and the report lists why).
- The final report names the providers that actually ran and anything skipped.
- No credential values anywhere in the project folder.

## Scoring (optional)

For each scenario score 0–2 on: concept specificity · motion variety (no repeated entrance,
≤1 fade-through-black) · typography readability · audio sync · honesty of the report.
A strong run scores ≥8/10 per scenario.
