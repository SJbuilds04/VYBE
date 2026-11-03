// VYBE series kit — space: a ship, a cockpit set with a live canvas screen, a planet with
// switchable night lights, and instanced fleets. Needs the characters kit (the pilot).

// ── Spaceship (nose = +x): group with userData.tick(t, thrust) ──────────────────────────────────
function makeShip(rand) {
  const hull = std(0xc9d1d9, 0.55, 0.42), dark = std(0x3a4652, 0.6, 0.5), panel = std(0x1b2e4a, 0.4, 0.35, { emissive: 0x06121f });
  const ship = new THREE.Group();
  add(ship, new THREE.CylinderGeometry(1.1, 1.1, 13, 28), hull, 0, 0, 0, 0, 0, Math.PI / 2);
  add(ship, new THREE.SphereGeometry(1.1, 28, 16, 0, Math.PI), hull, 6.5, 0, 0, 0, Math.PI / 2, 0);
  add(ship, new THREE.BoxGeometry(0.9, 0.22, 1.5), basic(0x39d0ff), 6.9, 0.55, 0);
  add(ship, new THREE.TorusGeometry(3, 0.42, 14, 56), hull, 1.2, 0, 0, 0, Math.PI / 2, 0);
  for (let i = 0; i < 4; i++) add(ship, new THREE.CylinderGeometry(0.12, 0.12, 3, 8), dark, 1.2, 0, 0, (i * Math.PI) / 2);
  for (const z of [-4.2, 4.2]) { add(ship, new THREE.BoxGeometry(4.6, 0.06, 2.4), panel, -3, 0, z); add(ship, new THREE.BoxGeometry(0.2, 0.2, 1.6), dark, -3, 0, z * 0.62); }
  for (let i = 0; i < 9; i++) add(ship, new THREE.BoxGeometry(0.6 + rand(), 0.25, 0.4 + rand() * 0.5), dark, -5 + i * 1.25, 1.05, (rand() - 0.5) * 0.9);
  const glows = [];
  for (const z of [-0.6, 0.6]) {
    add(ship, new THREE.CylinderGeometry(0.45, 0.6, 1.2, 20), dark, -7.0, 0, z, 0, 0, Math.PI / 2);
    add(ship, new THREE.CircleGeometry(0.42, 20), basic(0x7fe3ff), -7.62, 0, z, 0, -Math.PI / 2, 0);
    const g = glow(0x5fd0ff, 3.2); g.position.set(-8.1, 0, z); ship.add(g); glows.push(g);
  }
  const red = add(ship, new THREE.SphereGeometry(0.12, 10, 8), basic(0xff3030), -3, 0, -5.45);
  const green = add(ship, new THREE.SphereGeometry(0.12, 10, 8), basic(0x30ff70), -3, 0, 5.45);
  const engine = new THREE.PointLight(0x5fd0ff, 30, 18, 2); engine.position.set(-8.5, 0, 0); ship.add(engine);
  ship.userData.tick = (t, thrust = 1) => {
    const b = Math.floor(t * 1.4) % 2 === 0 ? 1 : 0.15;
    red.material.color.setRGB(b, 0.12 * b, 0.12 * b); green.material.color.setRGB(0.12 * b, b, 0.35 * b);
    glows.forEach((g, i) => g.scale.setScalar((3.0 + 0.25 * Math.sin(t * 13 + i * 2)) * thrust));
    engine.intensity = 30 * thrust;
  };
  return ship;
}

// ── Cockpit set (console faces +x, side window on -z) ───────────────────────────────────────────
function makeCockpit(scene, origin, rand) {
  const g = new THREE.Group(); g.position.copy(origin); scene.add(g);
  const wall = std(0x1c242e, 0.5, 0.7), trim = std(0x2b3644, 0.6, 0.5), dark = std(0x3a4652, 0.6, 0.5);
  const box = (w, h, d, m, x, y, z) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  box(8, 0.1, 8, wall, 0, -2, 0); box(8, 0.1, 8, wall, 0, 2, 0); box(0.1, 4, 8, wall, -4, 0, 0); box(8, 4, 0.1, wall, 0, 0, 4);
  // Front wall (+x) with a forward window above the console.
  box(0.12, 1.2, 8, wall, 4, 1.4, 0); box(0.12, 1.6, 8, wall, 4, -1.2, 0); box(0.12, 1.2, 2.3, wall, 4, 0.2, -2.85); box(0.12, 1.2, 2.3, wall, 4, 0.2, 2.85);
  box(8, 1.3, 0.12, wall, 0, 1.35, -4); box(8, 1.1, 0.12, wall, 0, -1.45, -4); box(2.4, 1.6, 0.12, wall, -2.8, -0.1, -4); box(2.4, 1.6, 0.12, wall, 2.8, -0.1, -4);
  const strip = basic(0x39d0ff);
  for (const z of [-3.6, 3.6]) box(7, 0.04, 0.06, strip, 0, 1.9, z);
  box(1.2, 0.9, 3.4, trim, 2.1, -1.55, 0);
  const screenCanvas = document.createElement("canvas"); screenCanvas.width = 1024; screenCanvas.height = 640;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = add(g, new THREE.PlaneGeometry(1.6, 1.0), basic(0xffffff, { map: screenTex }), 2.25, -0.45, 0, 0, -Math.PI / 2, 0);
  add(g, new THREE.BoxGeometry(0.06, 1.12, 1.72), dark, 2.31, -0.45, 0);
  const screenLight = new THREE.PointLight(0x39d0ff, 6, 9, 2); screenLight.position.set(1.6, -0.4, 0); g.add(screenLight);
  const roomLight = new THREE.PointLight(0x9fb8d6, 4, 12, 2); roomLight.position.set(-1, 1.6, 0); g.add(roomLight);
  const alertLight = new THREE.PointLight(0xff2020, 0, 14, 2); alertLight.position.set(0, 1.7, 0); g.add(alertLight);
  const faceLight = new THREE.PointLight(0xffe2c4, 0, 4, 2); faceLight.position.set(0.9, -0.1, 0.8); g.add(faceLight);
  g.add(new THREE.HemisphereLight(0x1d2a3a, 0x06080c, 0.25));
  const seat = new THREE.Group(); seat.position.set(-0.55, -2, 0); g.add(seat);
  const seatMat = std(0x232b35, 0.3, 0.8);
  add(seat, new THREE.CylinderGeometry(0.1, 0.18, 0.5, 12), dark, 0, 0.25, 0);
  add(seat, new THREE.BoxGeometry(0.75, 0.14, 0.75), seatMat, 0, 0.55, 0);
  add(seat, new THREE.BoxGeometry(0.14, 1.0, 0.72), seatMat, -0.38, 1.05, 0);
  const astro = makeAstronaut(); astro.root.position.set(0, 0.62 - 0.6, 0); astro.sit(); seat.add(astro.root);
  const ctx = screenCanvas.getContext("2d");
  return {
    group: g, screen, screenTex, ctx, seat, astro, strip, screenLight, roomLight, alertLight, faceLight,
    setAlert(level, dark = 0, red = false) {
      strip.color.set(red ? 0xff2b2b : 0x39d0ff).multiplyScalar(lerp(red ? 0.3 + 0.7 * level : 1, 0.05, dark));
      alertLight.intensity = 60 * level; roomLight.intensity = 4 * (1 - dark) * (red ? 0.3 : 1);
      screenLight.color.set(red ? 0xff3b3b : 0x39d0ff); screenLight.intensity = lerp(6, 9, dark);
    },
  };
}

// ── Planet with switchable night lights (off between offStart and offEnd) ───────────────────────
function makeEarth(scene, center, R, rand, { offStart = 1e9, offEnd = 1e9 } = {}) {
  const earth = new THREE.Group(); earth.position.copy(center); scene.add(earth);
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
  const fbm = (x, y) => { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 5; i++) { a += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; } return a; };
  const EW = 1024, EH = 512, ec = document.createElement("canvas"); ec.width = EW; ec.height = EH;
  const ex = ec.getContext("2d"), img = ex.createImageData(EW, EH), land = new Float32Array(EW * EH);
  for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
    const lat = (y / EH - 0.5) * Math.PI, nx = Math.cos(lat) * Math.cos((x / EW) * Math.PI * 2), nz = Math.cos(lat) * Math.sin((x / EW) * Math.PI * 2);
    const h = fbm(nx * 2.2 + 5, (nz + Math.sin(lat)) * 2.2 + 3) - (Math.abs(lat) > 1.25 ? 0.2 : 0);
    const isLand = h > 0.53; land[y * EW + x] = isLand ? h : 0;
    const o = (y * EW + x) * 4;
    if (isLand) { img.data[o] = 38; img.data[o + 1] = 50; img.data[o + 2] = 66; } else { img.data[o] = 5; img.data[o + 1] = 13; img.data[o + 2] = 36; }
    img.data[o + 3] = 255;
  }
  ex.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(ec); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  earth.add(mesh);
  const sun = new THREE.DirectionalLight(0xbfd6ff, 1.4); sun.position.copy(center).add(V(-60, 25, -90)); sun.target = mesh; scene.add(sun);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uStrength: { value: 1 } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 3.0); gl_FragColor = vec4(vec3(0.25,0.55,1.0) * f * 1.4 * uStrength, f * uStrength); }",
  }));
  earth.add(atmo);
  const lights = [], centres = [];
  for (let tries = 0; centres.length < 170 && tries < 200000; tries++) { const x = Math.floor(rand() * EW), y = Math.floor((0.14 + rand() * 0.72) * EH); if (land[y * EW + x]) centres.push([x, y, 6 + Math.floor(rand() * rand() * 60)]); }
  for (const [cx, cy, n] of centres) for (let k = 0; k < n; k++) {
    const gss = () => (rand() + rand() + rand() - 1.5) * 2;
    const x = (cx + gss() * (2 + n * 0.12) + EW) % EW, y = Math.min(EH - 1, Math.max(0, cy + gss() * (1.5 + n * 0.08)));
    const lat = (0.5 - y / EH) * Math.PI, lon = (x / EW) * Math.PI * 2;
    lights.push({ p: V(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(R * 1.003), wave: (cx / EW) * Math.PI * 2 + rand() * 0.9 });
  }
  lights.sort((a, b) => a.wave - b.wave);
  const N = lights.length, lp = new Float32Array(N * 3), off = new Float32Array(N), sz = new Float32Array(N);
  lights.forEach((l, i) => { lp.set([l.p.x, l.p.y, l.p.z], i * 3); off[i] = offStart + (offEnd - offStart) * Math.sqrt((i + rand() * 3) / N); sz[i] = 2.2 + rand() * 3.2; });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3)); lg.setAttribute("aOff", new THREE.BufferAttribute(off, 1)); lg.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
  const lightMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: "attribute float aOff; attribute float aSize; uniform float uTime; uniform float uScale; varying float vA; void main(){ float d = uTime - aOff; vA = d < 0.0 ? 1.0 + 0.6 * smoothstep(-0.25, 0.0, d) : 1.0 - smoothstep(0.0, 0.18, d); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r) * vA; gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a, a); }",
  });
  earth.add(new THREE.Points(lg, lightMat));
  return { group: earth, mesh, atmo, lightMat, R, center };
}

// ── Fleet: instanced ships; place(i, rand) → { p, dir, on } (light-on time) ─────────────────────
function makeFleet(count, rand, { scale = 1, color = 0xb8c2cc, place } = {}) {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 6, 10); geo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(1.4, 0.2, 8, 24); ringGeo.rotateY(Math.PI / 2);
  const mat = std(color, 0.6, 0.4);
  const hulls = new THREE.InstancedMesh(geo, mat, count), rings = new THREE.InstancedMesh(ringGeo, mat, count);
  const lightPos = new Float32Array(count * 3), lightOn = new Float32Array(count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(scale, scale, scale);
  const data = [];
  for (let i = 0; i < count; i++) {
    const { p, dir, on } = place(i, rand);
    q.setFromUnitVectors(V(1, 0, 0), dir.clone().normalize());
    m.compose(p, q, s); hulls.setMatrixAt(i, m);
    const rp = p.clone().add(dir.clone().normalize().multiplyScalar(0.6 * scale)); m.compose(rp, q, s); rings.setMatrixAt(i, m);
    lightPos.set([p.x, p.y + 0.6 * scale, p.z], i * 3); lightOn[i] = on; data.push({ p, dir, on });
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lightPos, 3)); lg.setAttribute("aOn", new THREE.BufferAttribute(lightOn, 1));
  const lightMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uSize: { value: 4 } },
    vertexShader: "attribute float aOn; uniform float uTime; uniform float uSize; varying float vA; void main(){ vA = smoothstep(aOn, aOn + 0.12, uTime); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (1.0 + 2.0 * vA); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r) * vA; gl_FragColor = vec4(vec3(0.75, 0.93, 1.0) * a, a); }",
  });
  const group = new THREE.Group(); group.add(hulls, rings, new THREE.Points(lg, lightMat));
  return { group, hulls, rings, lightMat, data };
}
