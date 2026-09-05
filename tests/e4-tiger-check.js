(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const checks = [], assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const load = () => { scene.loadStage('e4'); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  let result = null;
  const onEnd = event => { result = event.detail; };
  window.addEventListener('archive-stage-end', onEnd);
  const step = () => scene.update(0, 1000 / 120);
  const advance = seconds => { for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) step(); };
  load();
  advance(2.9);
  assert(!scene.state.tiger.active && scene.timePenalty === 0 && scene.state.x - scene.state.tiger.x >= 20, 'e4: player receives initial distance and a head start before the tiger appears');
  advance(.2);
  assert(scene.state.tiger.catches === 1 && scene.mode === 'done' && result?.success === false, 'e4: tiger contact uses the existing stage failure event');
  const speed = scene.state.speed;
  advance(.6);
  assert(scene.state.tiger.catches === 1 && scene.state.speed === speed && !scene.playable(), 'e4: failure stops pursuit without changing acceleration settings');
  for (let attempt = 0; attempt < 8; attempt++) {
    load();
    Object.assign(scene.state, scene.stageGame.tileCenter(9, 5));
    let throughWall = false, tooFast = false;
    while (scene.playable() && !scene.state.tiger.catches && scene.elapsed < 16) {
      const tiger = scene.state.tiger, x = tiger.x, y = tiger.y;
      step();
      throughWall ||= scene.stageGame.wallsAt.call(scene, tiger.x, tiger.y).length > 0;
      tooFast ||= Math.hypot(tiger.x - x, tiger.y - y) > scene.stageGame.chase.runSpeed / 120 + .001;
    }
    assert(!throughWall && !tooFast && scene.state.tiger.catches === 1,
      `e4: tiger follows connected corridors to the player in random maze ${attempt}`);
  }
  load();
  Object.assign(scene.state, scene.stageGame.tileCenter(9, 5)); advance(4);
  const tiger = scene.state.tiger, before = { x: tiger.x, y: tiger.y, elapsed: scene.elapsed };
  archiveGame.pause(true); scene.update(0, 500);
  assert(tiger.x === before.x && tiger.y === before.y && scene.elapsed === before.elapsed, 'e4: pause freezes pursuit and timer');
  archiveGame.pause(false);
  // 원래 목적지 반대쪽으로 돌아온 플레이어를 추적해야 한다.
  Object.assign(scene.state, scene.stageGame.tileCenter(1, 1));
  while (scene.playable() && !tiger.catches && scene.elapsed < 16) step();
  assert(tiger.catches === 1, 'e4: changing direction replans pursuit instead of following a fixed exit route');
  load();
  assert(!scene.state.tiger.active && !scene.state.tiger.catches && scene.state.tiger.phase === 0, 'e4: retry resets chase, head start and catch state');
  Object.assign(scene.state, scene.state.goal); Object.assign(scene.state.tiger, scene.state.goal);
  scene.elapsed = 4; step();
  assert(scene.mode === 'done' && scene.state.tiger.catches === 0 && result?.success === true, 'e4: reaching the king uses the clear event and takes priority over same-step tiger contact');
  const oldInk = scene.tigerInk;
  for (const [dx, dy, angle] of [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, -1, 0], [0, 1, Math.PI]]) {
    load();
    const center = scene.stageGame.tileCenter(1, 1);
    Object.assign(scene.state.tiger, center, { next: null });
    Object.assign(scene.state, { x: center.x + dx * 22, y: center.y + dy * 22 });
    scene.elapsed = 4; step();
    const rotation = scene.tigerSprite.rotation;
    assert(Math.abs(Math.atan2(Math.sin(rotation - angle), Math.cos(rotation - angle))) < .001,
      `e4: upward-source tiger rotates correctly for direction ${dx},${dy}`);
  }
  // Measure actual displacement in an open lane around both speed boundaries.
  for (const [elapsed, gait, expected] of [[3.1, 'walk', 200], [6.98, 'walk', 200], [7, 'run', 440], [12, 'run', 440]]) {
    for (const playerSpeed of [240, 800]) {
      load();
      const center = scene.stageGame.tileCenter(1, 1);
      Object.assign(scene.state.tiger, center, { next: null });
      Object.assign(scene.state, { x: center.x + 25, y: center.y, speed: playerSpeed });
      scene.elapsed = elapsed; step();
      assert(scene.state.tiger.gait === gait && scene.state.tiger.speed === expected
        && Math.abs(Math.hypot(scene.state.tiger.x-center.x, scene.state.tiger.y-center.y)*120-expected) < .01,
        `e4: ${gait} is exactly ${expected}px/s at ${elapsed}s, independent of player speed ${playerSpeed}`);
    }
  }
  scene.loadStage('e10');
  assert(!scene.children.exists(oldInk), 'e4: switching games removes tiger rendering');
  window.removeEventListener('archive-stage-end', onEnd);
  return checks;
})()
