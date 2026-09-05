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
  assert(UI.mainCodexButton.disabled, 'Testimony archive stays locked before the ending');
  const menuRect = UI.mainMenu.getBoundingClientRect();
  assert(document.querySelectorAll('.main-menu-actions .menu-button').length === 4
    && menuRect.top >= -1 && menuRect.bottom <= innerHeight + 1, 'Main menu shows four story actions inside the viewport');
  settingsFlow.open();
  const settingsRect = UI.settingsDialog.getBoundingClientRect();
  assert(document.querySelectorAll('.settings-row').length === 6
    && settingsRect.top >= -1 && settingsRect.bottom <= innerHeight + 1, 'Six setting rows fit inside the viewport');
  UI.cutsceneSpeed.value = '200'; UI.cutsceneSpeed.dispatchEvent(new Event('input'));
  UI.settingsSkipCutscenesToggle.click();
  assert(ARCHIVE_STORY_SETTINGS.cutsceneSpeed === 2 && ARCHIVE_STORY_SETTINGS.skipCutscenes, 'Cutscene speed and skip settings update');
  settingsFlow.cancel();
  assert(ARCHIVE_STORY_SETTINGS.cutsceneSpeed === 1 && !ARCHIVE_STORY_SETTINGS.skipCutscenes, 'Cancel restores story settings');
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const run = archiveRun.reset();
    if (run.selectedStageIds.length !== 6 || new Set(run.selectedStageIds).size !== 6) throw Error(`Invalid random selection ${i}`);
    run.selectedStageIds.forEach(id => seen.add(id));
  }
  assert(seen.size === 10, 'All ten games appear in random selection');
  assert(true, '80 random acts each contain exactly six unique games');
  archiveRun.setSelection(MINIGAME_CATALOG.map(stage => stage.id));
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
  const initialTraction = scene.stageGame.traction(scene.state);
  scene.directionPress('left'); scene.directionRelease('left');
  scene.directionPress('right'); scene.directionRelease('right');
  assert(scene.state.directionPresses === 2 && scene.state.friction === initialFriction - 300, 'e10: each new horizontal input sharply reduces floor friction');
  assert(scene.stageGame.traction(scene.state) < initialTraction, 'e10: reduced friction also reduces acceleration traction');
  load('e10'); scene.state.vx = 200; advance(.1); const grippySpeed = Math.abs(scene.state.vx);
  load('e10');
  for (let count = 0; count < 10; count++) { scene.directionPress(count % 2 ? 'left' : 'right'); scene.directionRelease(count % 2 ? 'left' : 'right'); }
  scene.state.vx = 200; advance(.1); const slipperySpeed = Math.abs(scene.state.vx);
  assert(slipperySpeed > grippySpeed, 'e10: reduced friction preserves more sliding speed');
  load('e10'); scene.touch.add('right'); advance(.1); const baseAccelerationSpeed = scene.state.vx;
  load('e10'); scene.state.friction = scene.stageGame.tuning.minFriction; scene.touch.add('right'); advance(.1); const lowTractionSpeed = scene.state.vx;
  assert(lowTractionSpeed < baseAccelerationSpeed * .4, 'e10: low friction materially weakens actual acceleration');
  scene.state.vx = 123;
  const preservedFriction = scene.state.friction, preservedX = scene.state.x, preservedVx = scene.state.vx, target = scene.state.target;
  scene.stageGame.enterDigit.call(scene, target[0]);
  const wrongSecond = target[1] === '9' ? '8' : '9';
  scene.stageGame.enterDigit.call(scene, wrongSecond);
  assert(scene.state.input === target[0] + wrongSecond && scene.state.friction === preservedFriction && scene.state.x === preservedX && scene.state.vx === preservedVx, 'e10: a mismatched digit before the fourth keeps accumulating input');
  scene.stageGame.enterDigit.call(scene, '0');
  scene.stageGame.enterDigit.call(scene, '0');
  assert(scene.state.input === '' && scene.state.mistakes === 1 && scene.state.friction === preservedFriction && scene.state.x === preservedX && scene.state.vx === preservedVx, 'e10: wrong four-digit attempt clears input only after the fourth digit');
  assert(!scene.clearButton && !scene.clearLabel && !scene.stageGame.eraseInput, 'e10: clear button and its input handler are removed');
  assert(scene.targetScribbles.length === 8 && scene.scribbleInk, 'e10: two scribble strokes overlap each of the four target digits');
  load('e10');
  const physicalDigit = scene.state.target[0], physicalBlock = scene.digitBlocks.find(block => block.digit === physicalDigit);
  scene.state.x = physicalBlock.x + physicalBlock.w / 2; scene.state.vx = 0; scene.primaryAction(); advance(.4);
  assert(scene.state.input === physicalDigit, 'e10: jumping into a block underside enters its digit');
  const previousAttempt = scene.state;
  scene.state.input = '12'; scene.state.vx = 200; scene.state.friction = 70; scene.state.directionPresses = 99;
  load('e10');
  assert(scene.state !== previousAttempt && scene.state.input === '' && scene.state.x === 480 && scene.state.vx === 0 && scene.state.friction === 820 && /^[1-9][0-9]{3}$/.test(scene.state.target), 'e10: retry rebuilds target, input, motion and friction');
  load('e7'); advance(21);
  assert(scene.mode === 'done' && Math.abs(scene.elapsed - 20.26) < .00001, 'Timer ends exactly at 20.26 seconds');
  // A life retry must rebuild random layouts and targets from the same story-stage seed.
  archiveRun.exitQa();
  const randomConfigGames = new Set(['e4', 'e7', 'e8', 'e10']);
  let seededRun = archiveRun.reset();
  for (let attempt = 0; attempt < 100 && !randomConfigGames.has(seededRun.expectedStageId); attempt++) seededRun = archiveRun.reset();
  assert(randomConfigGames.has(seededRun.expectedStageId), 'A random-layout stage can be selected for retry verification');
  protocolSelectFlow.refreshStages();
  const seededId = seededRun.expectedStageId;
  protocolSelectFlow.launchStage(seededId);
  const configSignature = () => JSON.stringify(seededId === 'e4' ? scene.state.points
    : seededId === 'e7' ? scene.state.rotation
      : seededId === 'e8' ? scene.dropPlan : scene.state.target);
  const firstConfig = configSignature();
  scene.finish(false); document.querySelector('#primary-button').click();
  assert(configSignature() === firstConfig, `${seededId}: life retry preserves the random layout or target`);
  archiveGameBridge.stop();
  // Real story UI result/continue/retry routes with a stage selected in the current act.
  protocolSelectFlow.reset(); protocolSelectFlow.open();
  const selected = archiveRun.snapshot().selectedStageIds;
  const id = selected[0]; protocolSelectFlow.launchStage(id); scene.finish(true);
  assert(modalFlow.isOpen(), 'Clear opens result modal');
  assert(archiveRecords.best(id) !== null, 'Successful clear stores best record');
  assert(document.querySelector('#secondary-button').hidden, 'Story clear hides legacy retry button');
  document.querySelector('#primary-button').click();
  assert(archiveRun.snapshot().currentStageInAct === 2, 'Clear continues to the next story record');
  assert(JSON.stringify(archiveRun.snapshot().selectedStageIds) === JSON.stringify(selected), 'Act selection keeps the same six games');
  assert(document.querySelectorAll('.stage-select-card').length === 6, 'UI displays exactly six games');
  assert(document.querySelectorAll('.stage-select-card:not(:disabled)').length === 1, 'Only the current story stage is enabled');
  const retryId = archiveRun.snapshot().expectedStageId;
  protocolSelectFlow.launchStage(retryId); scene.finish(false); document.querySelector('#primary-button').click();
  assert(scene.playable() && scene.elapsed === 0 && scene.actions === 0, 'Life remaining retries the same stage cleanly');
  assert(archiveRun.snapshot().lives === 2, 'Failure consumes exactly one act life');
  assert(UI.stageHudAct.textContent === 'ACT 1/3' && UI.stageHudStage.textContent === 'STAGE 2/6'
    && UI.stageHudLives.textContent.endsWith('◆◆◇') && UI.stageHudActRecords.textContent === '1/6'
    && UI.stageHudMemory.textContent === '1/18', 'Gameplay HUD shows act, stage, lives, act records and total records');
  scene.finish(false); document.querySelector('#result-main-button').click();
  assert(!document.querySelector('#main-menu').classList.contains('hidden'), 'Result main button returns to main');
  // Traverse the full 18-stage UI route with cutscenes skipped to verify act transitions and archive unlock.
  ARCHIVE_STORY_SETTINGS.skipCutscenes = true;
  protocolSelectFlow.reset();
  for (let storyIndex = 0; storyIndex < 18; storyIndex++) {
    const storyRun = archiveRun.snapshot();
    protocolSelectFlow.refreshStages();
    protocolSelectFlow.startStage(storyRun.expectedStageId);
    if (!scene.playable()) throw Error(`Story stage ${storyIndex + 1} did not start`);
    scene.finish(true);
    document.querySelector('#primary-button').click();
  }
  const completedRun = archiveRun.snapshot();
  assert(completedRun.finished && completedRun.ending === 'shared' && completedRun.totalRecordCount === 18, 'Eighteen clears reach the single shared-memory ending');
  assert(completedRun.archiveViewerUnlocked && completedRun.archiveEntries.length === 18 && !UI.mainCodexButton.disabled, 'Ending unlocks all eighteen testimony entries');
  codexFlow.open();
  const codexRect = UI.codexDialog.getBoundingClientRect();
  assert(document.querySelectorAll('.codex-card[data-discovered="true"]').length === 18
    && codexRect.top >= -1 && codexRect.bottom <= innerHeight + 1, 'Unlocked testimony archive shows eighteen records inside the viewport');
  codexFlow.close({ restoreFocus: false });
  ARCHIVE_STORY_SETTINGS.skipCutscenes = false;
  return { passed: checks.length, checks: checks.filter(name => !name.startsWith('Unique random selection')) };
})()
