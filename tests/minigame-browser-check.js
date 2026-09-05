(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep();
  const checks = [];
  const assert = (value, name) => { if (!value) throw Error(name); checks.push(name); };
  const load = id => { archiveGameBridge.active = false; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  assert(MINIGAME_CATALOG.length === 9, 'Nine new games registered');
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const run = archiveRun.reset();
    if (run.selectedStageIds.length !== 5 || new Set(run.selectedStageIds).size !== 5) throw Error(`Invalid random selection ${i}`);
    run.selectedStageIds.forEach(id => seen.add(id));
  }
  assert(seen.size === 9, 'All nine games appear in random selection');
  assert(true, '80 random runs each contain exactly five unique games');
  for (const stage of MINIGAME_CATALOG) {
    load(stage.id); advance(.25);
    const time = scene.remaining;
    archiveGame.pause(true); scene.update(0, 1000);
    assert(scene.remaining === time, `${stage.id}: pause freezes time`);
    archiveGame.pause(false);
    scene.directionPress('right'); scene.primaryAction(); advance(.3); scene.stopGame();
    assert(!scene.touch.size && scene.pointerId === null, `${stage.id}: stop clears input`);
  }
  load('e1');
  const stuck = () => scene.state.obstacles.filter(o => !o.float), floats = () => scene.state.obstacles.filter(o => o.float);
  assert(stuck().length && floats().length, 'e1: course mixes wall-attached and floating obstacles');
  scene.state.immune = 100;
  advance(2);
  assert(stuck().every(o => o.y === 467 - o.h) && floats().every(o => o.y === 174), 'e1: spikes and both block types move to their gravity walls');
  const obstacleStart = scene.state.obstacles.map(o => o.y);
  scene.primaryAction();
  assert(scene.state.sign === -1, 'e1: action flips gravity instead of jumping');
  let maxObstacleSpeed = 0;
  advance(.5, () => { maxObstacleSpeed = Math.max(maxObstacleSpeed, ...scene.state.obstacles.map(o => Math.abs(o.vy))); });
  assert(Math.abs(scene.state.y - 189) < 1 && scene.state.vy === 0, 'e1: player sticks to the ceiling wall');
  assert(scene.state.obstacles.every((o, i) => o.y !== obstacleStart[i]), 'e1: every obstacle including spikes and floating blocks responds to flip');
  assert(maxObstacleSpeed > 0 && maxObstacleSpeed <= 190 && maxObstacleSpeed < scene.stageGame.tuning.speed, 'e1: obstacle motion stays slower than player travel');
  assert(stuck().every(o => o.y > 174), 'e1: player reaches ceiling before following obstacles');
  advance(1.5); assert(stuck().every(o => o.y === 174) && floats().every(o => o.y === 433), 'e1: following and opposing obstacles settle on different walls');
  scene.primaryAction(); advance(.5);
  assert(Math.abs(scene.state.y - 450) < 1, 'e1: pressing again returns to the floor wall');
  assert(scene.hurdles.length === 10 && scene.hurdles.every(h => scene.state.obstacles.includes(h)), 'e1: ten spike groups share the moving obstacle simulation');
  load('e1'); advance(20.3);
  assert(scene.state.deaths > 0 && scene.state.x < scene.stageGame.tuning.distance, 'e1: no-input play cannot clear');
  load('e2'); scene.primaryAction(); const jump = scene.state.jumps;
  const weakened = scene.stageGame.jumpPower.call(scene), shards = scene.state.shards.length;
  scene.primaryAction();
  assert(scene.state.jumps === jump && scene.state.shards.length === shards && shards > 0, 'e2: airborne presses do not add damage or shards');
  scene.state.y = 540; scene.state.vy = 100; advance(.02);
  assert(scene.state.jumps === jump && scene.state.deaths > 0 && scene.stageGame.jumpPower.call(scene) === weakened, 'e2: death retains cracked shell and weakened jump');
  load('e2');
  const heights = [];
  for (let attempt = 0; attempt < 13; attempt++) {
    const startY = scene.state.y; let top = startY;
    scene.primaryAction();
    advance(1.3, () => { top = Math.min(top, scene.state.y); });
    heights.push(startY - top);
  }
  assert(heights.slice(1, 5).every((h, i) => h < heights[i] - 1), 'e2: real jump apex gets progressively lower');
  assert(heights[0] > 190 && heights[2] < heights[0] * .75 && heights[4] > 80, 'e2: early jump reduction preserves useful mid-course height');
  assert(heights[8] < heights[5] && heights[8] > heights[10] + 5, 'e2: jump height keeps changing into the late course');
  assert(Math.abs(heights[11] - heights[12]) < .01 && heights[12] > 20, 'e2: heavily damaged ball retains a usable minimum bounce');
  assert(scene.state.shards.length === 0, 'e2: emitted wax shards expire');
  scene.primaryAction();
  const pausedShards = JSON.stringify(scene.state.shards);
  archiveGame.pause(true); scene.update(0, 500);
  assert(JSON.stringify(scene.state.shards) === pausedShards, 'e2: pause freezes shell fragments');
  archiveGame.pause(false);
  load('e2');
  assert(scene.state.jumps === 0 && scene.state.shards.length === 0 && scene.stageGame.jumpPower.call(scene) > weakened, 'e2: fresh attempt restores shell and jump power');
  // A high assisted jump can pass the former ceiling without dying or resetting damage.
  scene.touch.add('up'); scene.primaryAction(); advance(.8);
  assert(scene.state.y < 188 && scene.state.deaths === 0 && scene.state.jumps === 1, 'e2: former ceiling is open for high jumps');
  load('e2');
  const lift = scene.platforms.find(p => p.kind === 'lift'), startLiftY = lift.y;
  Object.assign(scene.state, { x: lift.x + lift.w / 2, y: lift.y - 20, platformIndex: lift.index, grounded: true, vy: 0 });
  advance(.3);
  assert(Math.abs(lift.y - startLiftY) > 1 && scene.state.grounded && Math.abs(scene.state.y + 20 - lift.y) < .01, 'e2: moving lift carries the grounded ball');
  load('e2');
  const crumble = scene.platforms.find(p => p.kind === 'crumble');
  Object.assign(scene.state, { x: crumble.x + 45, y: crumble.y - 21, platformIndex: crumble.index, grounded: false, vy: 20, jumps: 5 });
  advance(.05);
  assert(crumble.crumbleLeft > 0 && scene.state.checkpoint === 90, 'e2: landing arms crumble timer without setting an unsafe checkpoint');
  const countdown = crumble.crumbleLeft;
  archiveGame.pause(true); scene.update(0, 1000);
  assert(crumble.crumbleLeft === countdown, 'e2: pause freezes terrain countdown');
  archiveGame.pause(false); advance(.6);
  assert(!crumble.active && !scene.state.grounded, 'e2: crumbled platform loses collision and drops a waiting ball');
  advance(.5);
  assert(scene.state.deaths > 0 && scene.state.x === 90 && scene.state.jumps === 5, 'e2: crumble fall returns to safe checkpoint with damage preserved');
  advance(1);
  assert(crumble.active && crumble.crumbleLeft === null, 'e2: collapsed platform rebuilds for another attempt');
  load('e2');
  // The weakened ball needs W assistance and late takeoffs on the harder course.
  scene.state.jumps = 100; driveE2();
  assert(scene.state.x >= scene.stageGame.tuning.goal && scene.elapsed < 20.26, `e2: assisted minimum jump can clear the terrain (${scene.state.x}, deaths ${scene.state.deaths})`);
  // Reach the fixed final staircase across different elevator phases using end-of-platform takeoffs.
  for (const phase of [0, .7, 1.4, 2.1]) {
    load('e2'); const p = scene.platforms[5];
    Object.assign(scene.state, { x: p.x + 50, y: p.y - 20, checkpoint: p.x + 50, platformIndex: p.index, jumps: 100 });
    scene.elapsed = phase;
    driveE2(18, { reactionFrames: 2, edge: 6, allowAssist: false });
    assert(scene.state.x >= scene.stageGame.tuning.goal && scene.state.deaths === 0, `e2: late staircase clears without W at minimum bounce with edge jumps (phase ${phase})`);
  }
  load('e2');
  const stair = scene.platforms[12], nextStair = scene.platforms[13];
  Object.assign(scene.state, { x: stair.x + stair.w - 24, y: stair.y - 20, checkpoint: stair.x + 50, platformIndex: stair.index, jumps: 100 });
  scene.touch.add('right'); scene.primaryAction(); advance(.8);
  assert(scene.state.platformIndex !== nextStair.index && scene.state.y + 20 > nextStair.y, 'e2: jumping 24px before the final edge still misses without W');
  load('e3'); scene.primaryAction(); advance(.5); scene.primaryAction(); advance(.5);
  assert(scene.people.length === 2 && scene.state.drops === 2, 'e3: physical people and accumulated speed');
  const stackWorld = scene.stackWorld; load('e4');
  assert(stackWorld.world.bodies.length === 0, 'e3: physics world disposed on switch');
  assert(scene.state.tiles.length === 7 && scene.state.tiles[0].length === 19, 'e4: compact maze');
  const startX = scene.state.x; advance(.2);
  assert(scene.state.x === startX, 'e4: no automatic movement');
  scene.directionPress('left'); advance(.5);
  assert(scene.state.hits === 1 && scene.timePenalty === 1, 'e4: wall costs exactly one second');
  advance(.5);
  assert(scene.state.hits === 1, 'e4: sustained wall contact does not repeat penalty');
  scene.directionRelease('left'); advance(.1); scene.directionPress('left'); advance(.1);
  assert(scene.state.hits === 1, 'e4: repress against wall does not repeat penalty');
  scene.directionRelease('left'); scene.directionPress('right'); advance(.1);
  scene.directionRelease('right'); scene.directionPress('left'); advance(.2);
  assert(scene.state.hits === 2 && scene.timePenalty === 2, 'e4: separate impact costs another second');
  assert(Math.abs(scene.remaining - (90 - scene.elapsed - 2)) < .00001, 'e4: timer retains penalties');
  scene.remaining = .5; scene.timePenalty = 90 - scene.elapsed - .5;
  scene.directionRelease('left'); scene.directionPress('right'); advance(.1);
  scene.directionRelease('right'); scene.directionPress('left'); advance(.2);
  assert(scene.mode === 'done' && scene.remaining === 0, 'e4: impact can exhaust timer');
  load('e4');
  assert(scene.state.hits === 0 && scene.timePenalty === 0 && scene.remaining === 90, 'e4: retry resets timer and penalty');
  load('e5'); scene.pointerAction(164, 382); scene.stageGame.pointerMove.call(scene, 64, 426); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.shots === 1 && scene.stageGame.power.call(scene) < 1, 'e5: drag fires and weakens rubber');
  load('e6'); scene.primaryAction(); const presses = scene.state.presses;
  scene.state.y = 100; advance(.02);
  assert(scene.state.hits === 1 && scene.state.presses === presses, 'e6: collision retains gravity penalty');
  load('e7'); scene.pointerAction(620, 321); advance(.05); scene.stageGame.pointerMove.call(scene, 480, 461); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.spinning && Math.abs(scene.state.speed) <= scene.stageGame.tuning.maxSpeed && Math.abs(scene.state.speed) >= scene.stageGame.tuning.minSpeed, 'e7: swipe speed clamped');
  for (let miss = 1; miss <= 3; miss++) {
    scene.state.rotation = -Math.PI / 2 + .3; scene.state.speed = .0001; scene.state.deceleration = 8; scene.state.spinning = true;
    advance(.02);
    assert(scene.state.misses === miss && !scene.state.spinning, `e7: actual losing wedge shrinks to 1/${2 * (miss + 1)}`);
  }
  load('e8'); advance(20.3);
  assert(scene.mode === 'done' && scene.state.deaths > 0 && scene.state.x < scene.goalX, 'e8: no-input run falls and times out instead of surviving to win');
  load('e8'); driveE8(1.9); advance(.15);
  const rope = scene.state.rope, anchor = scene.anchors[rope?.anchor];
  assert(rope?.taut && Math.abs(Math.hypot(scene.state.x - anchor.x, scene.state.y - anchor.y) - rope.length) < .01, 'e8: taut web constrains the runner to a circular swing');
  scene.touch.delete('action'); advance(1 / 120);
  assert(!scene.state.rope && scene.state.vy < 0, 'e8: releasing Space preserves upward launch velocity');
  load('e8'); driveE8(1.5); scene.touch.clear(); advance(.25); scene.pointerAction(600, 300); advance(.1);
  assert(scene.state.pointerHeld && scene.state.rope, 'e8: airborne mouse hold attaches and maintains a web');
  scene.stageGame.pointerUp.call(scene);
  assert(!scene.state.pointerHeld && !scene.state.rope, 'e8: mouse release detaches the web');
  scene.pointerAction(600, 300);
  const pauseX = scene.state.x;
  archiveGame.pause(true); scene.update(0, 1000);
  assert(scene.state.x === pauseX && !scene.state.pointerHeld && !scene.state.rope, 'e8: pause freezes motion and cancels held web input');
  archiveGame.pause(false);
  const speedBeforeFall = scene.state.speed;
  scene.state.y = 700; scene.state.vy = 100; advance(.02);
  assert(scene.state.deaths === 1 && scene.state.speed >= speedBeforeFall && scene.state.retry > 0, 'e8: fall returns to a roof while retaining acceleration');
  load('e8');
  assert(scene.state.speed === scene.stageGame.tuning.speed && scene.state.hooks === 0 && scene.state.deaths === 0, 'e8: fresh retry resets speed and web counters');
  for (const options of [{}, { reactionFrames: 10, hookDelay: .35, releaseAt: .3 }, { hookDelay: .25 }, { jumpLead: .22 }]) {
    load('e8'); driveE8(20.3, options);
    assert(scene.state.x >= scene.goalX && scene.state.deaths === 0 && scene.elapsed < 18 && scene.state.speed >= scene.stageGame.tuning.speed * 3,
      `e8: eight roof gaps clear with accelerating speed and human-scale input timing ${JSON.stringify(options)}`);
  }
  load('e9'); scene.pointerAction(166, 361); scene.stageGame.pointerMove.call(scene, 150, 361); scene.stageGame.pointerUp.call(scene); advance(1);
  assert(scene.state.failures === 1 && scene.state.x === 166 && scene.stageGame.friction.call(scene) < 220, 'e9: failed stone resets; ice remains slippery');
  load('e9'); scene.pointerAction(166, 361); archiveGame.pause(true);
  assert(scene.state.drag === null, 'Pause cancels drag without firing');
  load('e7'); advance(21);
  assert(scene.mode === 'done' && Math.abs(scene.elapsed - 20.26) < .00001, 'Timer ends exactly at 20.26 seconds');
  // Real UI result/retry/select routes with a stage selected in the current run.
  protocolSelectFlow.reset(); protocolSelectFlow.open();
  const selected = archiveRun.snapshot().selectedStageIds;
  const id = selected[0]; protocolSelectFlow.launchStage(id); scene.finish(true);
  assert(modalFlow.isOpen(), 'Clear opens result modal');
  assert(archiveRecords.best(id) !== null, 'Successful clear stores best record');
  document.querySelector('#secondary-button').click();
  assert(scene.playable() && scene.elapsed === 0 && scene.actions === 0, 'Result retry starts clean attempt');
  scene.finish(false); document.querySelector('#primary-button').click();
  assert(JSON.stringify(archiveRun.snapshot().selectedStageIds) === JSON.stringify(selected), 'Stage selection keeps same five games');
  assert(document.querySelectorAll('.stage-select-card').length === 5, 'UI displays exactly five games');
  protocolSelectFlow.launchStage(id); scene.finish(false); document.querySelector('#result-main-button').click();
  assert(!document.querySelector('#main-menu').classList.contains('hidden'), 'Result main button returns to main');
  return { passed: checks.length, checks: checks.filter(name => !name.startsWith('Unique random selection')) };
})()
