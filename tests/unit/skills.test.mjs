// Skill discovery: every skill satisfies the Agent Skills spec and is reachable
// through each agent's discovery directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, validateSkillDir } from "../../scripts/validate-skills.mjs";

const SKILLS = path.resolve("skills");
const names = fs.readdirSync(SKILLS).filter((n) => fs.existsSync(path.join(SKILLS, n, "SKILL.md")));

test("eight skills: the vybe orchestrator plus seven specialists", () => {
  assert.deepEqual(names.sort(), ["vybe", "vybe-audio-design", "vybe-cinematic-3d", "vybe-image-to-motion", "vybe-motion-design", "vybe-typography", "vybe-video-quality", "vybe-visual-storytelling"]);
});

for (const n of names) {
  test(`skill ${n} is spec-valid`, () => {
    const r = validateSkillDir(path.join(SKILLS, n));
    assert.deepEqual(r.errs, []);
  });
}

test("frontmatter parser handles maps and quotes", () => {
  const fm = parseFrontmatter('---\nname: x\ndescription: "a: b"\nmetadata:\n  author: SJ BUILDS\n  version: "1.0.0"\n---\nbody');
  assert.equal(fm.data.description, "a: b");
  assert.deepEqual(fm.data.metadata, { author: "SJ BUILDS", version: "1.0.0" });
  assert.equal(fm.body, "body");
});

test("discovery directories resolve for Claude Code and .agents clients", () => {
  for (const d of [".claude/skills", ".agents/skills"]) {
    for (const n of names) assert.ok(fs.existsSync(path.join(d, n, "SKILL.md")), `${d}/${n}`);
  }
});

test("the master skill points at every specialist by its real name", () => {
  const master = fs.readFileSync(path.join(SKILLS, "vybe", "SKILL.md"), "utf8");
  for (const n of names.filter((x) => x !== "vybe")) assert.ok(master.includes(`\`${n}\``), n);
});
