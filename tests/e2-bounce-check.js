(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const load = () => {
    scene.loadStage('e2'); scene.startStage(); scene.settings = { shake: false, effects: false };
    scene.touch.clear();
  };
  const advance = seconds => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) scene.update(0, 1000 / 120);
  };

  load();
  assert(scene.stageGame.tuning.minJump === 300, 'e2: minimum jump power is raised to 300');
  scene.state.jumps = 100;
  assert(scene.stageGame.jumpPower.call(scene) === 300, 'e2: jump decay stops at the playable minimum');

  const catalog = MINIGAME_CATALOG.find(stage => stage.id === 'e2');
  assert(catalog.controls === 'A/D 이동 · Space 점프', 'e2: catalog lists only A/D and Space');
  protocolSelectFlow.renderBrief(catalog);
  assert(UI.protocolBriefControls.textContent === 'A/D 이동 · Space 점프', 'e2: lower briefing UI has no W/S controls');

  const verticalSample = direction => {
    load(); scene.state.jumps = 100;
    if (direction) scene.touch.add(direction);
    scene.primaryAction(); advance(.2);
    return { y: scene.state.y, vy: scene.state.vy };
  };
  const neutral = verticalSample(null), up = verticalSample('up'), down = verticalSample('down');
  assert(Math.abs(neutral.y - up.y) < .001 && Math.abs(neutral.vy - up.vy) < .001
    && Math.abs(neutral.y - down.y) < .001 && Math.abs(neutral.vy - down.vy) < .001,
  'e2: W/S input cannot alter the airborne trajectory');

  load();
  driveE2();
  assert(scene.state.x >= scene.stageGame.tuning.goal && scene.elapsed < 20.26 && scene.state.deaths === 0,
    'e2: naturally decaying jumps clear the full course without air control');

  for (const phase of [0, .7, 1.4, 2.1]) {
    load(); const checkpoint = scene.platforms[5];
    Object.assign(scene.state, {
      x: checkpoint.x + 50, y: checkpoint.y - 20, checkpoint: checkpoint.x + 50,
      platformIndex: checkpoint.index, grounded: true, vy: 0, jumps: 100,
    });
    scene.elapsed = phase;
    driveE2(18, { reactionFrames: 2, edge: 6 });
    assert(scene.state.x >= scene.stageGame.tuning.goal && scene.state.deaths === 0,
      `e2: minimum jump clears the late course at lift phase ${phase}`);
  }

  load();
  const stair = scene.platforms[12], next = scene.platforms[13];
  Object.assign(scene.state, {
    x: stair.x + stair.w - 24, y: stair.y - 20, checkpoint: stair.x + 50,
    platformIndex: stair.index, grounded: true, vy: 0, jumps: 100,
  });
  scene.touch.add('right'); scene.primaryAction(); advance(.8);
  assert(scene.state.platformIndex !== next.index && scene.state.y + 20 > next.y,
    'e2: minimum jump still requires a late takeoff');

  return { passed: checks.length, checks };
})()
