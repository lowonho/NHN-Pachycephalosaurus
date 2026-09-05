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
  // 기록실 버튼은 도감이 있어 언제나 열린다 — 엔딩 전에 잠기는 것은 증언 기록 탭이다.
  assert(!UI.mainCodexButton.disabled && UI.codexRecordsTab.disabled, 'Testimony archive stays locked before the ending');
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
  const spikes = () => scene.state.obstacles.filter(o => o.spike),
    blocks = () => scene.state.obstacles.filter(o => !o.spike && !o.float),
    floats = () => scene.state.obstacles.filter(o => o.float);
  // 통로 좌표는 코스에서 읽습니다. 가시가 붙어 있는 두 벽이 곧 천장 아랫면과 바닥 윗면입니다.
  const ceilBottom = Math.min(...scene.hurdles.map(h => h.wall)), floorTop = Math.max(...scene.hurdles.map(h => h.wall)) + 24, floorY = scene.state.y;
  assert(spikes().length === 20 && blocks().length === 5 && floats().length === 4, 'e1: course holds 20 spikes, 5 blocks and 4 floating blocks');
  scene.state.immune = 100;
  advance(2.8);  // 넓어진 통로를 최고 속도로도 다 건너려면 2초로는 모자랍니다.
  assert(spikes().every(o => !o.loose && o.y === o.wall), 'e1: spikes stay clamped to their wall before any flip');
  assert(blocks().every(o => o.y === floorTop - o.h) && floats().every(o => o.y === ceilBottom), 'e1: both block types move to their gravity walls');
  const obstacleStart = scene.state.obstacles.map(o => o.y);
  scene.primaryAction();
  assert(scene.state.sign === -1, 'e1: action flips gravity instead of jumping');
  let maxObstacleSpeed = 0;
  advance(.5, () => { maxObstacleSpeed = Math.max(maxObstacleSpeed, ...scene.state.obstacles.map(o => Math.abs(o.vy))); });
  assert(scene.state.y < ceilBottom + 30 && scene.state.vy === 0, 'e1: player sticks to the ceiling wall');
  assert(spikes().every(o => !o.loose), 'e1: the first flip is too early to release any spike');
  assert(scene.state.obstacles.every((o, i) => o.spike && !o.loose ? o.y === obstacleStart[i] : o.y !== obstacleStart[i]), 'e1: released obstacles respond to the flip while attached spikes hold still');
  assert(maxObstacleSpeed > 0 && maxObstacleSpeed <= 190 && maxObstacleSpeed < scene.stageGame.tuning.speed, 'e1: obstacle motion stays slower than player travel');
  assert(blocks().every(o => o.y > ceilBottom), 'e1: player reaches ceiling before following obstacles');
  advance(2.5); assert(blocks().every(o => o.y === ceilBottom) && floats().every(o => o.y === floorTop - o.h), 'e1: following and opposing obstacles settle on different walls');
  scene.primaryAction(); advance(.5);
  assert(Math.abs(scene.state.y - floorY) < 1, 'e1: pressing again returns to the floor wall');
  assert(scene.hurdles.length === 20 && scene.hurdles.every(h => scene.state.obstacles.includes(h)), 'e1: twenty spikes share the moving obstacle simulation');
  // 묶음 간격은 속도에 비례하므로 좌표가 아니라 반전 횟수만 확인합니다.
  load('e1'); scene.state.immune = 100;
  const releasedAfter = [];
  for (let i = 0; i < 25; i++) { scene.primaryAction(); advance(.05); releasedAfter.push(scene.hurdles.filter(h => h.loose).length); }
  assert(releasedAfter[1] === 0 && releasedAfter[2] === 1, 'e1: the first spike only drops on the third flip');
  assert(releasedAfter[24] === 20 && scene.risk === 100, 'e1: every spike is loose once risk tops out at twenty-five flips');
  const releaseSteps = releasedAfter.map((n, i) => n - (i ? releasedAfter[i - 1] : 0));
  const drops = releaseSteps.filter(n => n);
  assert(drops.length === 12 && releaseSteps.every((n, i) => !n || i % 2 === 0), 'e1: spikes drop on every other flip, not on every one');
  assert(drops.every((n, i) => !i || n >= drops[i - 1]) && drops.at(-1) === 3, 'e1: each drop releases at least as many spikes as the one before');
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
  // 장애물은 코스에 미리 깔아 두지 않는다 — 사정거리 안으로 들어온 것만, 그것도 화면 오른쪽 바깥에서 태어난다.
  load('e6');
  const flight = scene.stageGame.tuning;
  assert(scene.gates.length <= 4 && scene.gates.every(gate => gate.x <= flight.spawnAhead), 'e6: only obstacles inside the spawn range exist');
  const bornGates = new Set(scene.gates.map(gate => gate.x));
  let poppedOnScreen = false, liveGates = scene.gates.length;
  const memeWords = [];
  advance(9, frame => {
    // 앞뒤 장애물의 통과 지점을 이어 그 선을 따라 난다(클리어 검사와 같은 조종).
    if (frame % 16 === 0) {
      const ahead = scene.state.x + 70;
      const index = scene.gates.findIndex(gate => gate.x > ahead);
      const next = scene.gates[index] ?? { x: flight.distance, y: 318 };
      const previous = scene.gates[Math.max(0, index - 1)] ?? { x: 0, y: 323 };
      const along = Math.max(0, Math.min(1, (ahead - previous.x) / (next.x - previous.x || 1)));
      const desired = previous.y + (next.y - previous.y) * along;
      const hold = scene.state.vy > Math.max(-190, Math.min(190, (desired - scene.state.y) * 3));
      if (hold && !scene.touch.has('action')) { scene.touch.add('action'); scene.primaryAction(); }
      if (!hold) scene.touch.delete('action');
    }
    for (const gate of scene.gates) {
      if (bornGates.has(gate.x)) continue;
      bornGates.add(gate.x); memeWords.push(gate.word);
      if (gate.x - scene.state.x < 810) poppedOnScreen = true;
      // 밈 글자는 벽에 붙어 서고, 남은 통로는 언제나 minGap 이상 열려 있다.
      const onWall = gate.side === 'top' ? gate.top === 168 : gate.bottom === 468;
      const gap = gate.side === 'top' ? 468 - gate.bottom : gate.top - 168;
      if (!onWall || gap < flight.minGap - .5 || gate.halfWidth <= 5) throw Error(`e6: bad meme pillar ${JSON.stringify(gate)}`);
    }
    liveGates = Math.max(liveGates, scene.gates.length);
  });
  assert(!poppedOnScreen, 'e6: obstacles are born off-screen instead of popping into view');
  assert(bornGates.size > scene.gates.length && liveGates <= 6, 'e6: passed obstacles are dropped instead of piling up');
  const memeSentence = scene.stageGame.words;
  assert(memeWords.length > 0 && memeWords.every((word, index) => word === memeSentence[(index + 2) % memeSentence.length]), 'e6: the meme sentence cycles through its words in order');
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
  // 기록실은 도감 탭으로 뜬다 — 증언 기록은 엔딩에서 풀린 탭으로 넘어가 읽는다.
  codexFlow.open();
  codexFlow.showTab('records');
  const codexRect = UI.codexDialog.getBoundingClientRect();
  assert(document.querySelectorAll('.codex-card[data-discovered="true"]').length === 18
    && codexRect.top >= -1 && codexRect.bottom <= innerHeight + 1, 'Unlocked testimony archive shows eighteen records inside the viewport');
  codexFlow.close({ restoreFocus: false });
  ARCHIVE_STORY_SETTINGS.skipCutscenes = false;
  return { passed: checks.length, checks: checks.filter(name => !name.startsWith('Unique random selection')) };
})()
