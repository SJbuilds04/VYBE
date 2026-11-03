// VYBE series kit — places: a night city (sky dome with an openable rift) and an underground
// facility (stairwell, sliding doors, a hall with a floating machine).

// ── Night city: avenue along -z, dome uniforms uRift/uTime, tower at (30,0,-520) ────────────────
function makeCity(scene, origin, rand) {
  const g = new THREE.Group(); g.position.copy(origin); scene.add(g);
  // Sky dome: storm-dark gradient with a sick amber horizon.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uRift: { value: 0 }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform float uRift; uniform float uTime; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.16,0.12,0.10), vec3(0.03,0.04,0.07), smoothstep(-0.05, 0.45, h)); float crack = abs(vP.x * 1.6 + sin(vP.z * 9.0) * 0.08 + sin(vP.z * 23.0 + 1.3) * 0.03); float rift = uRift * smoothstep(0.08 * uRift + 0.004, 0.0, crack) * smoothstep(0.1, 0.35, h); c += vec3(0.9,0.35,1.0) * rift * 1.6 + vec3(0.4,0.15,0.6) * uRift * smoothstep(0.35 * uRift, 0.0, crack) * smoothstep(0.1, 0.4, h) * 0.35; gl_FragColor = vec4(c, 1.0); }",
  }));
  g.add(dome);
  add(g, new THREE.PlaneGeometry(400, 1200), std(0x23262b, 0.1, 0.95), 0, 0, -400, -Math.PI / 2);
  add(g, new THREE.PlaneGeometry(14, 1200), std(0x17191c, 0.1, 0.9), 0, 0.01, -400, -Math.PI / 2);
  for (let z = 0; z > -600; z -= 8) add(g, new THREE.PlaneGeometry(0.22, 3.2), std(0x8d8a7a, 0, 0.9), 0, 0.02, z, -Math.PI / 2);
  const winTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = "#2a2f36"; x.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) { const v = rand(); x.fillStyle = v > 0.97 ? "#b0894a" : v > 0.6 ? "#0d0f12" : "#161a1f"; x.fillRect(3 + k * 15, 3 + r * 8, 11, 5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  for (const side of [-1, 1]) for (let z = 10; z > -600; z -= 22 + rand() * 14) {
    const w = 10 + rand() * 12, d = 12 + rand() * 10, h = 18 + rand() * rand() * 90;
    const tex = winTex.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, w / 6), Math.max(1, h / 8));
    const b = add(g, new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 }), side * (16 + w / 2 + rand() * 4), h / 2, z);
    b.rotation.y = (rand() - 0.5) * 0.04;
  }
  for (let i = 0; i < 40; i++) { const s = 0.3 + rand() * 1.2; add(g, new THREE.BoxGeometry(s, s * 0.6, s), std(0x2e3238, 0.2, 0.9), (rand() - 0.5) * 22, s * 0.3, -rand() * 300, 0, rand() * 3, 0); }
  // Abandoned cars.
  for (let i = 0; i < 8; i++) { const c = new THREE.Group(); add(c, new THREE.BoxGeometry(4, 1, 1.8), std(0x2a3036, 0.4, 0.6), 0, 0.6, 0); add(c, new THREE.BoxGeometry(2.2, 0.7, 1.6), std(0x1b1f24, 0.5, 0.4), -0.2, 1.4, 0); c.position.set((rand() > 0.5 ? 1 : -1) * (4 + rand() * 3), 0, -20 - i * 34 - rand() * 10); c.rotation.y = (rand() - 0.5) * 0.6; g.add(c); }
  // The tower in the distance: a monolith with a cold light core.
  const tower = new THREE.Group(); tower.position.set(30, 0, -520); g.add(tower);
  add(tower, new THREE.BoxGeometry(40, 260, 40), std(0x101317, 0.6, 0.5), 0, 130, 0);
  const core = add(tower, new THREE.BoxGeometry(4, 240, 41), basic(0x6fe7ff), 0, 130, 0);
  const towerGlow = glow(0x6fe7ff, 120); towerGlow.position.set(0, 160, 25); tower.add(towerGlow);
  g.add(new THREE.HemisphereLight(0x3a4250, 0x0a0b0d, 0.9));
  const moon = new THREE.DirectionalLight(0x9fb2cc, 0.9); moon.position.set(-40, 80, 30); moon.target.position.set(0, 0, -100); g.add(moon, moon.target);
  return { group: g, dome, tower, core, towerGlow };
}

// ── Underground facility: stairwell → doors → hall with the floating machine ────────────────────
function makeFacility(scene, origin, rand) {
  const g = new THREE.Group(); g.position.copy(origin); scene.add(g);
  const concrete = std(0x2a2d31, 0.1, 0.95), metal = std(0x3b4350, 0.7, 0.4);
  // Stairwell: descending steps along -z from y=+8 to 0 (z 0 → -16), walls either side.
  for (let i = 0; i < 32; i++) add(g, new THREE.BoxGeometry(3, 0.25, 0.5), concrete, 0, 8 - i * 0.25, -i * 0.5);
  add(g, new THREE.BoxGeometry(0.3, 14, 18), concrete, -1.65, 5, -8); add(g, new THREE.BoxGeometry(0.3, 14, 18), concrete, 1.65, 5, -8);
  add(g, new THREE.BoxGeometry(3.6, 0.3, 18), concrete, 0, 11, -8);
  // Doors at z = -17.
  const doorL = add(g, new THREE.BoxGeometry(1.5, 4, 0.4), metal, -0.76, 2, -17), doorR = add(g, new THREE.BoxGeometry(1.5, 4, 0.4), metal, 0.76, 2, -17);
  for (const d of [doorL, doorR]) add(d, new THREE.BoxGeometry(0.05, 3.6, 0.42), basic(0x39d0ff), 0, 0, 0);
  // Hall: a huge cylinder room centred at z = -45.
  const hall = new THREE.Group(); hall.position.set(0, 0, -45); g.add(hall);
  add(hall, new THREE.CylinderGeometry(26, 26, 40, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.9, side: THREE.BackSide }), 0, 18, 0);
  add(hall, new THREE.CircleGeometry(26, 48), concrete, 0, 0, 0, -Math.PI / 2);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add(hall, new THREE.BoxGeometry(0.6, 36, 0.6), metal, Math.cos(a) * 25.4, 18, Math.sin(a) * 25.4); }
  add(hall, new THREE.RingGeometry(9, 9.4, 64), basic(0x39d0ff), 0, 0.02, 0, -Math.PI / 2);
  // The machine: a core with counter-rotating rings, floating above the floor.
  const machine = new THREE.Group(); machine.position.set(0, 12, 0); hall.add(machine);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x0b1620, emissive: 0x39d0ff, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 });
  const core = add(machine, new THREE.IcosahedronGeometry(2.4, 1), coreMat);
  const ringMat = std(0x8a96a6, 0.85, 0.3, { emissive: 0x0b2733 });
  const rings = [5, 6.6, 8.2].map((r, i) => { const m = add(machine, new THREE.TorusGeometry(r, 0.18 + i * 0.04, 12, 96), ringMat); m.rotation.x = i * 0.9; return m; });
  const coreGlow = glow(0x39d0ff, 22); machine.add(coreGlow);
  const machineLight = new THREE.PointLight(0x39d0ff, 160, 70, 1.6); machine.add(machineLight);
  // Holographic glyphs orbiting the machine.
  const glyphs = [];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    x.strokeStyle = "#7fe3ff"; x.lineWidth = 4; x.beginPath();
    for (let k = 0; k < 4; k++) { const px = 10 + rand() * 44, py = 10 + rand() * 44; k ? x.lineTo(px, py) : x.moveTo(px, py); }
    if (rand() > 0.5) x.arc(32, 32, 10 + rand() * 12, 0, Math.PI * (1 + rand()));
    x.stroke();
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x7fe3ff }));
    sp.userData = { r: 10 + rand() * 6, a: rand() * Math.PI * 2, y: 4 + rand() * 16, s: 0.08 + rand() * 0.12 };
    sp.scale.setScalar(1.4 + rand()); hall.add(sp); glyphs.push(sp);
  }
  const hallLight = new THREE.HemisphereLight(0x22313f, 0x050608, 0.6); hall.add(hallLight);
  const redLight = new THREE.PointLight(0xff2020, 0, 90, 1.4); redLight.position.set(0, 20, 0); hall.add(redLight);
  return {
    group: g, hall, doorL, doorR, machine, core, coreMat, rings, coreGlow, machineLight, glyphs, redLight, ringMat,
    tick(t, { spin = 1, red = 0, open = 0 } = {}) {
      doorL.position.x = -0.76 - 1.6 * open; doorR.position.x = 0.76 + 1.6 * open;
      rings.forEach((r, i) => { r.rotation.y = t * (0.12 + i * 0.07) * spin * (i % 2 ? -1 : 1); r.rotation.z = t * 0.05 * spin; });
      core.rotation.y = t * 0.2 * spin; machine.position.y = 12 + Math.sin(t * 0.8) * 0.35;
      glyphs.forEach((sp) => { const u = sp.userData, a = u.a + t * u.s * spin; sp.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.6 + u.a) * 0.6, Math.sin(a) * u.r); sp.material.color.set(red > 0.5 ? 0xff5050 : 0x7fe3ff); });
      const col = new THREE.Color(0x39d0ff).lerp(new THREE.Color(0xff2020), red);
      coreMat.emissive.copy(col); coreGlow.material.color.copy(col); machineLight.color.copy(col);
      redLight.intensity = 140 * red * (0.6 + 0.4 * Math.abs(Math.sin(t * 4)));
    },
  };
}
