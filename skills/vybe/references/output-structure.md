# Output structure

Every run gets its own directory; nothing is overwritten.

```text
vybe-output/<slug>/
├── vybe.json               pipeline state: brief, stages, renders, QC history
├── brief.md                Stage 1 — parsed brief + interpretation and assumptions
├── creative-direction.md   Stage 2
├── storyboard.json         Stage 3 — machine plan (source of truth)
├── storyboard.md           Stage 3 — generated, human-readable
├── composition-brief.md    Stage 5 — scene → file map, techniques, notes for editors
├── quality-report.md       Stage 8 — every QC attempt + visual review
├── credits.md              licenses/attribution for external assets (when any)
├── share-copy.md           with --social
├── composition/            the editable HyperFrames project (the "scenes" live in compositions/)
│   ├── index.html
│   ├── compositions/s1.html …
│   └── assets/{fonts,images,video,audio/{voice,music,sfx},captions}/
├── audio/                  audio-manifest.json (providers, licenses), audio-tracks.html
├── sources/                user originals and provenance notes (image-to-motion, AI clips)
├── previews/               snapshots and qc-NN/ frame sets + contact sheets
├── renders/                render-NN.mp4 / draft-NN.mp4 (every attempt kept)
└── exports/
    ├── final.mp4           loudness-normalized delivery copy of the last good render
    ├── thumbnail.png
    ├── captions.srt        when narration exists
    └── manifest.json
```

Adaptation from the original VYBE spec: HyperFrames serves media relative to the
composition, so `assets/` and `scenes/` live inside `composition/`
(`assets/`, `compositions/`) instead of at the top level.

Edit later with `cd composition && npx hyperframes preview` (Studio), then
`vybe render` + `vybe qc` + `vybe finalize` again.
