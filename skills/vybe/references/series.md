# Series: many episodes, one shared 3D world

Use the series engine whenever a request spans **more than one video that shares characters,
sets or a look**. That covers numbered episodes, "part 1/2/3", a season script, a recurring
mascot, or "I'll send more episodes later". Every episode inlines the same engine, so the
hero, the ship, the city and the title card are identical across the season. Fixing a model
once fixes it everywhere.

## Commands

```bash
node <VYBE>/scripts/vybe.mjs series init --name "The Last Signal" --episodes 5 \
     --kits characters,space,places [--title "THE LAST|SIGNAL"] -- <the user's invocation>
node <VYBE>/scripts/vybe.mjs series add   <series-dir> [--title "The Return"]
node <VYBE>/scripts/vybe.mjs series build <series-dir> [n ...]
```

`init` reads format, fps and style from the invocation, the same way `vybe init` does. It creates:

| Path | What it is |
| --- | --- |
| `vybe-output/<slug>/series.json` | Name, title card lines, format, kits, palette, `captionReplace`, and the episode list mapped to project dirs |
| `vybe-output/<slug>/engine/core.js` | Renderer, stars, stage, camera paths, shake, hologram, canvas-screen helpers. All of it is deterministic. |
| `vybe-output/<slug>/engine/kits/*.js` | Copies of every kit. Only the kits listed in `series.json` are inlined. |
| `vybe-output/<slug>/episodes/epNN.js` | A starter episode that renders as-is. Replace it with the real episode. |
| `vybe-output/<slug>/series-bible.md` | Locked look, cast, sets and voices. Fill it in before episode 1. |
| `vybe-output/<slug>-epNN/` | A normal VYBE project per episode, used for `storyboard.json`, audio, render, QC and exports |

The series owns its copy of the engine. Extend it there with new characters, sets or props,
and every episode picks the change up on the next `build`.

## Kits

| Kit | Functions | Notes |
| --- | --- | --- |
| core (always) | `createWorld`, `makeStars`, `makeStage`, `track`, `shake`, `hologramMaterial`, `glow`, `radialTexture`, `screenBase` / `screenWave` / `screenGlitch` / `screenCentered` / `scanlines`, `mulberry32`, `smooth`, `range`, `pulse`, `lerp`, `V`, `std`, `basic`, `add` | `track([[t,x,y,z,ease]...])(t)` returns `{p, dist, speed}`. Drive walk cycles from `dist`. |
| `characters` | `makeHumanoid({suit, trim, helmet, visor, skin, hair, backpack, chest, material})`, `makeAstronaut`, `makeChild` / `makeGirl`, `makeShadow` | Rigs face +x. `walk(phase, weight, amp)`, `sit()`, `stand()`. Pass `material: hologramMaterial()` for a projected double. |
| `space` (needs characters) | `makeShip`, `makeCockpit`, `makeEarth`, `makeFleet` | The cockpit has a live 1024×640 canvas screen (`ctx`, `screenTex`). Earth's night lights switch off between `offStart` and `offEnd`. Fleet ships light up at their `on` time. |
| `places` | `makeCity`, `makeFacility` | City sky has a rift uniform (`dome.material.uniforms.uRift`). The facility's `tick(t, {spin, red, open})` drives the machine, the doors and the red alert. |

## Episode contract (`episodes/epNN.js`)

```js
/*CONFIG
{ "duration": 48, "titleAt": 43.5, "black": [[42, 43.5, 1]],
  "titleLines": ["EPISODE 04", "THE TRUTH"],
  "hud": [ { "start": 23.4, "end": 24.4, "text": "ARRIVAL 00:00:10", "color": "red", "pos": "top" },
           { "start": 24.4, "end": 25.4, "text": "ARRIVAL 00:00:09", "color": "red", "pos": "top", "instant": true } ] }
CONFIG*/
const EP = {
  fov: 60, seed: 2092,
  init(W, rand) {            // build every set once; each set lives at its own origin
    const city = makeCity(W.scene, V(0, 0, 0), rand);
    const hero = makeAstronaut(); city.group.add(hero.root);
    return { city, hero, sets: { city: city.group } };
  },
  frame(t, W, S) {           // pure function of t: pose everything, choose the shot
    S.hero.walk(t * 4, 1);
    return { pos: V(3, 1.6, 4), look: V(0, 1.2, 0), sets: ["city"], fog: null, roll: 0 };
  },
};
```

- **`CONFIG` fields:**
  - `duration`: must equal the storyboard total.
  - `titleAt`: when the title card starts.
  - `black`: `[start, end, opacity]` windows. Mark the same scenes `black: true` in the storyboard so QC allows them.
  - `titleLines`: the lines under the title.
  - `hud`: overlay lines.
    - `color` is `cy`, `red` or `white`.
    - `pos` is `top`, `upper` or `center`.
    - `big` gives a giant date-style line.
    - `blink` makes the line blink.
    - `instant` swaps the text with no type-on (use it for counters).
- **Sets:** `sets` names the objects shown per shot. `"stars"` turns on the star field.
- **Shot list:** one `if (t < …)` branch per shot. Cut on the storyboard's scene starts and on voice-line starts. The real line starts are in the project's `audio/audio-manifest.json`.
- **Framing:** portrait frames are narrow, about 36° horizontally at fov 60. Keep characters near the look target, or follow them.
- **Determinism:** no `Math.random`, `Date.now` or `requestAnimationFrame`. Use `rand` from `init`, `mulberry32(seed)` or functions of `t`.

## Workflow per episode

1. Write the episode's `storyboard.json` in its project, including voice lines with per-line `voice`, `voiceFx` and `voiceSpeed` from the series bible. Then run `vybe storyboard validate`.
2. Run `vybe audio <episode-project>` to generate voices, music, SFX and captions.
3. Write `episodes/epNN.js` against the real voice timings.
4. Run `vybe series build <series-dir> N`. Captions are rebuilt from the script text, so they never carry transcription errors. Use `captionReplace` in `series.json` for display forms such as `["^Twenty eighty-nine\\.", "2089."]`.
5. In `composition/`, run `npx hyperframes lint`, then `npx hyperframes snapshot --at <key times>`. Look at every shot before rendering.
6. Run `vybe render`, `vybe qc` and `vybe finalize` on the episode project, as for any VYBE video.

Episodes are independent projects, so audio generation and renders can run in parallel
across episodes.
