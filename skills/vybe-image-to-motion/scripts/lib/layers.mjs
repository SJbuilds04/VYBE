// Layer separation for programmatic image motion:
//   subject.png  — foreground cut-out (HyperFrames' local background-removal model)
//   plate.png    — background with the subject hole filled by a blurred copy
//   depth.png    — pseudo depth map (white = near): subject mask + ground gradient
// Every step degrades gracefully: without a cut-out you still get a depth map
// from the gradient and a single-layer camera move.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const IS_WIN = process.platform === "win32";

// npx on Windows is a .cmd shim; run npm's npx-cli.js with this Node instead so
// file names never pass through cmd.exe.
const NPX_CLI = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");

function run(cmd, args, opts = {}) {
  let file = cmd, fileArgs = args;
  if (IS_WIN && cmd === "npx") {
    if (!fs.existsSync(NPX_CLI)) return { ok: false, stdout: opts.binary ? Buffer.alloc(0) : "", stderr: "npx-cli.js not found next to node; cannot run npx without a shell" };
    file = process.execPath;
    fileArgs = [NPX_CLI, ...args];
  }
  const encoding = opts.binary ? "buffer" : "utf8";
  const r = spawnSync(file, fileArgs, { encoding, timeout: opts.timeout || 900000, maxBuffer: 32 << 20 });
  return { ok: !r.error && r.status === 0, stdout: r.stdout || (opts.binary ? Buffer.alloc(0) : ""), stderr: String(r.stderr || r.error || "") };
}

export function probeImage(file) {
  const r = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]);
  if (!r.ok) throw new Error(`Cannot read image ${file}: ${r.stderr.trim()}`);
  const s = JSON.parse(r.stdout).streams[0];
  return { width: s.width, height: s.height, aspect: s.width / s.height };
}

/** Mean luma (0–255) and a coarse 3-color palette, for the analysis report. */
export function imageStats(file) {
  const r = run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "scale=64:-1,signalstats,metadata=print", "-f", "null", "-"]);
  const yavg = Number((r.stderr.match(/lavfi\.signalstats\.YAVG=([\d.]+)/) || [])[1] || NaN);
  const raw = run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "scale=3:1:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { binary: true }).stdout;
  const colors = [];
  for (let i = 0; i + 2 < raw.length && colors.length < 3; i += 3) colors.push("#" + [raw[i], raw[i + 1], raw[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
  return { meanLuma: isNaN(yavg) ? null : +yavg.toFixed(1), key: isNaN(yavg) ? null : yavg < 70 ? "low-key" : yavg > 170 ? "high-key" : "mid-key", palette: colors };
}

/** Fraction of the frame covered by a PNG's alpha (0–1), or null when unmeasurable. */
export function alphaCoverage(png) {
  const r = run("ffmpeg", ["-hide_banner", "-i", png, "-vf", "alphaextract,scale=128:-1,lut=y='if(gt(val,127),255,0)',signalstats,metadata=print", "-f", "null", "-"]);
  const m = r.stderr.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
  return m ? Number(m[1]) / 255 : null;
}

export function separateLayers(image, outDir, { skipRemoval = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const { width, height } = probeImage(image);
  const src = path.join(outDir, "source" + path.extname(image).toLowerCase());
  fs.copyFileSync(image, src);
  const subject = path.join(outDir, "subject.png");
  const plate = path.join(outDir, "plate.png");
  const depth = path.join(outDir, "depth.png");
  const notes = [];

  let cutout = false;
  if (!skipRemoval) {
    // `--background-output` is video-only in HyperFrames, so for stills we take the
    // cut-out and build the background plate ourselves below.
    const r = run("npx", ["--yes", "hyperframes", "remove-background", src, "-o", subject, "--json"], { timeout: 1800000 });
    cutout = r.ok && fs.existsSync(subject);
    if (!cutout) notes.push(`Subject separation unavailable (${(r.stderr || r.stdout).trim().split("\n").pop()}); using single-layer motion.`);
    else {
      // Sanity-check the matte: a sliver or the whole frame means the model found no real subject.
      const cov = alphaCoverage(subject);
      if (cov !== null && (cov < 0.02 || cov > 0.95)) {
        cutout = false;
        notes.push(`Cut-out covers ${(cov * 100).toFixed(1)}% of the frame — no clear subject found; using single-layer motion.`);
      }
    }
  } else notes.push("Subject separation skipped by request.");

  // Plate: the original with the (dilated) subject region replaced by a heavily
  // blurred copy, so parallax never exposes a sharp duplicate or a hole.
  const sigma = Math.round(Math.min(width, height) / 25);
  const fill = cutout
    ? ["-i", src, "-i", subject, "-filter_complex",
       `[0:v]format=gbrp,split[a][b];[b]gblur=sigma=${sigma}[bl];` +
       `[1:v]alphaextract,scale=${width}:${height},gblur=sigma=${Math.max(4, sigma / 4)},lut=y='if(gt(val,12),255,0)',gblur=sigma=${Math.max(3, sigma / 6)},format=gray,format=gbrp[m];` +
       `[a][bl][m]maskedmerge`, "-frames:v", "1", plate]
    : ["-i", src, "-frames:v", "1", plate];
  if (!run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...fill]).ok) throw new Error("Could not build the background plate.");

  // Depth: ground gradient (top far → bottom nearer) lightened by the soft subject mask.
  const grad = `gradients=s=${width}x${height}:c0=0x101010:c1=0x707070:x0=0:y0=0:x1=0:y1=${height}:nb_colors=2,format=gray`;
  const depthArgs = cutout
    ? ["-f", "lavfi", "-i", grad, "-i", subject, "-filter_complex", `[1:v]alphaextract,gblur=sigma=${Math.round(Math.min(width, height) / 90)},format=gray[m];[0:v][m]blend=all_mode=lighten`, "-frames:v", "1", depth]
    : ["-f", "lavfi", "-i", grad, "-frames:v", "1", depth];
  if (!run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...depthArgs]).ok) notes.push("Depth map generation failed; depth mode will use a flat gradient.");

  return { width, height, source: src, subject: cutout ? subject : null, plate, depth: fs.existsSync(depth) ? depth : null, cutout, notes };
}
