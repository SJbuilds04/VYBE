# Image-to-video providers

Researched against official documentation on 2026-11-03. Provider APIs change
often; when a call fails with a schema error, re-check the linked docs before
changing the adapter (`scripts/lib/providers.mjs`).

## Runway — verified (OpenAPI spec)

- Docs: https://docs.dev.runwayml.com (`/api.md`, `/openapi.json`)
- Auth: `Authorization: Bearer $RUNWAYML_API_SECRET`, header `X-Runway-Version: 2024-11-06`.
- Create: `POST https://api.dev.runwayml.com/v1/image_to_video`
  body `{ model, promptImage (https URL | runway:// upload | data URI ≤5 MB), promptText (≤1000), ratio, duration }`.
- Poll: `GET /v1/tasks/{id}` → `status` ∈ PENDING · THROTTLED · RUNNING · SUCCEEDED · FAILED · CANCELLED;
  `output[]` URLs on SUCCEEDED (expire in 24–48h — VYBE downloads immediately).
- Models used by VYBE: `gen4.5` (ratios 1280:720, 720:1280, 960:960…, 2–10s),
  `gen4_turbo`, `veo3.1` / `veo3.1_fast` (4/6/8s), `kling3.0_pro` / `kling3.0_standard`
  (3–15s). The spec lists more (seedance2, wan3, gemini_omni_flash, kling_4…); add
  them to `ASPECT_TO_RUNWAY` after checking their ratio enums.

## Luma — verified (Agents API docs)

- Docs: https://docs.agents.lumalabs.ai/guides/videos/generation
- Auth: `Authorization: Bearer $LUMA_AGENTS_API_KEY`.
- Create: `POST https://agents.lumalabs.ai/v1/generations`
  body `{ model: "ray-3.2", type: "video", prompt, aspect_ratio, video: { resolution, duration: "5s", start_frame: ImageRef } }`.
  ImageRef forms documented in prose: public `url`, inline `data` + `media_type`
  (small files), `file_id` (Files API). 10s is not available with a start frame.
- Poll: `GET /v1/generations/{id}` until `state` is `completed` or `failed`
  (`failure_reason`, `failure_code`); video at `output[0].url` (presigned, 1h).
- Caveat: the exact JSON shape of inline `data` ImageRefs was described, not
  exemplified; if it is rejected, pass `--image-url` with a public HTTPS URL.

## Google Gemini — verified (Interactions API docs)

- Docs: https://aistudio.google.com/docs/omni (Gemini Omni Flash)
- Auth: `x-goog-api-key: $GEMINI_API_KEY`.
- Create: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
  body `{ model: "gemini-omni-1.1-flash", input: [{type:"image", data, mime_type}, {type:"text", text}],
  generation_config: { video_config: { task: "image_to_video" } }, response_format: { type: "video", aspect_ratio: "16:9"|"9:16", resolution }, background: true }`.
- Poll: `GET /v1beta/interactions/{id}` while `status` is `in_progress`/`queued`.
  Result: `steps[]` → `model_output` → content item `type: "video"` with base64
  `data` (or `uri` with `delivery: "uri"`).
- Caveats: combining `response_format` with `generation_config` and using
  `background: true` for video are inferred from the documented fields, not shown
  in a single official example. No duration parameter is documented.
- Veo 3.1 preview models (`veo-3.1-*-preview`) were shut down 2026-10-22 on the
  Gemini API; use `--provider runway --model veo3.1` for Veo.

## Kling — experimental

- Official docs (kling.ai/document-api) were not machine-readable at build time.
  The adapter follows the widely documented Open Platform shape (several SDKs and
  aggregator docs agree): JWT HS256 signed with `KLING_SECRET_KEY`, claims
  `{ iss: KLING_ACCESS_KEY, exp: now+1800, nbf: now-5 }`;
  `POST {KLING_API_BASE or https://api.klingai.com}/v1/videos/image2video`
  `{ model_name, image (base64), prompt, duration "5"|"10", mode "std"|"pro" }`;
  poll `GET …/image2video/{task_id}` → `data.task_status` (submitted · processing ·
  succeed · failed), `data.task_result.videos[0].url`.
- Set `KLING_API_BASE` if your account uses a regional host.
- Untested without credentials; prefer Kling 3.0 via Runway.

## Not integrated

HeyGen's image-to-video / photo-avatar flows are manual `heygen` CLI recipes per
HyperFrames' media-use docs; local LTX video generation is available through
`npx hyperframes media-use resolve --type video` when installed.
