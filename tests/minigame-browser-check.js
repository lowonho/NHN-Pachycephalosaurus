(async () => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep();
  const checks = [];
  const assert = (value, name) => { if (!value) throw Error(name); checks.push(name); };
  const load = id => { archiveGameBridge.active = false; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  assert(MINIGAME_CATALOG.length === 10, 'Ten games registered');
  const cutsceneImagePaths = [...new Set(Object.values(SCENARIO_DATA.backgrounds))];
  const cutsceneImageSizes = await Promise.all(cutsceneImagePaths.map((path) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`Cutscene image failed to load: ${path}`));
    image.src = new URL(path, document.baseURI).href;
  })));
  assert(cutsceneImagePaths.length === 8 && cutsceneImageSizes.every(({ width, height }) => Math.abs(width / height - 16 / 9) < .002), 'Eight cutscene backgrounds load at 16:9');
  assert(SCENARIO_DATA.backgrounds['op-01'].endsWith('/op1.png')
    && SCENARIO_DATA.backgrounds['op-02'].endsWith('/op02.png')
    && SCENARIO_DATA.backgrounds.assist.endsWith('/CUTSCENE H1.png')
    && SCENARIO_DATA.backgrounds.betrayal.endsWith('/CUTSCENE 01.png')
    && SCENARIO_DATA.backgrounds['ending-d'].endsWith('/ChatGPT Image 2026년 9월 5일 오후 07_30_12.png'), 'Opening, assist, betrayal and firewall-break phases use their matching artwork');
  UI.cutscene.classList.remove('hidden'); cutsceneFlow.showBackground('op-01'); UI.cutscene.dataset.phase = 'op-01';
  assert(getComputedStyle(UI.cutsceneBackdrop).backgroundImage.includes('op1.png')
    && getComputedStyle(document.querySelector('.story-media-wall')).display === 'none', 'Rendered cutscene uses cover artwork instead of the old media placeholder');
  cutsceneFlow.showBackground('ending-d'); UI.cutscene.dataset.phase = 'ending-d';
  assert(getComputedStyle(UI.cutsceneBackdrop).backgroundImage.includes('07_30_12.png')
    && getComputedStyle(document.querySelector('.story-records')).display === 'none', 'Firewall-break artwork replaces the temporary ending graphic');
  cutsceneFlow.close();
  qaModeFlow.activate();
  const qaStoryState = () => JSON.stringify({
    currentAct: archiveRun.snapshot().currentAct,
    currentStageInAct: archiveRun.snapshot().currentStageInAct,
    lives: archiveRun.snapshot().lives,
    records: archiveRun.snapshot().stageRecords,
  });
  const beforeQaStory = qaStoryState();
  const qaRect = UI.qaPanel.querySelector('.qa-dialog').getBoundingClientRect();
  assert(document.querySelectorAll('.qa-story-button').length === Object.keys(SCENARIO_DATA.cutscenes).length
    && qaRect.top >= -1 && qaRect.bottom <= innerHeight + 1, 'QA panel shows every story cutscene inside the viewport');
  ARCHIVE_STORY_SETTINGS.skipCutscenes = true;
  document.querySelector('.qa-story-button[data-story-id="opening"]').click();
  assert(cutsceneFlow.isOpen()
    && UI.cutscene.dataset.phase === 'op-01'
    && UI.cutscene.dataset.cueKind === 'silent'
    && !cutsceneFlow.auto
    && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'false'
    && getComputedStyle(document.querySelector('.cutscene-dialogue')).display === 'none'
    && UI.qaPanel.classList.contains('hidden'), 'QA opening starts with OP-01 and AUTO disabled even when normal cutscene skipping is enabled');
  UI.cutsceneAutoButton.click();
  assert(cutsceneFlow.auto && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'true', 'AUTO starts only when the player turns it on');
  UI.cutsceneAutoButton.click();
  assert(!cutsceneFlow.auto && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'false', 'AUTO can be turned off again');
  cutsceneFlow.advance();
  assert(UI.cutscene.dataset.phase === 'op-02'
    && UI.cutscene.dataset.cueKind === 'system'
    && getComputedStyle(document.querySelector('.cutscene-speaker')).display === 'none'
    && UI.cutsceneLine.textContent === '삭제됨\n검색 결과 0건', 'Screen directions render as a system panel instead of character dialogue');
  cutsceneFlow.finish();
  assert(!UI.qaPanel.classList.contains('hidden') && qaStoryState() === beforeQaStory, 'QA story preview returns to QA without changing progress');
  cutsceneFlow.play({
    chapter: 'QA FINAL CARD',
    script: [SCENARIO_DATA.cutscenes.ending.script.at(-1)],
    auto: false,
    forceDisplay: true,
  });
  assert(UI.cutsceneLine.scrollHeight <= UI.cutsceneLine.clientHeight + 1
    && UI.cutscene.dataset.cueKind === 'system', 'The full nine-line ending card fits in the system panel');
  cutsceneFlow.finish();
  ARCHIVE_STORY_SETTINGS.skipCutscenes = false;
  qaModeFlow.deactivate();
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
  scene.state.y = 540; advance(.02);
  assert(scene.state.jumps === jump && scene.state.deaths > 0, 'e2: death retains jump strength');
  load('e3'); scene.primaryAction(); advance(.5); scene.primaryAction(); advance(.5);
  assert(scene.people.length === 2 && scene.state.drops === 2, 'e3: physical people and accumulated speed');
  const stackWorld = scene.stackWorld; load('e4');
  assert(stackWorld.world.bodies.length === 0, 'e3: physics world disposed on switch');
  // 출구는 "최소로 꺾어도 10번"인 칸에만 놓인다. 미로를 40판 새로 뽑아 최소 꺾기 횟수를 직접 센다.
  const e4 = scene.stageGame, e4Turns = () => {
    const s = scene.state, cost = e4.scan(s.map, s.start, false);
    return Math.min(cost[s.goal * 4], cost[s.goal * 4 + 1], cost[s.goal * 4 + 2], cost[s.goal * 4 + 3]);
  };
  const e4Rounds = new Set();
  for (let round = 0; round < 40; round++) { load('e4'); e4Rounds.add(e4Turns() + ':' + scene.state.goal); }
  assert([...e4Rounds].every(round => round.startsWith('10:')), 'e4: every random maze exit needs exactly ten turns');
  assert(e4Rounds.size > 1, 'e4: maze and exit are regenerated each round');
  // 방향키를 아무 때나 여러 번 눌러도 통로 밖으로는 나가지 않는다.
  load('e4');
  let e4Inside = true;
  advance(19, frame => {
    if (frame % 3 === 0) { scene.touch.clear(); scene.directionPress(['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)]); }
    if (!scene.state.map[scene.state.cell]) e4Inside = false;
  });
  assert(e4Inside, 'e4: free direction mashing never leaves the maze corridors');
  load('e5'); scene.pointerAction(164, 382); scene.stageGame.pointerMove.call(scene, 64, 426); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.shots === 1 && scene.stageGame.power.call(scene) < 1, 'e5: drag fires and weakens rubber');
  load('e6'); scene.primaryAction(); const presses = scene.state.presses;
  scene.state.y = 100; advance(.02);
  assert(scene.state.hits === 1 && scene.state.presses === presses, 'e6: collision retains gravity penalty');
  load('e7'); scene.pointerAction(620, 321); advance(.05); scene.stageGame.pointerMove.call(scene, 480, 461); scene.stageGame.pointerUp.call(scene);
  // 회전량을 조정해도 검사가 깨지지 않도록 실제 tuning 범위로 확인한다.
  const spin = scene.stageGame.tuning;
  assert(scene.state.spinning && Math.abs(scene.state.speed) <= spin.maxSpeed && Math.abs(scene.state.speed) >= spin.minSpeed, 'e7: swipe speed clamped');
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
  const configSignature = () => JSON.stringify(seededId === 'e4' ? Array.from(scene.state.map) + `:${scene.state.start}:${scene.state.goal}`
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
  protocolSelectFlow.open();
  for (let storyIndex = 0; storyIndex < 18; storyIndex++) {
    const storyRun = archiveRun.snapshot();
    protocolSelectFlow.refreshStages();
    protocolSelectFlow.startStage(storyRun.expectedStageId);
    if (!scene.playable() && protocolSelectFlow.isBriefOpen()) document.querySelector('#protocol-brief-start').click();
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
