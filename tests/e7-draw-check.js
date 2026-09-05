(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  scene.loadStage('e7'); scene.startStage();
  const step = seconds => { for (let i = 0; i < seconds * 120; i++) scene.update(0, 1000 / 120); };
  assert(['멕시코', '남아공', '체코'].includes(scene.state.target), 'Target is a Korea group opponent');
  assert(scene.coach.frame.name === 'pose0' && !scene.coachBack.visible, 'Starts with hand on wheel');
  assert(!scene.textures.get('e7:coach').has('pose4'), 'Fifth pose is excluded');
  for (let miss = 0; miss < 4; miss++) {
    const s = scene.state, count = 8;
    assert(s.countries.length === count && s.countries.filter(c => c === s.target).length === 1, 'Exactly one winning country per equal-sector wheel');
    s.rotation = .3; s.speed = .0001; s.deceleration = 8; s.spinning = true;
    step(.02);
    assert(s.misses === miss + 1 && scene.coachBack.visible && !scene.coach.visible, 'Miss displays back pose');
    scene.pointerAction(620, 321);
    assert(!s.drag, 'Failure reaction blocks another swipe');
    step(1.2);
    assert(scene.coach.visible && !scene.coachBack.visible && s.countries.length === count, 'Next draw preserves sectors and resets pose');
  }
  scene.state.rotation = -.1; scene.state.speed = .0001; scene.state.deceleration = 8; scene.state.spinning = true;
  step(.02);
  assert(scene.mode === 'done', 'Winning country finishes the game');
  scene.loadStage('e7');
  assert(scene.state.misses === 0 && scene.state.countries.length === 8, 'Restart resets probability');
  scene.startStage();
  const measure = misses => {
    scene.state.misses = misses;
    scene.state.rotation = 0;
    scene.state.drag = { travel: 1, sweep: 1, age: .25, idle: 0 };
    scene.stageGame.pointerUp.call(scene);
    const speed = scene.state.speed, friction = scene.state.deceleration;
    scene.state.spinning = false;
    return speed * speed / (2 * friction);
  };
  const first = measure(0), repeat = measure(0), loose = measure(2);
  assert(first === repeat && loose > first, 'Same release is deterministic; lower friction increases travel');
  scene.state.drag = { travel: .1, sweep: .1, age: .25, idle: 0 };
  scene.stageGame.pointerUp.call(scene);
  assert(!scene.state.spinning, 'Small nudges cannot trigger a winning spin');
  const before = scene.state.rotation;
  scene.pointerAction(620, 321);
  scene.stageGame.pointerMove.call(scene, 480, 461);
  assert(scene.state.rotation === before, 'Dragging cannot place a country under the pointer');
  scene.stageGame.pointerUp.call(scene);
  assert(scene.state.spinning && scene.state.speed > 0, 'Sweep launches in the swipe direction');
  const slow = scene.stageGame.swipeSpeed.call(scene, { sweep: 1, age: .3, idle: 0 });
  const fast = scene.stageGame.swipeSpeed.call(scene, { sweep: 1, age: .15, idle: 0 });
  assert(fast > slow, 'Same distance dragged faster gives more speed');
  assert(scene.stageGame.swipeSpeed.call(scene, { sweep: -1, age: .3, idle: 0 }) === -slow, 'Reverse swipe gives reverse momentum');
  assert(Math.abs(scene.stageGame.swipeSpeed.call(scene, { sweep: 1, age: 1, idle: .7 })) < scene.stageGame.tuning.minSpeed, 'Holding still cannot preserve old momentum');
  const swipe = (x1, y1, x2, y2) => {
    scene.state.spinning = false; scene.state.cooldown = 0;
    scene.pointerAction(x1, y1);
    scene.state.drag.age = .2;
    scene.stageGame.pointerMove.call(scene, x2, y2);
    scene.stageGame.pointerUp.call(scene);
    assert(scene.state.spinning, 'Straight drag launches');
    return scene.state.speed;
  };
  assert(swipe(480, 250, 480, 410) > 0, 'Vertical swipe through centre works');
  assert(swipe(480, 410, 480, 250) < 0, 'Upward swipe reverses direction');
  assert(swipe(430, 250, 560, 410) > 0, 'Diagonal swipe works');
  assert(swipe(480, 321, 560, 450) > 0, 'Swipe can start at the centre');
  assert(Math.abs(scene.coachBack.y - 6 - (scene.coach.y + 732 * .43)) < 2, 'Back pose feet align with front pose');
  scene.stopGame();
  return 'PASS: opponent selection, four poses, failure reaction, fixed sectors, deterministic momentum and weakening friction, win and restart';
})()
