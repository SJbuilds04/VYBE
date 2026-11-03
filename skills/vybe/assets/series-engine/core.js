// VYBE series engine — core. Shared by every episode of a series; inlined into each composition
// by `vybe series build`. Everything is a pure function of time: no clocks, no Math.random
// (seeded PRNG only), so any frame renders identically on any machine. Expects `THREE` in scope.

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const range = (t, a, b) => clamp01((t - a) / (b - a));
const pulse = (t, a, b, ramp = 0.3) => smooth(range(t, a, a + ramp)) - smooth(range(t, b - ramp, b));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, metal = 0.2, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
function radialTexture(stops, size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const DOT = radialTexture([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]], 64);
function glow(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); return s; }

// ── Renderer / scene ────────────────────────────────────────────────────────────────────────────
function createWorld(canvas, W, H, fov = 60) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.05, 4000);
  return { renderer, scene, camera, sets: {} };
}

// ── Stars (follow the camera) ───────────────────────────────────────────────────────────────────
function makeStars(scene, rand) {
  const sky = new THREE.Group(); scene.add(sky);
  for (const [n, r, size] of [[3200, 900, 2.6], [1400, 700, 3.6], [260, 500, 5.5]]) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
      const c = new THREE.Color().setHSL(0.58 + rand() * 0.08, 0.3, 0.75 + rand() * 0.25); col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    sky.add(new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, map: DOT, vertexColors: true, transparent: true, depthWrite: false })));
  }
  for (const [dir, col, s] of [[V(-0.6, 0.25, -0.75), "rgba(90,60,160,0.55)", 900], [V(0.7, -0.1, -0.7), "rgba(30,110,150,0.45)", 700], [V(0.2, 0.5, 0.85), "rgba(120,40,90,0.35)", 800]]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture([[0, col], [1, "rgba(0,0,0,0)"]], 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(dir.normalize().multiplyScalar(850)); sp.scale.set(s, s * 0.6, 1); sky.add(sp);
  }
  return sky;
}

// ── Hologram material (scanlines, fresnel, flicker) ─────────────────────────────────────────────
function hologramMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(0x6fe7ff) } },
    vertexShader: "varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uTime; uniform float uAlpha; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1.0 - clamp(abs(dot(vN, vV)), 0.0, 1.0), 2.0); float scan = 0.55 + 0.45 * sin(vW.y * 60.0 - uTime * 6.0); float flick = 0.85 + 0.15 * sin(uTime * 37.0) * sin(uTime * 13.0); float a = (0.18 + 0.82 * f) * scan * flick * uAlpha; gl_FragColor = vec4(uColor * a * 1.6, a); }",
  });
}

// ── Screen helpers (cockpit/HUD canvases) ───────────────────────────────────────────────────────
const CY = "#39d0ff", RED = "#ff3b3b";
function screenBase(x, w, h, title, t, red) {
  x.fillStyle = "#03080d"; x.fillRect(0, 0, w, h);
  x.font = "bold 26px monospace"; x.fillStyle = red ? RED : CY; x.textBaseline = "top"; x.textAlign = "left";
  x.fillText(title, 40, 30); x.fillText(`T+ ${(1204.55 + t).toFixed(2)}`, 760, 30); x.fillRect(40, 70, 944, 2);
}
function screenGlitch(x, w, h, t, amount) {
  const r = mulberry32(Math.floor(t * 30) + 7);
  for (let i = 0; i < Math.floor(amount * 6); i++) { const y = r() * h, hh = 4 + r() * 26, dx = (r() - 0.5) * 60 * amount; x.drawImage(x.canvas, 0, y, w, hh, dx, y, w, hh); }
}
function screenWave(x, w, t, active, color) {
  const r = mulberry32(Math.floor(t * 30));
  for (let i = 0; i < 64; i++) { const a = active ? (0.25 + 0.75 * r()) * (0.6 + 0.4 * Math.sin(i * 0.4 + t * 9)) : 0.05 + 0.05 * r(); const bh = a * 300; x.fillStyle = color; x.fillRect(60 + i * 14.4, 380 - bh / 2, 9, bh); }
}
function screenCentered(x, w, lines) { x.textAlign = "center"; for (const [txt, y, font, color] of lines) { x.font = font; x.fillStyle = color; x.fillText(txt, w / 2, y); } x.textAlign = "left"; }
function scanlines(x, w, h) { x.fillStyle = "rgba(0,0,0,0.25)"; for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1); }

// ── Paths: [t, x, y, z, ease?] waypoints sampled at 120 Hz → position, distance, speed ──────────
const EASE = { lin: (u) => u, out: (u) => 1 - (1 - u) * (1 - u), in: (u) => u * u, io: (u) => u * u * (3 - 2 * u) };
function track(points, duration = 60) {
  const at = (t) => {
    if (t <= points[0][0]) return points[0].slice(1, 4);
    for (let i = 1; i < points.length; i++) {
      const [t1, x1, y1, z1, e] = points[i], [t0, x0, y0, z0] = points[i - 1];
      if (t <= t1) { const u = (EASE[e] || EASE.lin)((t - t0) / (t1 - t0)); return [lerp(x0, x1, u), lerp(y0, y1, u), lerp(z0, z1, u)]; }
    }
    return points[points.length - 1].slice(1, 4);
  };
  const N = Math.ceil(duration * 120) + 1, P = [], D = new Float32Array(N), SP = new Float32Array(N);
  for (let i = 0; i < N; i++) { P.push(at(i / 120)); if (i) { const s = Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]); D[i] = D[i - 1] + s; SP[i] = s * 120; } }
  return (t) => { const i = Math.min(N - 1, Math.max(0, Math.round(t * 120))); let s = 0, c = 0; for (let k = -10; k <= 10; k++) { const j = i + k; if (j >= 0 && j < N) { s += SP[j]; c++; } } return { p: V(...P[i]), dist: D[i], speed: s / c }; };
}
// Seeded camera shake (deterministic).
function shake(t, amount) { return V(Math.sin(t * 37.1) * Math.sin(t * 11.3), Math.sin(t * 29.7 + 1) * Math.sin(t * 7.9), Math.sin(t * 23.3 + 2)).multiplyScalar(amount); }

// ── Stage: gradient sky dome + ground disc + key/fill light (a neutral outdoor set) ─────────────
function makeStage(scene, origin = V(0, 0, 0), { sky = 0x0b1220, horizon = 0x2a2f3a, ground = 0x1c1f24, size = 400 } = {}) {
  const g = new THREE.Group(); g.position.copy(origin); scene.add(g);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(size * 1.5, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new THREE.Color(sky) }, uHorizon: { value: new THREE.Color(horizon) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(uHorizon, uTop, smoothstep(-0.05, 0.5, vP.y)), 1.0); }",
  }));
  g.add(dome);
  add(g, new THREE.CircleGeometry(size, 64), std(ground, 0.05, 0.95), 0, 0, 0, -Math.PI / 2);
  g.add(new THREE.HemisphereLight(0x8fa3c0, 0x0b0c0f, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-20, 30, 20); g.add(key, key.target);
  return { group: g, dome, key };
}
