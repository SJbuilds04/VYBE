# Quality report — cinematic-teaser

Each render is checked by `vybe qc` (deterministic FFmpeg checks) and then visually reviewed by the agent from the extracted frames. Fix budget: 3 attempts.

## Attempt 1 — technical pass

- File: `renders/render-01.mp4` (3.54 MB)
- Video: 1920×1080, 30 fps, h264/yuv420p, 10s (composition 10s)
- Audio: aac, 2ch, 10s; -15.8 LUFS integrated, -3 dBFS peak, LRA 3.5
- Black segments: none
- Frozen segments ≥2s: none

**Visual review** (agent fills this in after looking at `previews/qc-01`)

- Vision used: yes (contact sheet + both sides of each cut)
- Composition & hierarchy: strong single focal point per act; title framed by the halo ring.
- Typography (overlap, clipping, safe zones): no overlap or clipping; captions inside the letterbox safe area.
- Motion & transitions (cut boundary frames): s1→s2 blur-forward dissolve and s2→s3 masked exit read as designed.
- Audio sync (captions, SFX on hits): captions highlight word by word in time with the narration.
- Defects found → fixes applied:
  1. 8.4s: light-leak flare read as a wide gray slab at the frame edge → narrower, warm, skewed streak, faster sweep (compositions/s3.html).
  2. 1.8s: orb self-glow sat behind "story begins", competing with act-1 type → emissive 0.08 → 0.02 (index.html).

## Attempt 2 — technical pass

- File: `renders/render-02.mp4` (3.35 MB)
- Video: 1920×1080, 30 fps, h264/yuv420p, 10s (composition 10s)
- Audio: aac, 2ch, 10s; -15.8 LUFS integrated, -3 dBFS peak, LRA 3.5
- Black segments: none
- Frozen segments ≥2s: none

**Visual review** (agent fills this in after looking at `previews/qc-02`)

- Vision used: yes (contact sheet + cut frames)
- Composition & hierarchy: act 1 now reads as darkness; light arrives in act 2 as intended; clean lockup.
- Typography (overlap, clipping, safe zones): no issues.
- Motion & transitions (cut boundary frames): flare crosses the title as a warm streak and clears by 8.4s.
- Audio sync (captions, SFX on hits): unchanged from attempt 1 (correct).
- Defects found → fixes applied: none. Delivered.
