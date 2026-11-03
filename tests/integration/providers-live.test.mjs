// OPTIONAL live provider tests. Skipped unless VYBE_LIVE_PROVIDER_TESTS=1 and the
// provider's own credential is in the environment. These spend the tester's credits,
// never the maintainer's; nothing about the key is printed or stored.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configured, generate } from "../../skills/vybe-image-to-motion/scripts/lib/providers.mjs";

const LIVE = process.env.VYBE_LIVE_PROVIDER_TESTS === "1";

for (const provider of ["runway", "luma", "gemini", "kling"]) {
  const skip = !LIVE ? "set VYBE_LIVE_PROVIDER_TESTS=1 to run" : !configured(provider) ? `${provider} credential not set` : false;
  test(`live image-to-video: ${provider}`, { skip, timeout: 1200000 }, async () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vybe-live-")), `${provider}.mp4`);
    const res = await generate({ provider, imagePath: path.resolve("tests/fixtures/landscape.jpg"), prompt: "slow cinematic push in, dust in the air, keep composition", out, duration: 5, aspect: "16:9" }, { log: () => {} });
    assert.ok(res.ok);
    assert.ok(fs.statSync(out).size > 10000);
    assert.ok(fs.existsSync(`${out}.provenance.json`));
  });
}
