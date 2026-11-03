/*CONFIG
{ "duration": 12, "titleAt": 8, "black": [[7.4, 8, 1]],
  "titleLines": ["EPISODE {{NN}}", "{{TITLE}}"],
  "hud": [
    { "start": 0.6, "end": 4.2, "text": "EPISODE {{NN}}", "color": "white", "pos": "top" }
  ] }
CONFIG*/
// EPISODE {{NN}} — {{TITLE}}. Starter shot: replace with the episode's sets, characters and cameras.
// Contract: EP.init(W, rand) builds sets and returns { sets: { name: Object3D }, ...state };
// EP.frame(t, W, S) poses everything for time t and returns { pos, look, sets: [names], fog?, roll?, fov? }.
const EP = {
  fov: 50, seed: {{SEED}},
  init(W, rand) {
    const stage = makeStage(W.scene);
    const hero = typeof makeHumanoid === "function" ? makeHumanoid({ helmet: false, suit: 0x3a5a8c, backpack: false, chest: null }) : null;
    if (hero) stage.group.add(hero.root);
    return { stage, hero, sets: { stage: stage.group } };
  },
  frame(t, W, S) {
    const a = t * 0.35;
    if (S.hero) { S.hero.root.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3); S.hero.root.rotation.y = -a - Math.PI / 2; S.hero.walk(t * 5.5, 1); }
    const c = S.hero ? S.hero.root.position : V(0, 0, 0), o = t * 0.2;
    const pos = c.clone().add(V(Math.cos(o) * 5.5, 2.0, Math.sin(o) * 5.5)), look = c.clone().add(V(0, 1.1, 0));
    return { pos, look, sets: ["stage"] };
  },
};
