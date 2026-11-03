// Unit tests for the Image-to-Motion engine: method selection and provider
// adapters (request shape, polling, download, errors) with a mocked fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyMotion, programmaticPlan } from "../../skills/vybe-image-to-motion/scripts/lib/plan.mjs";
import { PROVIDERS, generate, redact, imageInput } from "../../skills/vybe-image-to-motion/scripts/lib/providers.mjs";

const IMG = path.resolve("tests/fixtures/product.png");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vybe-i2m-"));

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  const restore = () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  return Promise.resolve().then(fn).finally(restore);
}

/** Scripted fetch: responds to each call in order; records requests. */
function mockFetch(responses) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return { ok: r.status ? r.status < 400 : true, status: r.status || 200, statusText: "x", text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {})), arrayBuffer: async () => Buffer.from(r.bytes || "") };
  };
  fn.calls = calls;
  return fn;
}

test("classify: organic motion → AI, camera motion → programmatic", () => {
  const walk = classifyMotion("Make the person appear to walk forward", { availableAi: ["runway"] });
  assert.equal(walk.method, "ai");
  assert.equal(walk.provider, "runway");
  for (const p of ["Make the clouds move and the camera slowly zoom in", "Create a realistic 3D parallax effect", "Make the background move while keeping the foreground subject stable", "Animate this image cinematically"]) {
    assert.equal(classifyMotion(p, { availableAi: ["runway"] }).method, "programmatic", p);
  }
  assert.equal(classifyMotion("make her smile and blink", { availableAi: ["luma"] }).method, "ai");
  assert.equal(classifyMotion("waves crashing on the shore", { availableAi: ["luma"] }).method, "ai");
});

test("classify: no provider → honest programmatic fallback; explicit method wins", () => {
  const r = classifyMotion("make the dog run", { availableAi: [] });
  assert.equal(r.recommended, "ai");
  assert.equal(r.method, "programmatic");
  assert.match(r.honestyNote, /NOT generated/);
  assert.equal(classifyMotion("make the dog run", { preferred: "programmatic", availableAi: ["runway"] }).method, "programmatic");
  assert.equal(classifyMotion("slow zoom", { preferred: "ai", availableAi: ["runway"] }).method, "ai");
});

test("programmatic plan maps words to camera, intensity, effects and mode", () => {
  const p = programmaticPlan("dramatic pull back reveal with snow and fog, 3D parallax");
  assert.deepEqual([p.camera, p.intensity, p.mode], ["pull", 1.4, "depth"]);
  assert.ok(p.effects.includes("snow") && p.effects.includes("fog"));
  assert.equal(programmaticPlan("gentle pan left").camera, "pan-left");
  assert.equal(programmaticPlan("make the product float").subjectSway, true);
});

test("runway: request shape follows the OpenAPI spec", () => {
  const req = PROVIDERS.runway.build.call(PROVIDERS.runway, { image: imageInput(IMG), prompt: "slow push", duration: 12, aspect: "9:16" });
  assert.equal(req.url, "https://api.dev.runwayml.com/v1/image_to_video");
  assert.equal(req.headers["X-Runway-Version"], "2024-11-06");
  assert.equal(req.body.model, "gen4.5");
  assert.equal(req.body.ratio, "720:1280");
  assert.equal(req.body.duration, 10, "clamped to 2–10");
  assert.match(req.body.promptImage, /^data:image\/png;base64,/);
  const veo = PROVIDERS.runway.build.call(PROVIDERS.runway, { image: imageInput(IMG), prompt: "x", duration: 5, aspect: "16:9", model: "veo3.1" });
  assert.equal(veo.body.duration, 4);
  assert.equal(veo.body.ratio, "1920:1080");
});

test("redact never leaks credentials", async () => {
  await withEnv({ RUNWAYML_API_SECRET: "secret-value-123" }, async () => {
    const req = PROVIDERS.runway.build.call(PROVIDERS.runway, { image: imageInput(IMG), prompt: "x", duration: 5, aspect: "16:9" });
    const s = JSON.stringify(redact(req));
    assert.ok(!s.includes("secret-value-123"));
    assert.match(s, /<redacted>/);
    const dry = await generate({ provider: "runway", imagePath: IMG, prompt: "x", out: "unused.mp4", dryRun: true });
    assert.ok(!JSON.stringify(dry).includes("secret-value-123"));
    assert.equal(dry.dryRun, true);
  });
});

test("runway: create → poll → download → provenance (mocked)", async () => {
  const out = path.join(tmp(), "clip.mp4");
  const fetchImpl = mockFetch([
    { body: { id: "task-1" } },
    { body: { id: "task-1", status: "RUNNING", progress: 0.5 } },
    { body: { id: "task-1", status: "SUCCEEDED", output: ["https://cdn.example/clip.mp4"] } },
    { bytes: "MP4DATA" },
  ]);
  await withEnv({ RUNWAYML_API_SECRET: "k" }, async () => {
    const r = await generate({ provider: "runway", imagePath: IMG, prompt: "push in", out, pollSeconds: 0 }, { fetchImpl, sleep: async () => {} });
    assert.equal(r.ok, true);
    assert.equal(r.taskId, "task-1");
    assert.equal(fs.readFileSync(out, "utf8"), "MP4DATA");
    const prov = JSON.parse(fs.readFileSync(`${out}.provenance.json`, "utf8"));
    assert.equal(prov.ai_generated, true);
    assert.equal(prov.provider, "runway");
    assert.ok(!JSON.stringify(prov).includes('"k"'));
    assert.equal(fetchImpl.calls[1].url, "https://api.dev.runwayml.com/v1/tasks/task-1");
  });
});

test("luma: failure state surfaces the provider's reason", async () => {
  const fetchImpl = mockFetch([{ body: { id: "g1", state: "queued" } }, { body: { id: "g1", state: "failed", failure_code: "moderation", failure_reason: "blocked" } }]);
  await withEnv({ LUMA_AGENTS_API_KEY: "k" }, async () => {
    await assert.rejects(generate({ provider: "luma", imagePath: IMG, prompt: "x", out: path.join(tmp(), "c.mp4"), pollSeconds: 0 }, { fetchImpl, sleep: async () => {} }), /moderation: blocked/);
    const body = JSON.parse(fetchImpl.calls[0].init.body);
    assert.equal(body.model, "ray-3.2");
    assert.equal(body.video.duration, "5s");
    assert.equal(body.video.start_frame.media_type, "image/png");
  });
});

test("gemini: base64 video in model_output is decoded", async () => {
  const out = path.join(tmp(), "g.mp4");
  const fetchImpl = mockFetch([
    { body: { id: "i1", status: "in_progress" } },
    { body: { id: "i1", status: "completed", steps: [{ type: "user_input" }, { type: "model_output", content: [{ type: "video", mime_type: "video/mp4", data: Buffer.from("VID").toString("base64") }] }] } },
  ]);
  await withEnv({ GEMINI_API_KEY: "k", GOOGLE_API_KEY: undefined }, async () => {
    const r = await generate({ provider: "gemini", imagePath: IMG, prompt: "x", out, aspect: "9:16", pollSeconds: 0 }, { fetchImpl, sleep: async () => {} });
    assert.equal(r.model, "gemini-omni-1.1-flash");
    assert.equal(fs.readFileSync(out, "utf8"), "VID");
    const body = JSON.parse(fetchImpl.calls[0].init.body);
    assert.equal(body.generation_config.video_config.task, "image_to_video");
    assert.equal(body.response_format.aspect_ratio, "9:16");
  });
});

test("kling: HS256 JWT with iss/exp/nbf claims", async () => {
  await withEnv({ KLING_ACCESS_KEY: "ak", KLING_SECRET_KEY: "sk" }, () => {
    const [h, b, s] = PROVIDERS.kling.token().split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "HS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(b, "base64url"));
    assert.equal(claims.iss, "ak");
    assert.ok(claims.exp > claims.nbf);
    assert.ok(s.length > 20);
  });
});

test("errors: unconfigured provider, HTTP errors, empty prompt", async () => {
  await withEnv({ RUNWAYML_API_SECRET: undefined }, async () => {
    await assert.rejects(generate({ provider: "runway", imagePath: IMG, prompt: "x", out: "x.mp4" }), /not configured/);
  });
  await withEnv({ RUNWAYML_API_SECRET: "k" }, async () => {
    const fetchImpl = mockFetch([{ status: 401, body: { error: "Invalid API key" } }]);
    await assert.rejects(generate({ provider: "runway", imagePath: IMG, prompt: "x", out: "x.mp4" }, { fetchImpl }), /HTTP 401: Invalid API key/);
  });
  await assert.rejects(generate({ provider: "runway", imagePath: IMG, prompt: "", out: "x.mp4" }), /prompt is required/);
  await assert.rejects(generate({ provider: "sora", imagePath: IMG, prompt: "x", out: "x.mp4" }), /Unknown provider/);
});
