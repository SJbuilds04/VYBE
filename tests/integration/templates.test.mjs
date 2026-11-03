// Every template scaffolds into a real HyperFrames project that passes `hyperframes lint`,
// in its default format and in a second aspect ratio. Also checks the image-to-motion scaffold.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "../../skills/vybe/scripts/lib/util.mjs";

const VYBE = path.resolve("skills/vybe/scripts/vybe.mjs");
const I2M = path.resolve("skills/vybe-image-to-motion/scripts/i2m.mjs");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "vybe-tpl-"));
const TEMPLATES = ["cinematic", "product-ad", "explainer", "social-reel", "logo-reveal", "documentary", "kinetic-typography"];

function init(template, format) {
  const args = [VYBE, "init", "--", "integration test", "--template", template, "--out", OUT, "--name", `${template}-${format || "default"}`];
  if (format) args.push("--format", format);
  const r = run("node", args, { timeout: 300000 });
  assert.ok(r.ok, r.stderr);
  return JSON.parse(r.stdout).composition;
}

function lint(dir) {
  const r = run("npx", ["--yes", "hyperframes", "lint"], { cwd: dir, timeout: 300000 });
  return { ok: r.ok, out: (r.stdout + r.stderr).trim().split("\n").slice(-8).join("\n") };
}

for (const t of TEMPLATES) {
  test(`template ${t}: lint-clean in default and alternate formats`, { timeout: 600000 }, () => {
    for (const f of [null, t === "social-reel" ? "landscape" : "vertical"]) {
      const dir = init(t, f);
      const res = lint(dir);
      assert.ok(res.ok, `${t} ${f || "default"}:\n${res.out}`);
      assert.match(res.out, /0 errors/);
    }
  });
}

test("image-to-motion: layers + depth scaffolds lint clean (no AI, no removal)", { timeout: 600000 }, () => {
  for (const mode of ["layers", "depth"]) {
    const comp = path.join(OUT, `i2m-${mode}`, "composition");
    const r = run("node", [I2M, "scaffold", "--image", path.resolve("tests/fixtures/landscape.jpg"), "--prompt", "slow push in with dust", "--composition", comp, "--mode", mode, "--duration", "4", "--skip-removal"], { timeout: 300000 });
    assert.ok(r.ok, r.stderr);
    const plan = JSON.parse(fs.readFileSync(path.join(comp, "i2m-plan.json"), "utf8"));
    assert.equal(plan.method, "programmatic");
    assert.match(plan.note, /no subject motion was synthesized/);
    const res = lint(comp);
    assert.ok(res.ok, `${mode}:\n${res.out}`);
  }
});
