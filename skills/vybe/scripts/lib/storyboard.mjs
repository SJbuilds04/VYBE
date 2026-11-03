// Storyboard contract: storyboard.json is the machine-checkable plan the agent
// writes in Stage 3; storyboard.md is generated from it for humans.
import fs from "node:fs";

const REQUIRED_TEXT = ["composition", "background", "animation", "camera", "transition", "music"];
const READ_WPS = 3.2; // comfortable on-screen reading speed, words per second
const SPEAK_WPS = 2.6; // ~155 wpm narration

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

export function validateStoryboard(sb, { expectedDuration, voice = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!sb || typeof sb !== "object") return { ok: false, errors: ["storyboard.json is not an object"], warnings };
  if (!sb.title) errors.push("Missing top-level `title`.");
  if (!sb.concept) errors.push("Missing top-level `concept` (one-paragraph creative idea).");
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) {
    errors.push("`scenes` must be a non-empty array.");
    return { ok: false, errors, warnings };
  }

  const ids = new Set();
  let t = 0;
  const timeline = [];
  sb.scenes.forEach((s, i) => {
    const where = `scene ${i + 1}${s.id ? ` (${s.id})` : ""}`;
    if (!s.id) errors.push(`${where}: missing \`id\`.`);
    else if (ids.has(s.id)) errors.push(`${where}: duplicate id.`);
    ids.add(s.id);
    if (!(Number(s.duration) > 0)) errors.push(`${where}: \`duration\` must be a positive number of seconds.`);
    for (const k of REQUIRED_TEXT) if (!s[k] || !String(s[k]).trim()) errors.push(`${where}: missing \`${k}\`.`);
    if (!Array.isArray(s.text)) errors.push(`${where}: \`text\` must be an array of on-screen strings (may be empty).`);
    if (!Array.isArray(s.sfx)) errors.push(`${where}: \`sfx\` must be an array (may be empty).`);
    else s.sfx.forEach((fx, j) => {
      if (!fx || !fx.name) errors.push(`${where}: sfx[${j}] needs a \`name\`.`);
      if (fx && fx.at !== undefined && (fx.at < 0 || fx.at > s.duration)) errors.push(`${where}: sfx[${j}].at ${fx.at}s is outside the scene.`);
    });
    if (voice && typeof s.narration !== "string") errors.push(`${where}: voiceover is on, so \`narration\` must be a string ("" for a silent scene).`);

    const d = Number(s.duration) || 0;
    const onScreen = (s.text || []).reduce((n, line) => n + words(line), 0);
    if (d && onScreen / d > READ_WPS) warnings.push(`${where}: ${onScreen} on-screen words in ${d}s is hard to read (>${READ_WPS} words/s). Cut copy or extend the scene.`);
    if (s.narration && d && words(s.narration) / SPEAK_WPS > d + 0.3) {
      warnings.push(`${where}: narration needs ~${(words(s.narration) / SPEAK_WPS).toFixed(1)}s but the scene is ${d}s.`);
    }
    timeline.push({ id: s.id, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d;
  });

  const total = +t.toFixed(3);
  if (expectedDuration) {
    const diff = Math.abs(total - expectedDuration);
    const tol = Math.max(1, expectedDuration * 0.15);
    if (diff > tol) errors.push(`Scenes total ${total}s but the brief asks for ${expectedDuration}s (tolerance ±${tol.toFixed(1)}s).`);
    else if (diff > 0.5) warnings.push(`Scenes total ${total}s vs ${expectedDuration}s requested.`);
  }

  // Craft checks: monotony is the most common failure of generated videos.
  const fades = sb.scenes.filter((s) => /\bfade\b/i.test(`${s.transition} ${s.animation}`)).length;
  if (sb.scenes.length >= 3 && fades / sb.scenes.length > 0.5) warnings.push(`${fades}/${sb.scenes.length} scenes rely on fades. Vary transitions (match cut, mask wipe, zoom-through, whip, shape morph).`);
  const anims = sb.scenes.map((s) => String(s.animation || "").toLowerCase().trim());
  if (sb.scenes.length >= 3 && new Set(anims).size === 1) warnings.push("Every scene uses the same animation description. Give each scene its own motion idea.");
  const cams = sb.scenes.map((s) => String(s.camera || "").toLowerCase());
  if (sb.scenes.length >= 3 && cams.every((c) => /static|none|locked/.test(c))) warnings.push("No camera movement anywhere. Add at least one push, orbit, truck or parallax move.");
  const longest = Math.max(...sb.scenes.map((s) => Number(s.duration) || 0));
  if (longest > 12) warnings.push(`A ${longest}s scene is long for motion graphics; consider splitting it into beats.`);

  return { ok: errors.length === 0, errors, warnings, totalDuration: total, timeline };
}

export function validateStoryboardFile(file, opts) {
  if (!fs.existsSync(file)) return { ok: false, errors: [`${file} not found. Write storyboard.json first (see references/storyboard.md).`], warnings: [] };
  let sb;
  try {
    sb = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { ok: false, errors: [`storyboard.json is not valid JSON: ${err.message}`], warnings: [] };
  }
  return validateStoryboard(sb, opts);
}

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function storyboardMarkdown(sb) {
  let t = 0;
  const rows = sb.scenes.map((s, i) => {
    const start = t;
    t += Number(s.duration);
    return `| ${i + 1} | ${cell(s.id)} | ${start.toFixed(1)}–${t.toFixed(1)}s | ${cell(s.name || s.purpose || "")} | ${cell((s.text || []).join(" / ") || "—")} |`;
  });
  const details = sb.scenes.map((s, i) => {
    const fx = (s.sfx || []).map((f) => `${f.name}${f.at !== undefined ? ` @${f.at}s` : ""}`).join(", ") || "—";
    return `### ${i + 1}. ${s.name || s.id} — ${s.duration}s

- **Composition:** ${s.composition}
- **On-screen text:** ${(s.text || []).map((x) => `“${x}”`).join(", ") || "—"}
- **Background:** ${s.background}
- **Animation:** ${s.animation}
- **Camera:** ${s.camera}
- **Transition out:** ${s.transition}
- **Sound effects:** ${fx}
- **Music cue:** ${s.music}
- **Narration:** ${s.narration ? `“${s.narration}”` : "—"}${s.technique ? `\n- **Technique:** ${[].concat(s.technique).join(", ")}` : ""}`;
  });
  return `# Storyboard — ${sb.title}

> Generated from \`storyboard.json\` by \`vybe storyboard validate\`. Edit the JSON, not this file.

**Concept.** ${sb.concept}

${sb.music ? `**Music.** ${typeof sb.music === "string" ? sb.music : [sb.music.mood, sb.music.bpm && `${sb.music.bpm} BPM`, sb.music.notes].filter(Boolean).join(" · ")}\n` : ""}
| # | Scene | Time | Beat | Text |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

**Total:** ${t.toFixed(1)}s

${details.join("\n\n")}
`;
}
