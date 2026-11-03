// Shared helpers for the VYBE engine. Zero dependencies; Node >= 22.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const IS_WIN = process.platform === "win32";
export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// On Windows `npx`/`npm` are .cmd shims that Node can only start through cmd.exe,
// where quoting cannot be made safe for arbitrary text (narration lines reach the
// command line). Instead run npm's JS entry points with this Node binary: no shell.
const NPM_BIN = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin");
const JS_ENTRY = { npx: path.join(NPM_BIN, "npx-cli.js"), npm: path.join(NPM_BIN, "npm-cli.js") };

/** Resolve a command to a shell-free [file, args]. Throws when that is impossible. */
export function shellFree(cmd, args) {
  if (!IS_WIN || !/^(npx|npm)$/i.test(cmd)) return [cmd, args];
  const entry = JS_ENTRY[cmd.toLowerCase()];
  if (fs.existsSync(entry)) return [process.execPath, [entry, ...args]];
  // Last resort: a shell, but only for arguments cmd.exe cannot reinterpret.
  const unsafe = args.find((a) => /["%!^&|<>\r\n]/.test(String(a)));
  if (unsafe !== undefined) throw new Error(`Refusing to pass ${JSON.stringify(String(unsafe).slice(0, 40))} through cmd.exe; npm's npx-cli.js was not found next to node.`);
  return [null, [cmd, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")];
}

/**
 * Run a command synchronously. Never throws on non-zero exit; callers inspect
 * `status`. `ok` is true only when the binary ran and exited 0.
 */
export function run(cmd, args = [], opts = {}) {
  const spawnOpts = {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeout,
    input: opts.input,
    stdio: opts.inherit ? "inherit" : "pipe",
  };
  let res;
  try {
    const [file, fileArgs] = shellFree(cmd, args);
    res = file === null ? spawnSync(fileArgs, { ...spawnOpts, shell: true }) : spawnSync(file, fileArgs, spawnOpts);
  } catch (err) {
    res = { error: err, status: null };
  }
  return {
    ok: !res.error && res.status === 0,
    status: res.status,
    error: res.error ? String(res.error.message || res.error) : null,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

/** True when `bin` can be executed (probes `bin -version` / `--version`). */
export function has(bin, probeArgs = ["-version"]) {
  const r = run(bin, probeArgs, { timeout: 20000 });
  return r.ok;
}

export function ffprobeJson(file) {
  const r = run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file]);
  if (!r.ok) throw new Error(`ffprobe failed for ${file}: ${r.stderr.trim() || r.error}`);
  return JSON.parse(r.stdout);
}

export function mediaDuration(file) {
  const info = ffprobeJson(file);
  return Number(info.format?.duration || 0);
}

export function slugify(text, max = 48) {
  const slug = String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "vybe-video";
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

/**
 * Deep-copy `value`, rewriting absolute filesystem paths as paths relative to
 * `baseDir` (forward slashes). Used for everything VYBE writes to disk so project
 * files are portable and never leak the local directory layout.
 */
export function portable(value, baseDir) {
  if (typeof value === "string") {
    if (!path.isAbsolute(value) || !/[\\/]/.test(value) || /^[a-z]+:\/\//i.test(value)) return value;
    return path.relative(baseDir, value).replace(/\\/g, "/") || ".";
  }
  if (Array.isArray(value)) return value.map((v) => portable(v, baseDir));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, portable(v, baseDir)]));
  return value;
}

/** Seconds -> SRT timestamp (HH:MM:SS,mmm). */
export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

// Names of credentials VYBE may use. Only presence is ever reported, never values.
export const CREDENTIAL_ENV = {
  heygen: ["HEYGEN_API_KEY", "HEYGEN_ACCESS_TOKEN", "HYPERFRAMES_API_KEY", "HEYGEN_API_BASE"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  runway: ["RUNWAYML_API_SECRET"],
  luma: ["LUMA_AGENTS_API_KEY"],
  kling: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
};

export function credentialPresent(provider) {
  const names = CREDENTIAL_ENV[provider] || [];
  if (provider === "kling") return names.every((n) => Boolean(process.env[n]));
  if (provider === "heygen") {
    const home = process.env.HEYGEN_CONFIG_DIR || path.join(process.env.HOME || process.env.USERPROFILE || "", ".heygen");
    if (fs.existsSync(path.join(home, "credentials"))) return true;
  }
  return names.some((n) => Boolean(process.env[n]));
}

/** Locate an installed HyperFrames skill directory (media-use etc.). */
export function findSkillDir(name) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    path.join(process.cwd(), ".claude", "skills", name),
    path.join(process.cwd(), ".agents", "skills", name),
    path.join(home, ".claude", "skills", name),
    path.join(home, ".agents", "skills", name),
    path.join(home, ".codex", "skills", name),
    path.join(home, ".cursor", "skills", name),
    path.join(home, ".config", "opencode", "skills", name),
  ];
  return candidates.find((c) => fs.existsSync(path.join(c, "SKILL.md"))) || null;
}

export function log(...parts) {
  process.stderr.write(parts.join(" ") + "\n");
}
