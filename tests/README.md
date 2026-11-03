# VYBE tests

| Command | Needs | What it proves |
| --- | --- | --- |
| `npm run validate` | Node | every skill meets the Agent Skills spec (name rules, description/compatibility limits, < 500-line body, referenced files exist); discovery links resolve in `.claude/skills` and `.agents/skills`; plugin manifests parse and match the version; templates carry their markers and scene files; no credential-shaped strings |
| `npm test` | Node | engine logic: invocation parsing and inference, storyboard validation and craft warnings, project scaffolding (isolation, format + token adaptation), audio planning, ducking automation, track/lane wiring, caption grouping, QC parsers and frame sampling, SRT output, image-to-motion method selection, and all four image-to-video adapters against mocked HTTP (request shape, polling, download, provenance, error surfacing, key redaction) |
| `npm run test:integration` | Node, FFmpeg, network for `npx hyperframes` | real tools: all 7 templates scaffold and pass `hyperframes lint` in two formats; image-to-motion layers/depth scaffolds lint clean; procedural music length/loudness/peak; synthesized SFX; audio stage wiring; QC passes a clean video and fails planted black frames and wrong resolution; QC fix budget exhausts; finalize hits −14 LUFS without re-encoding video and refuses unrendered projects; end-to-end init → storyboard → audio → check → render → QC → finalize |
| `VYBE_TEST_VOICE=1 npm run test:render` | + Kokoro (HyperFrames) | adds local narration and caption export to the end-to-end test |
| `VYBE_LIVE_PROVIDER_TESTS=1 node --test tests/integration/providers-live.test.mjs` | your own provider key(s) | a real image-to-video generation per configured provider; skipped otherwise — maintainers never need to share credentials |

Fixtures in `tests/fixtures/` are VYBE's own renders (no third-party images).

Agent-level benchmarks (the ten scenarios from the VYBE spec, with acceptance criteria) live in
[`scenarios/scenarios.md`](scenarios/scenarios.md). They exercise the skill through an agent and
need a human or vision model for the visual criteria.
