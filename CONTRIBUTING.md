# Contributing to VYBE

Thanks for helping make VYBE better. Good first contributions: a new template, a style preset,
a QC check, a provider adapter, or a fix for something a real render got wrong.

## Setup

```bash
git clone https://github.com/SJbuilds04/VYBE.git && cd VYBE
npm run link          # agent discovery links (junctions on Windows)
node skills/vybe/scripts/vybe.mjs doctor
npm run validate && npm test
```

No npm dependencies: the engine is plain Node 22+ ESM. Keep it that way unless a dependency is
unavoidable.

## Ground rules

1. **Never invent APIs.** HyperFrames commands/attributes must exist in the installed CLI
   (`npx hyperframes <cmd> --help`) or its skills. Provider adapters must cite the official doc
   they follow in `skills/vybe-image-to-motion/references/providers.md`; mark anything unverified
   as experimental.
2. **Determinism.** Compositions must render identically every time: no `Math.random()`,
   clocks, network fetches at seek time, or free-running animation loops.
3. **Honesty in output.** The engine never reports success without the file on disk; fallbacks
   are always named in reports.
4. **No credentials** in code, fixtures, logs or outputs. `npm run validate` scans for key-shaped strings.
5. **Progressive disclosure.** `SKILL.md` files stay short (well under 500 lines); detail goes in
   `references/` and is loaded on demand.

## Adding a template

1. Create `skills/vybe/assets/templates/<name>/index.html` (host) and `compositions/*.html` (one per scene),
   following an existing template: `#vybe-root` with `container-type: size`, the
   `vybe:tokens`, `vybe:captions` and `vybe:audio` markers, the caption builder, `cqmin` units.
2. Add it to `TEMPLATES` / `TEMPLATE_RULES` / `DEFAULT_DURATION` in `scripts/lib/args.mjs`, and to
   the catalog in `references/composition-guide.md`.
3. Prove it: `vybe init -- demo --template <name>` then, in `composition/`, `npx hyperframes check`
   must pass and you must look at `npx hyperframes snapshot` frames in landscape **and** vertical.
   `npm run test:integration` lints every template automatically.

## Adding a style preset

Add an entry to `skills/vybe/assets/styles/styles.json` with every token key (the unit tests
enforce this), fonts from the bundled set (or add an OFL font + its copyright to `OFL.txt`), and
a row in `references/style-engine.md`.

## Adding a provider

Image-to-video: add an adapter object to `skills/vybe-image-to-motion/scripts/lib/providers.mjs`
(`env`, `build`, `taskId`, `poll`, `status`), mocked-HTTP tests in
`tests/unit/image-to-motion.test.mjs`, and a documented section in `references/providers.md`.
Audio: prefer extending HyperFrames' media-use engine path; VYBE-local fallbacks live in
`skills/vybe/scripts/lib/{audio,music}.mjs`.

## Pull requests

- One topic per PR; describe what you verified (commands + results).
- Include before/after frames for visual changes.
- `npm run validate && npm test` must pass; run `npm run test:integration` when you touch
  templates, audio or QC.
- Update `CHANGELOG.md` under "Unreleased".

By contributing you agree your work is released under the MIT license.
