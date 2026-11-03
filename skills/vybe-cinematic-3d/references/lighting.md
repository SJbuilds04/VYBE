# Lighting for motion graphics

## Rigs

| Rig | Setup (Three.js) | Look |
| --- | --- | --- |
| Three-point studio | key `DirectionalLight` 45° front-left high (1.0) · fill `HemisphereLight` (0.35) · rim `DirectionalLight` behind-right (1.4) | product, clean premium |
| Low-key cinematic | key `PointLight` warm, side, decay 1.6 · rim cool behind · weak hemisphere (0.2) · `FogExp2` | drama, mystery |
| High-key | strong hemisphere (0.9) + soft front key, light bg | Apple-minimal, friendly |
| Neon | two colored `PointLight`s (cyan / magenta) on opposite sides, emissive materials, dark fog | cyberpunk |
| Emissive-only | `MeshBasicMaterial` / emissive geometry, additive blending | experimental, data, sci-fi UI |

## Principles

- **Contrast hue between key and rim** (warm key / cool rim) for instant depth.
- **Motivate light**: if there is a visible light source (sun, screen, orb), the
  key comes from it.
- **Animate light, not just objects**: a light "finding" the subject is a reveal
  (`intensity: 0 → target` with smoothstep). Keep key:fill ratios fixed while doing it.
- **Fog sells scale**: `scene.fog = new THREE.FogExp2(bg, 0.03–0.06)` fades distant particles.
- In CSS/2D, fake light with radial-gradient pools (`mix-blend-mode: screen`) and
  a single consistent shadow direction (`box-shadow`/`drop-shadow` offset).
- Keep text legible over lit areas: put a soft dark radial behind type, or place
  type in the shadow side of the frame.

## PBR material starting points

| Surface | `MeshStandardMaterial` |
| --- | --- |
| Brushed metal | `metalness 0.9, roughness 0.35` |
| Glossy plastic | `metalness 0, roughness 0.15` |
| Matte | `metalness 0, roughness 0.9` |
| Glass (cheap) | `MeshPhysicalMaterial({ transmission: 1, roughness: 0.05, thickness: 0.5 })` — costly in software GL; prefer a tinted transparent standard material |
| Glowing core | `emissive: accent, emissiveIntensity: 1–3` + additive halo sprite |
