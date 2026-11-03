// VYBE series kit — characters. Rigs face +x; legs have hip + knee so they can sit, walk and run.

// ── Humanoid rig (faces +x, ≈1.8 m) ─────────────────────────────────────────────────────────────
// Options: suit/trim colours, helmet (visor, rim, lamp) or a bare head with hair, backpack, chest light.
// `material` replaces every material (e.g. hologramMaterial() for a projected double).
// Rig: { root, body, torso, head, lamp, armL, armR, legL:{hip,knee}, legR, walk(phase, weight, amp), sit(), stand() }.
function makeHumanoid({ material, suit: suitColor = 0xe9edf1, trim = 0x9aa6b2, helmet = true, visor = 0x8a6514, skin = 0xe0b48f, hair = 0x1c1410, backpack = true, chest = 0x39d0ff } = {}) {
  const suit = material || std(suitColor, 0.05, 0.75), suitDark = material || std(trim, 0.2, 0.6);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.26, 0.42, 6, 14), suit, -0.02, 0.32, 0);
  if (backpack) add(torso, new THREE.BoxGeometry(0.22, 0.55, 0.44), suitDark, -0.3, 0.37, 0);
  if (!material && chest !== null) add(torso, new THREE.BoxGeometry(0.06, 0.12, 0.22), basic(chest), 0.24, 0.44, 0.08);
  const head = new THREE.Group(); head.position.set(0, 0.9, 0); torso.add(head);
  let lamp = null;
  if (helmet) {
    add(head, new THREE.SphereGeometry(0.27, 28, 20), suit, 0, 0, 0);
    const visorMat = material || new THREE.MeshStandardMaterial({ color: visor, metalness: 1, roughness: 0.18, emissive: 0x050505 });
    add(head, new THREE.SphereGeometry(0.255, 28, 20, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.38), visorMat, 0.035, 0, 0);
    const rim = add(head, new THREE.TorusGeometry(0.205, 0.022, 10, 40), material || std(0x3a4652, 0.6, 0.4), 0.2, 0, 0, 0, Math.PI / 2, 0); rim.scale.set(1, 0.78, 1);
    lamp = add(head, new THREE.SphereGeometry(0.04, 8, 6), basic(0xfff4d6), 0.12, 0.24, 0.12);
  } else {
    add(head, new THREE.SphereGeometry(0.17, 24, 18), material || std(skin, 0, 0.7), 0, -0.05, 0);
    add(head, new THREE.SphereGeometry(0.18, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), material || std(hair, 0, 0.9), -0.02, -0.02, 0);
    for (const z of [-0.06, 0.06]) add(head, new THREE.SphereGeometry(0.018, 8, 6), material || basic(0x0a0a0a), 0.16, -0.03, z);
  }
  const arm = (z) => { const p = new THREE.Group(); p.position.set(0.02, 0.64, z); torso.add(p); add(p, new THREE.CapsuleGeometry(0.085, 0.42, 4, 10), suit, 0, -0.27, 0); add(p, new THREE.SphereGeometry(0.095, 12, 10), suitDark, 0, -0.55, 0); return p; };
  const leg = (z) => {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, z); body.add(hip);
    add(hip, new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), suit, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.45, 0); hip.add(knee);
    add(knee, new THREE.CapsuleGeometry(0.1, 0.3, 4, 10), suit, 0, -0.2, 0);
    add(knee, new THREE.BoxGeometry(0.3, 0.12, 0.18), suitDark, 0.05, -0.43, 0);
    return { hip, knee };
  };
  const rig = { root, body, torso, head, lamp, armL: arm(0.33), armR: arm(-0.33), legL: leg(0.13), legR: leg(-0.13) };
  // Gaits: phase in radians, weight 0..1.
  rig.walk = (ph, w = 1, amp = 0.55) => {
    const s = Math.sin(ph);
    rig.legL.hip.rotation.z = s * amp * w; rig.legR.hip.rotation.z = -s * amp * w;
    rig.legL.knee.rotation.z = -Math.max(0, -Math.sin(ph)) * 0.7 * w; rig.legR.knee.rotation.z = -Math.max(0, Math.sin(ph)) * 0.7 * w;
    rig.armL.rotation.z = -s * amp * 0.7 * w; rig.armR.rotation.z = s * amp * 0.7 * w;
    body.position.y = Math.abs(Math.cos(ph)) * 0.05 * w;
  };
  rig.sit = () => { rig.legL.hip.rotation.z = rig.legR.hip.rotation.z = Math.PI / 2; rig.legL.knee.rotation.z = rig.legR.knee.rotation.z = -Math.PI / 2; body.position.y = -0.33; };
  rig.stand = () => { rig.walk(0, 0); };
  return rig;
}
const makeAstronaut = (opts = {}) => makeHumanoid({ helmet: true, backpack: true, ...opts });

// ── Child in a dress (≈1.1 m, faces +x): { root, body, head } ───────────────────────────────────
function makeChild({ skin: skinColor = 0xe8c4a8, dress: dressColor = 0xd9dde3, hair: hairColor = 0x1a1310 } = {}) {
  const skin = std(skinColor, 0, 0.7, { emissive: 0x1a1410 }), dress = std(dressColor, 0, 0.8, { emissive: 0x0c0d10 }), hair = std(hairColor, 0, 0.9);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  add(body, new THREE.ConeGeometry(0.27, 0.62, 18, 1, true), dress, 0, 0.62, 0);
  add(body, new THREE.CylinderGeometry(0.12, 0.16, 0.28, 14), dress, 0, 0.95, 0);
  for (const z of [-0.07, 0.07]) add(body, new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), skin, 0, 0.17, z);
  const head = new THREE.Group(); head.position.y = 1.2; body.add(head);
  add(head, new THREE.SphereGeometry(0.13, 20, 16), skin, 0, 0, 0);
  add(head, new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, -0.015, 0.02, 0);
  add(head, new THREE.CapsuleGeometry(0.09, 0.22, 4, 10), hair, -0.07, -0.13, 0);
  for (const z of [-0.045, 0.045]) add(head, new THREE.SphereGeometry(0.014, 8, 6), basic(0x0a0a0a), 0.12, 0.01, z);
  for (const z of [-0.17, 0.17]) { const a = add(body, new THREE.CapsuleGeometry(0.03, 0.3, 4, 8), skin, 0, 0.88, z); a.rotation.x = z > 0 ? 0.12 : -0.12; }
  return { root, body, head };
}
const makeGirl = makeChild;

// ── Shadow entity: a towering dark mass with cold eyes (group.userData.eyes) ────────────────────
function makeShadow(rand) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x020203 });
  for (let i = 0; i < 26; i++) { const r = 2 + rand() * 6; const m = add(g, new THREE.SphereGeometry(r, 16, 12), mat, (rand() - 0.5) * 18, 4 + rand() * 30, (rand() - 0.5) * 10); m.scale.y = 1.5 + rand() * 2.5; }
  for (let i = 0; i < 9; i++) { const m = add(g, new THREE.CylinderGeometry(0.4, 1.6, 26 + rand() * 18, 8), mat, (rand() - 0.5) * 26, 14, (rand() - 0.5) * 8); m.rotation.z = (rand() - 0.5) * 1.2; }
  const eyes = [];
  for (let i = 0; i < 7; i++) { const e = glow(0xbfe9ff, 1.2 + rand() * 1.6); e.position.set((rand() - 0.5) * 12, 18 + rand() * 14, 6); g.add(e); eyes.push(e); }
  g.userData.eyes = eyes;
  return g;
}
