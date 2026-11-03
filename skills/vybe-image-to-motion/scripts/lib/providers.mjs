// Image-to-video provider abstraction. Each adapter: build request → submit →
// poll → result URL/bytes. Endpoints and fields follow each provider's official
// docs as of 2026-11 (see references/providers.md for sources and caveats).
// Credentials are read from env and never written anywhere.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export function imageInput(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unsupported image type ${ext}; use png, jpg or webp.`);
  const buf = fs.readFileSync(file);
  return { mime, base64: buf.toString("base64"), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

const ASPECT_TO_RUNWAY = {
  "gen4.5": { "16:9": "1280:720", "9:16": "720:1280", "1:1": "960:960" },
  gen4_turbo: { "16:9": "1280:720", "9:16": "720:1280", "1:1": "960:960" },
  "veo3.1": { "16:9": "1920:1080", "9:16": "1080:1920" },
  "veo3.1_fast": { "16:9": "1280:720", "9:16": "720:1280" },
  "kling3.0_pro": { "16:9": "1920:1080", "9:16": "1080:1920", "1:1": "1440:1440" },
  "kling3.0_standard": { "16:9": "1280:720", "9:16": "720:1280", "1:1": "960:960" },
};

function clampDuration(model, d) {
  const n = Math.round(Number(d) || 5);
  if (model.startsWith("veo3.1")) return [4, 6, 8].reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  if (model.startsWith("kling3.0")) return Math.min(15, Math.max(3, n));
  return Math.min(10, Math.max(2, n));
}

export const PROVIDERS = {
  // https://docs.dev.runwayml.com — POST /v1/image_to_video, GET /v1/tasks/{id}
  runway: {
    env: ["RUNWAYML_API_SECRET"],
    defaultModel: "gen4.5",
    models: Object.keys(ASPECT_TO_RUNWAY),
    verified: true,
    build({ image, prompt, duration, aspect, model }) {
      const m = model || "gen4.5";
      const ratios = ASPECT_TO_RUNWAY[m];
      if (!ratios) throw new Error(`Runway model "${m}" is not configured in VYBE (known: ${Object.keys(ASPECT_TO_RUNWAY).join(", ")}).`);
      const ratio = ratios[aspect] || ratios["16:9"];
      if (image.bytes > 5 * 1024 * 1024 * 0.74) throw new Error("Runway data URIs are limited to 5 MB; downscale the image first.");
      return {
        method: "POST",
        url: "https://api.dev.runwayml.com/v1/image_to_video",
        headers: { Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" },
        body: { model: m, promptImage: `data:${image.mime};base64,${image.base64}`, promptText: prompt.slice(0, 1000), ratio, duration: clampDuration(m, duration) },
      };
    },
    taskId: (res) => res.id,
    poll: (id) => ({ method: "GET", url: `https://api.dev.runwayml.com/v1/tasks/${id}`, headers: { Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`, "X-Runway-Version": "2024-11-06" } }),
    status(res) {
      if (res.status === "SUCCEEDED") return { done: true, url: res.output?.[0] };
      if (res.status === "FAILED" || res.status === "CANCELLED") return { done: true, error: `${res.status}: ${res.failure || res.failureCode || "no reason given"}` };
      return { done: false, progress: res.progress };
    },
  },

  // https://docs.agents.lumalabs.ai — POST /v1/generations, GET /v1/generations/{id}
  luma: {
    env: ["LUMA_AGENTS_API_KEY"],
    defaultModel: "ray-3.2",
    verified: true,
    build({ image, imageUrl, prompt, aspect, model, resolution }) {
      // ImageRef: a public URL is preferred; inline data is documented for small files.
      const startFrame = imageUrl ? { url: imageUrl } : { data: image.base64, media_type: image.mime };
      return {
        method: "POST",
        url: "https://agents.lumalabs.ai/v1/generations",
        headers: { Authorization: `Bearer ${process.env.LUMA_AGENTS_API_KEY}`, "Content-Type": "application/json" },
        // 10s is not supported with a start_frame, so image-to-video is always 5s.
        body: { model: model || "ray-3.2", type: "video", prompt, aspect_ratio: aspect, video: { resolution: resolution || "1080p", duration: "5s", start_frame: startFrame } },
      };
    },
    taskId: (res) => res.id,
    poll: (id) => ({ method: "GET", url: `https://agents.lumalabs.ai/v1/generations/${id}`, headers: { Authorization: `Bearer ${process.env.LUMA_AGENTS_API_KEY}` } }),
    status(res) {
      if (res.state === "completed") return { done: true, url: res.output?.[0]?.url };
      if (res.state === "failed") return { done: true, error: `${res.failure_code || "failed"}: ${res.failure_reason || ""}` };
      return { done: false };
    },
  },

  // https://aistudio.google.com/docs/omni — Interactions API, gemini-omni-1.1-flash.
  // (Veo 3.1 preview models were shut down on 2026-10-22; Veo 3.1 GA is reachable via Runway "veo3.1".)
  gemini: {
    env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    defaultModel: "gemini-omni-1.1-flash",
    verified: true,
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    build({ image, prompt, aspect, model, resolution }) {
      return {
        method: "POST",
        url: "https://generativelanguage.googleapis.com/v1beta/interactions",
        headers: { "x-goog-api-key": this.key(), "Content-Type": "application/json" },
        body: {
          model: model || "gemini-omni-1.1-flash",
          input: [{ type: "image", data: image.base64, mime_type: image.mime }, { type: "text", text: prompt }],
          generation_config: { video_config: { task: "image_to_video" } },
          response_format: { type: "video", aspect_ratio: aspect === "9:16" ? "9:16" : "16:9", resolution: resolution || "1080p" },
          background: true,
        },
      };
    },
    taskId: (res) => res.id,
    poll(id) { return { method: "GET", url: `https://generativelanguage.googleapis.com/v1beta/interactions/${id}`, headers: { "x-goog-api-key": this.key() } }; },
    status(res) {
      if (res.status === "in_progress" || res.status === "queued") return { done: false };
      const video = (res.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).find((c) => c.type === "video");
      if (video?.data) return { done: true, base64: video.data };
      if (video?.uri) return { done: true, url: video.uri, authHeader: { "x-goog-api-key": this.key() } };
      return { done: true, error: `status ${res.status}: no video in the response` };
    },
  },

  // Kling Open Platform direct API. EXPERIMENTAL: endpoint/fields come from
  // secondary sources (official docs were not machine-readable at build time).
  // Kling 3.0 via Runway (`--provider runway --model kling3.0_pro`) is the verified route.
  kling: {
    env: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
    defaultModel: "kling-v2-1",
    verified: false,
    base: () => process.env.KLING_API_BASE || "https://api.klingai.com",
    token() {
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const now = Math.floor(Date.now() / 1000);
      const head = b64({ alg: "HS256", typ: "JWT" });
      const body = b64({ iss: process.env.KLING_ACCESS_KEY, exp: now + 1800, nbf: now - 5 });
      const sig = crypto.createHmac("sha256", process.env.KLING_SECRET_KEY || "").update(`${head}.${body}`).digest("base64url");
      return `${head}.${body}.${sig}`;
    },
    build({ image, prompt, duration, model }) {
      return {
        method: "POST",
        url: `${this.base()}/v1/videos/image2video`,
        headers: { Authorization: `Bearer ${this.token()}`, "Content-Type": "application/json" },
        body: { model_name: model || "kling-v2-1", image: image.base64, prompt, duration: Number(duration) >= 8 ? "10" : "5", mode: "std" },
      };
    },
    taskId: (res) => res.data?.task_id,
    poll(id) { return { method: "GET", url: `${this.base()}/v1/videos/image2video/${id}`, headers: { Authorization: `Bearer ${this.token()}` } }; },
    status(res) {
      const s = res.data?.task_status;
      if (s === "succeed") return { done: true, url: res.data?.task_result?.videos?.[0]?.url };
      if (s === "failed") return { done: true, error: res.data?.task_status_msg || "failed" };
      return { done: false };
    },
  },
};

export function configured(name) {
  const p = PROVIDERS[name];
  if (!p) return false;
  return name === "kling" ? p.env.every((e) => process.env[e]) : p.env.some((e) => process.env[e]);
}

export function availableProviders() {
  return Object.keys(PROVIDERS).filter(configured);
}

/** Replace credential values in a request with a marker (for --dry-run and logs). */
export function redact(req) {
  const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k, /authorization|api-key|x-goog/i.test(k) ? "<redacted>" : v]));
  const body = JSON.parse(JSON.stringify(req.body || {}), (k, v) => (typeof v === "string" && v.length > 200 ? `<${v.length} chars>` : v));
  return { ...req, headers, body };
}

async function call(fetchImpl, req) {
  const res = await fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body ? JSON.stringify(req.body) : undefined });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const msg = json.error?.message || json.error || json.detail || json.message || json.raw || res.statusText;
    const err = new Error(`HTTP ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Run one generation end to end. Returns { ok, file, provider, model, taskId, provenance }.
 * `fetchImpl` and `sleep` are injectable for tests.
 */
export async function generate(opts, { fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  const { provider: name, imagePath, prompt, out, duration = 5, aspect = "16:9", model, pollSeconds = 8, timeoutSeconds = 900, dryRun = false, imageUrl, resolution } = opts;
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown provider "${name}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
  if (!prompt) throw new Error("A motion prompt is required.");
  const image = imageInput(imagePath);
  const req = p.build.call(p, { image, imageUrl, prompt, duration, aspect, model, resolution });
  if (dryRun) return { ok: true, dryRun: true, provider: name, request: redact(req), configured: configured(name), verified: p.verified };
  if (!configured(name)) throw new Error(`${name} is not configured: set ${p.env.join(" + ")} in the environment.`);

  const created = await call(fetchImpl, req);
  const taskId = p.taskId(created);
  let state = p.status.call(p, created);
  const started = Date.now();
  while (!state.done) {
    if (!taskId) throw new Error(`${name}: no task id in the create response.`);
    if ((Date.now() - started) / 1000 > timeoutSeconds) throw new Error(`${name}: timed out after ${timeoutSeconds}s (task ${taskId}). Re-poll later; the task may still finish.`);
    await sleep(pollSeconds * 1000);
    state = p.status.call(p, await call(fetchImpl, p.poll.call(p, taskId)));
    log(`${name}: ${taskId} ${state.done ? "done" : `running${state.progress !== undefined ? ` ${Math.round(state.progress * 100)}%` : ""}`}`);
  }
  if (state.error) throw new Error(`${name} generation failed: ${state.error}`);

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (state.base64) fs.writeFileSync(out, Buffer.from(state.base64, "base64"));
  else if (state.url) {
    const res = await fetchImpl(state.url, { headers: state.authHeader || {} });
    if (!res.ok) throw new Error(`${name}: download failed HTTP ${res.status}`);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  } else throw new Error(`${name}: finished without a video URL or data.`);
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`${name}: downloaded file is empty.`);

  const provenance = {
    ai_generated: true,
    provider: name,
    model: req.body.model || req.body.model_name,
    endpoint: req.url,
    task_id: taskId,
    prompt,
    input_image_sha256: image.sha256,
    requested: { duration, aspect },
    created_at: new Date().toISOString(),
    verified_adapter: p.verified,
    note: "Generated by a third-party AI model. Check the provider's terms for usage rights.",
  };
  fs.writeFileSync(`${out}.provenance.json`, JSON.stringify(provenance, null, 2));
  return { ok: true, file: out, provider: name, model: provenance.model, taskId, provenance };
}
