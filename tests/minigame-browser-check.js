(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep();
  const checks = [];
  const assert = (value, name) => { if (!value) throw Error(name); checks.push(name); };
  const load = id => { archiveGameBridge.active = false; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  assert(MINIGAME_CATALOG.length === 10, 'Ten games registered');
  codexFlow.open();
  const codexRect = UI.codexDialog.getBoundingClientRect();
  assert(document.querySelectorAll('.codex-card').length === 10 && codexRect.top >= -1 && codexRect.bottom <= innerHeight + 1, 'Codex displays all ten games inside the viewport');
  codexFlow.close({ restoreFocus: false });
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const run = archiveRun.reset();
    if (run.selectedStageIds.length !== 5 || new Set(run.selectedStageIds).size !== 5) throw Error(`Invalid random selection ${i}`);
    run.selectedStageIds.forEach(id => seen.add(id));
  }
  assert(seen.size === 10, 'All ten games appear in random selection');
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
  load('e1'); scene.primaryAction();
  assert(scene.state.sign === -1, 'e1: jump flips obstacle gravity');
  advance(.5); assert(scene.state.obstacles[0].y < 440, 'e1: obstacles move after flip');
  load('e2'); scene.primaryAction(); const jump = scene.state.jumps;
  scene.state.y = 540; advance(.02);
  assert(scene.state.jumps === jump && scene.state.deaths > 0, 'e2: death retains jump strength');
  load('e3'); scene.primaryAction(); advance(.5); scene.primaryAction(); advance(.5);
  assert(scene.people.length === 2 && scene.state.drops === 2, 'e3: physical people and accumulated speed');
  const stackWorld = scene.stackWorld; load('e4');
  assert(stackWorld.world.bodies.length === 0, 'e3: physics world disposed on switch');
  assert(scene.state.points.length === 12, 'e4: exactly ten corners');
  load('e5'); scene.pointerAction(164, 382); scene.stageGame.pointerMove.call(scene, 64, 426); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.shots === 1 && scene.stageGame.power.call(scene) < 1, 'e5: drag fires and weakens rubber');
  load('e6'); scene.primaryAction(); const presses = scene.state.presses;
  scene.state.y = 100; advance(.02);
  assert(scene.state.hits === 1 && scene.state.presses === presses, 'e6: collision retains gravity penalty');
  load('e7'); scene.pointerAction(620, 321); advance(.05); scene.stageGame.pointerMove.call(scene, 480, 461); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.spinning && Math.abs(scene.state.speed) <= 18 && Math.abs(scene.state.speed) >= 5, 'e7: swipe speed clamped');
  for (let miss = 1; miss <= 3; miss++) {
    scene.state.rotation = -Math.PI / 2 + .3; scene.state.speed = .0001; scene.state.deceleration = 8; scene.state.spinning = true;
    advance(.02);
    assert(scene.state.misses === miss && !scene.state.spinning, `e7: actual losing wedge shrinks to 1/${2 * (miss + 1)}`);
  }
  load('e8'); advance(20.3, () => {
    const s = scene.state, right = 1200 + s.weights.filter(w => w.landed).reduce((sum, w) => sum + w.mass * w.x, 0);
    const desired = -right / 12 - s.angle * 200 - s.omega * 100;
    scene.touch.clear(); if (Math.abs(s.x - desired) > 1) scene.touch.add(s.x > desired ? 'left' : 'right');
  });
  assert(scene.mode === 'done' && scene.state.count === 7 && scene.elapsed > 20.25, 'e8: seven drops and achievable full survival');
  load('e9'); scene.pointerAction(166, 361); scene.stageGame.pointerMove.call(scene, 150, 361); scene.stageGame.pointerUp.call(scene); advance(1);
  assert(scene.state.failures === 1 && scene.state.x === 166 && scene.stageGame.friction.call(scene) < 220, 'e9: failed stone resets; ice remains slippery');
  load('e9'); scene.pointerAction(166, 361); archiveGame.pause(true);
  assert(scene.state.drag === null, 'Pause cancels drag without firing');
  load('e10');
  const initialFriction = scene.state.friction;
  scene.directionPress('left'); scene.directionRelease('left');
  scene.directionPress('right'); scene.directionRelease('right');
  assert(scene.state.directionPresses === 2 && scene.state.friction < initialFriction, 'e10: each new horizontal input reduces floor friction');
  load('e10'); scene.state.vx = 200; advance(.1); const grippySpeed = Math.abs(scene.state.vx);
  load('e10');
  for (let count = 0; count < 10; count++) { scene.directionPress(count % 2 ? 'left' : 'right'); scene.directionRelease(count % 2 ? 'left' : 'right'); }
  scene.state.vx = 200; advance(.1); const slipperySpeed = Math.abs(scene.state.vx);
  assert(slipperySpeed > grippySpeed, 'e10: reduced friction preserves more sliding speed');
  scene.state.vx = 123;
  const preservedFriction = scene.state.friction, preservedX = scene.state.x, preservedVx = scene.state.vx, firstDigit = scene.state.target[0];
  scene.stageGame.enterDigit.call(scene, firstDigit);
  const wrongDigit = firstDigit === '9' ? '8' : '9';
  scene.stageGame.enterDigit.call(scene, wrongDigit);
  assert(scene.state.input === '' && scene.state.friction === preservedFriction && scene.state.x === preservedX && scene.state.vx === preservedVx, 'e10: wrong digit clears only entered value');
  scene.stageGame.enterDigit.call(scene, firstDigit);
  scene.pointerAction(scene.clearButton.x + scene.clearButton.w / 2, scene.clearButton.y + scene.clearButton.h / 2);
  assert(scene.state.input === '' && scene.state.friction === preservedFriction, 'e10: clear button clears only entered value');
  load('e10');
  const physicalDigit = scene.state.target[0], physicalBlock = scene.digitBlocks.find(block => block.digit === physicalDigit);
  scene.state.x = physicalBlock.x + physicalBlock.w / 2; scene.state.vx = 0; scene.primaryAction(); advance(.4);
  assert(scene.state.input === physicalDigit, 'e10: jumping into a block underside enters its digit');
  const previousAttempt = scene.state;
  scene.state.input = '12'; scene.state.vx = 200; scene.state.friction = 145; scene.state.directionPresses = 99;
  load('e10');
  assert(scene.state !== previousAttempt && scene.state.input === '' && scene.state.x === 480 && scene.state.vx === 0 && scene.state.friction === 820 && /^[1-9][0-9]{3}$/.test(scene.state.target), 'e10: retry rebuilds target, input, motion and friction');
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
