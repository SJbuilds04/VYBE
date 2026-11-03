// Decides HOW to animate an image: programmatic (camera/parallax/particles/light,
// identity-preserving, free, deterministic) or AI image-to-video (organic or
// physical motion that pixels must actually change for).

const AI_CUES = [
  [/\b(walk|walks|walking|run|runs|running|jump|jumps|dance|dances|dancing|swim|fly|flies|flying)\b/, "body or creature locomotion"],
  [/\b(smile|smiles|smiling|blink|blinks|wink|laugh|cry|talk|talks|talking|speak|speaks|sing|expression|facial|face moves|look(s)? (at|toward|around)|turn(s)? (his|her|their|its) head)\b/, "facial expression or head movement"],
  [/\b(wave|waves|waving) (hand|hello|goodbye|at)\b|\b(hug|fight|eat|drink|pour|pick(s)? up|throw|catch)\b/, "hand or body action"],
  [/\b(hair|cloth|dress|cape|flag|leaves|branches|grass|flames?) (blow|blowing|flutter|sway|swaying|moving|waving)\b/, "organic secondary motion"],
  [/\b(water|waves?|river|ocean|sea|waterfall|smoke|fire) (flow|flowing|crash|crashing|ripple|rippling|rising|spreading|move|moving)\b/, "fluid or physical simulation"],
  [/\b(melt|melts|explode|explodes|shatter|transform(s)? into|morph(s)? into|grow(s)? into|come(s)? to life|bloom(s)? open)\b/, "physical transformation"],
  [/\b(realistic|photoreal|lifelike|natural) (motion|movement|animation)\b/, "explicitly realistic motion"],
  [/\b(360|full turn|turntable|spin(s)? around fully|rotate(s)? 360)\b/, "unseen sides of the subject must be invented"],
];

const PROGRAMMATIC_CUES = [
  [/\b(zoom(s|ing)?|push(es)? in|pull(s)? (out|back)|dolly|ken burns|punch[- ]in)\b/, "camera zoom/dolly"],
  [/\b(pan|panning|truck|tilt|crane|camera (move|moves|movement|slowly|drift))\b/, "camera move"],
  [/\b(parallax|2\.5d|depth|3d effect|layers?)\b/, "parallax/depth"],
  [/\b(particles?|dust|sparkles?|snow|rain|embers|bokeh|stars)\b/, "particle overlay"],
  [/\b(light|glow|flare|lens flare|god ?rays|shimmer|sweep|lighting)\b/, "lighting effect"],
  [/\b(fog|mist|haze|clouds? (move|moving|drift|drifting))\b/, "atmosphere drift"],
  [/\b(background (move|moves|moving|drifts?)|keep(ing)? the (foreground|subject) (stable|still))\b/, "layer separation"],
  [/\b(sway|float|floating|bob|hover|breathe|gentle (rotation|tilt))\b/, "subtle object motion"],
  [/\b(cinematic(ally)?|subtle|slow(ly)?)\b/, "cinematic camera language"],
];

export function classifyMotion(prompt, { preferred = "auto", availableAi = [] } = {}) {
  const t = String(prompt || "").toLowerCase();
  const ai = AI_CUES.filter(([re]) => re.test(t)).map(([, why]) => why);
  const prog = PROGRAMMATIC_CUES.filter(([re]) => re.test(t)).map(([, why]) => why);

  let recommended;
  if (preferred === "programmatic" || preferred === "ai") recommended = preferred;
  else if (ai.length) recommended = "ai";
  else recommended = "programmatic";

  const result = {
    recommended,
    method: recommended,
    reasons: recommended === "ai" ? ai : prog.length ? prog : ["camera and atmosphere motion preserve the image exactly"],
    aiCues: ai,
    programmaticCues: prog,
    hybrid: ai.length > 0 && prog.length > 0,
    fallback: null,
    honestyNote: null,
  };
  if (result.method === "ai" && !availableAi.length) {
    result.method = "programmatic";
    result.fallback = "no image-to-video provider configured";
    result.honestyNote = `The request needs ${ai.join(", ") || "AI motion"}, which programmatic animation cannot produce. Deliver camera/parallax motion and tell the user that realistic subject motion was NOT generated; configure RUNWAYML_API_SECRET, LUMA_AGENTS_API_KEY or GEMINI_API_KEY to enable it.`;
  }
  if (result.method === "ai") result.provider = availableAi[0];
  return result;
}

/** Turn a prompt into programmatic motion parameters for the parallax templates. */
export function programmaticPlan(prompt, { duration = 8 } = {}) {
  const t = String(prompt || "").toLowerCase();
  const camera =
    /pull(s)? (out|back)|reveal/.test(t) ? "pull" :
    /pan(ning)? left|truck left/.test(t) ? "pan-left" :
    /pan|truck/.test(t) ? "pan-right" :
    /orbit|around|rotate|rotation/.test(t) ? "orbit" :
    /rise|crane|up\b/.test(t) ? "rise" : "push";
  const intensity = /dramatic|strong|intense|fast|bold/.test(t) ? 1.4 : /subtle|gentle|slow|calm/.test(t) ? 0.6 : 1;
  const effects = [];
  if (/dust|particles?|embers|sparkles?|bokeh|stars/.test(t)) effects.push("particles");
  if (/snow/.test(t)) effects.push("snow");
  if (/rain/.test(t)) effects.push("rain");
  if (/light|glow|flare|sweep|god ?rays|cinematic/.test(t)) effects.push("light-sweep");
  if (/fog|mist|haze|cloud/.test(t)) effects.push("fog");
  if (!effects.length) effects.push("light-sweep");
  const mode = /depth|3d|parallax|2\.5d|realistic/.test(t) ? "depth" : "layers";
  return { mode, camera, intensity, effects, duration, subjectSway: /sway|float|bob|hover|breathe/.test(t) };
}
