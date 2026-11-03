// Parses a /vybe invocation (flags + free text) into a normalized brief.
// Deterministic: the same invocation always yields the same brief, so the agent
// can rely on it instead of re-deriving defaults by hand.
import fs from "node:fs";
import path from "node:path";
import { slugify } from "./util.mjs";

export const FORMATS = {
  landscape: { width: 1920, height: 1080, resolution: "landscape", aspect: "16:9" },
  vertical: { width: 1080, height: 1920, resolution: "portrait", aspect: "9:16" },
  square: { width: 1080, height: 1080, resolution: "square", aspect: "1:1" },
  "landscape-4k": { width: 3840, height: 2160, resolution: "landscape-4k", aspect: "16:9" },
  "vertical-4k": { width: 2160, height: 3840, resolution: "portrait-4k", aspect: "9:16" },
  "square-4k": { width: 2160, height: 2160, resolution: "square-4k", aspect: "1:1" },
};

const FORMAT_ALIASES = {
  landscape: "landscape", horizontal: "landscape", "16:9": "landscape", widescreen: "landscape", youtube: "landscape",
  vertical: "vertical", portrait: "vertical", "9:16": "vertical", reel: "vertical", reels: "vertical", tiktok: "vertical", shorts: "vertical", story: "vertical",
  square: "square", "1:1": "square",
  "4k": "landscape-4k", "landscape-4k": "landscape-4k", "vertical-4k": "vertical-4k", "portrait-4k": "vertical-4k", "square-4k": "square-4k",
};

export const STYLES = ["apple-minimal", "cinematic", "cyberpunk", "scientific", "kinetic-typography", "corporate", "experimental"];

const STYLE_ALIASES = {
  apple: "apple-minimal", "apple-minimal": "apple-minimal", minimal: "apple-minimal", minimalist: "apple-minimal", premium: "apple-minimal", clean: "apple-minimal",
  cinematic: "cinematic", film: "cinematic", epic: "cinematic", dramatic: "cinematic", trailer: "cinematic",
  cyberpunk: "cyberpunk", neon: "cyberpunk", synthwave: "cyberpunk", futuristic: "cyberpunk", "sci-fi": "cyberpunk",
  scientific: "scientific", science: "scientific", educational: "scientific", molecular: "scientific", medical: "scientific",
  kinetic: "kinetic-typography", "kinetic-typography": "kinetic-typography", typography: "kinetic-typography", lyric: "kinetic-typography",
  corporate: "corporate", business: "corporate", enterprise: "corporate", professional: "corporate",
  experimental: "experimental", abstract: "experimental", generative: "experimental", glitch: "experimental", procedural: "experimental",
};

export const TEMPLATES = ["cinematic", "product-ad", "explainer", "social-reel", "logo-reveal", "documentary", "kinetic-typography"];

// Ordered: the first matching rule wins.
const TEMPLATE_RULES = [
  { template: "logo-reveal", re: /\blogo\b|\bsting\b|\bident\b|brand reveal/ },
  { template: "kinetic-typography", re: /kinetic|typograph|lyric|word[- ]by[- ]word|music video/ },
  { template: "social-reel", re: /\breels?\b|tiktok|shorts\b|instagram|social (post|video|clip)|\b(ig|instagram|snapchat) stor(y|ies)\b/ },
  { template: "product-ad", re: /\bads?\b|advert|commercial|product|launch|showcase|promo|iphone|app store/ },
  { template: "documentary", re: /documentar|history of|archival|retrospective/ },
  { template: "explainer", re: /explain|explainer|how (does|do|to)|what (is|are)|tutorial|educational|teach|breakdown/ },
  { template: "cinematic", re: /./ },
];

const DEFAULT_DURATION = {
  "logo-reveal": 8, "kinetic-typography": 18, "social-reel": 20, "product-ad": 30,
  documentary: 40, explainer: 40, cinematic: 30,
};

const QUALITY = { draft: "draft", standard: "looks", looks: "looks", high: "delivery", delivery: "delivery" };
export const VOICE_PROVIDERS = ["heygen", "elevenlabs", "kokoro", "gemini"];
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|bmp)$/i;

// Flags that consume the next token as a value.
const VALUE_FLAGS = new Set([
  "format", "duration", "style", "quality", "fps", "project", "image", "motion", "provider",
  "name", "out", "max-fixes", "voice-id", "voice-provider", "template", "lang", "music-provider",
]);

/** Split a raw invocation string into tokens, honoring quotes. */
export function tokenize(raw) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(raw))) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

function parseDurationValue(v) {
  const s = String(v).trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] && m[2].startsWith("m") ? n * 60 : n;
}

/** Find a duration stated in prose, e.g. "a 30-second video", "1 minute", "45s". */
export function durationFromText(text) {
  const t = text.toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*-?\s*(seconds?|secs?|s\b|minutes?|mins?\b)/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].startsWith("m") ? Math.round(n * 60) : n;
}

export function inferFormat(text) {
  const t = text.toLowerCase();
  if (/\b(vertical|portrait|9:16|tiktok|shorts|reels?|instagram story|stories)\b/.test(t)) return "vertical";
  if (/\b(square|1:1|instagram post|feed post)\b/.test(t)) return "square";
  if (/\b4k\b/.test(t)) return "landscape-4k";
  return "landscape";
}

// Prose cues are stricter than flag aliases: an ambiguous word ("futuristic",
// "clean") leaves the choice to the creative director instead of forcing a preset.
const PROSE_STYLE_RULES = [
  { style: "apple-minimal", re: /apple[- ]?(style|like|esque)|\bminimal(ist)?\b/ },
  { style: "cyberpunk", re: /cyberpunk|\bneon\b|synthwave|blade runner/ },
  { style: "kinetic-typography", re: /kinetic|typograph|lyric/ },
  { style: "scientific", re: /scientific|molecul|anatom|\bcells?\b|\bdna\b|physics|astronom|black holes?/ },
  { style: "corporate", re: /corporate|business|enterprise|investor|quarterly|b2b/ },
  { style: "experimental", re: /experimental|abstract|generative|glitch|procedural|psychedelic/ },
  { style: "cinematic", re: /cinematic|\bepic\b|dramatic|trailer|\bfilm\b/ },
];

export function inferStyle(text) {
  const t = text.toLowerCase();
  return PROSE_STYLE_RULES.find((r) => r.re.test(t))?.style || null;
}

export function inferTemplate(text) {
  const t = text.toLowerCase();
  return TEMPLATE_RULES.find((r) => r.re.test(t)).template;
}

const FILLER = new Set("a an the create make generate build produce render me my our of for about on with and to in that this video videos clip animation animated short small second seconds sec min minute minutes long style styled using please where some other which who is are portrait vertical landscape square narration narrated background".split(" "));

/** A short, readable project name from the prompt: "Create a cinematic 30-second video explaining black holes" → "cinematic-explaining-black-holes". */
export function projectName(prompt) {
  const words = String(prompt || "").toLowerCase().replace(/\d+\s*-?\s*(seconds?|secs?|s|minutes?|mins?)\b/g, " ").split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 5).join("-");
}

function normalizeFormat(v) {
  const key = FORMAT_ALIASES[String(v).toLowerCase()];
  if (!key) throw new Error(`Unknown --format "${v}". Use landscape, vertical, square, landscape-4k, vertical-4k or square-4k.`);
  return key;
}

/**
 * Parse an invocation. Accepts either a raw string or a token array.
 * Returns { brief, warnings }.
 */
export function parseInvocation(input, { cwd = process.cwd() } = {}) {
  const tokens = Array.isArray(input) ? [...input] : tokenize(String(input || ""));
  // "/vybe" may arrive mangled into a path by MSYS shells (C:/Program Files/Git/vybe).
  if (tokens[0] && /(^|[\\/])vybe$/i.test(tokens[0])) tokens.shift();

  const flags = {};
  const images = [];
  const words = [];
  const warnings = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.startsWith("--")) {
      const maybePath = path.resolve(cwd, tok);
      if (IMAGE_EXT.test(tok) && fs.existsSync(maybePath)) images.push(maybePath);
      else words.push(tok);
      continue;
    }
    let [name, inline] = tok.slice(2).split(/=(.*)/s);
    name = name.toLowerCase();
    if (name === "voice") {
      // --voice, --voice=kokoro, or --voice kokoro
      const next = inline ?? (VOICE_PROVIDERS.includes(String(tokens[i + 1]).toLowerCase()) ? tokens[++i] : undefined);
      flags.voice = next ? next.toLowerCase() : true;
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const value = inline ?? tokens[++i];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      if (name === "image") images.push(path.resolve(cwd, value));
      else flags[name] = value;
      continue;
    }
    if (["no-music", "no-sfx", "no-voice", "review", "no-captions", "captions", "social", "yes"].includes(name)) {
      flags[name] = true;
      continue;
    }
    warnings.push(`Unknown flag --${name} ignored.`);
  }

  const prompt = words.join(" ").trim();
  const templateHint = flags.template;
  if (templateHint && !TEMPLATES.includes(templateHint)) throw new Error(`Unknown --template "${templateHint}". Use one of: ${TEMPLATES.join(", ")}.`);
  const template = templateHint || inferTemplate(prompt || "cinematic");

  // Template-native format wins over the global landscape default (a reel is vertical).
  const formatKey = flags.format ? normalizeFormat(flags.format) : inferFormat(prompt) !== "landscape" ? inferFormat(prompt) : template === "social-reel" ? "vertical" : "landscape";
  const format = { key: formatKey, ...FORMATS[formatKey] };

  let duration = null;
  let durationSource = "inferred";
  if (flags.duration) {
    duration = parseDurationValue(flags.duration);
    if (!duration) throw new Error(`Invalid --duration "${flags.duration}". Use seconds, e.g. --duration 30.`);
    durationSource = "flag";
  } else if (durationFromText(prompt)) {
    duration = durationFromText(prompt);
    durationSource = "prompt";
  } else {
    duration = DEFAULT_DURATION[template];
  }
  if (duration < 2 || duration > 600) throw new Error(`Duration ${duration}s is outside VYBE's supported 2–600s range.`);

  let style = { preset: null, custom: null, source: "inferred" };
  if (flags.style) {
    const preset = STYLE_ALIASES[flags.style.toLowerCase()];
    style = preset ? { preset, custom: null, source: "flag" } : { preset: null, custom: flags.style, source: "flag" };
  } else {
    const preset = inferStyle(prompt);
    style = { preset: preset || (template === "kinetic-typography" ? "kinetic-typography" : null), custom: null, source: preset ? "prompt" : "director" };
  }

  const fps = flags.fps ? Number(flags.fps) : 30;
  if (![24, 25, 30, 50, 60].includes(fps)) throw new Error(`Unsupported --fps ${flags.fps}. Use 24, 25, 30, 50 or 60.`);

  const qualityKey = (flags.quality || "high").toLowerCase();
  if (!QUALITY[qualityKey]) throw new Error(`Unknown --quality "${flags.quality}". Use draft, standard or high.`);

  const voiceRequestedInText = /\b(narrat\w*|voice[- ]?over|voiceover|voiced|narrator|spoken)\b/i.test(prompt) && !/\bno (narration|voice)/i.test(prompt);
  let voice = { enabled: false, provider: "auto", voiceId: flags["voice-id"] || null, source: "default" };
  if (flags["no-voice"]) voice = { ...voice, enabled: false, source: "flag" };
  else if (flags.voice) {
    const provider = flags.voice === true ? flags["voice-provider"] || "auto" : flags.voice;
    if (provider !== "auto" && !VOICE_PROVIDERS.includes(provider)) throw new Error(`Unknown voice provider "${provider}". Use ${VOICE_PROVIDERS.join(", ")}.`);
    voice = { ...voice, enabled: true, provider, source: "flag" };
  } else if (voiceRequestedInText) voice = { ...voice, enabled: true, source: "prompt" };
  voice.suggested = !voice.enabled && ["explainer", "documentary"].includes(template);

  const motion = (flags.motion || "auto").toLowerCase();
  if (!["auto", "programmatic", "ai"].includes(motion)) throw new Error(`Unknown --motion "${flags.motion}". Use auto, programmatic or ai.`);

  const maxFixes = flags["max-fixes"] !== undefined ? Number(flags["max-fixes"]) : 3;
  if (!Number.isInteger(maxFixes) || maxFixes < 0 || maxFixes > 10) throw new Error("--max-fixes must be an integer 0–10.");

  const missingImages = images.filter((p) => !fs.existsSync(p));
  if (missingImages.length) throw new Error(`Image not found: ${missingImages.join(", ")}`);
  if (flags.project && !fs.existsSync(path.resolve(cwd, flags.project))) throw new Error(`--project path not found: ${flags.project}`);

  const brief = {
    prompt,
    name: slugify(flags.name || projectName(prompt) || template),
    template,
    format,
    duration: { seconds: duration, source: durationSource },
    fps,
    quality: { key: qualityKey, hyperframes: QUALITY[qualityKey] },
    style,
    voice,
    music: { enabled: !flags["no-music"] },
    sfx: { enabled: !flags["no-sfx"] },
    captions: { enabled: flags["no-captions"] ? false : flags.captions ? true : voice.enabled },
    review: Boolean(flags.review),
    project: flags.project ? path.resolve(cwd, flags.project) : null,
    images,
    imageMotion: images.length ? { method: motion, provider: flags.provider || "auto" } : null,
    outDir: path.resolve(cwd, flags.out || "vybe-output"),
    maxFixAttempts: maxFixes,
    socialCopy: Boolean(flags.social),
    lang: flags.lang || "en",
  };
  if (!prompt && !images.length && !brief.project) warnings.push("No subject given: ask the user what the video is about before continuing.");
  return { brief, warnings };
}
