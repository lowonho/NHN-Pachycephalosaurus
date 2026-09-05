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
  assert(cutsceneImagePaths.length === 9
    && cutsceneImageSizes.every(({ width, height }) => width >= 1280 && height >= 720)
    && cutsceneImageSizes.slice(0, -1).every(({ width, height }) => Math.abs(width / height - 16 / 9) < .03), 'Nine cutscene backgrounds load at widescreen presentation resolution');
  assert(SCENARIO_DATA.backgrounds['op-01'].endsWith('/op1.png')
    && SCENARIO_DATA.backgrounds['op-02'].endsWith('/op1.png')
    && SCENARIO_DATA.backgrounds['op-03'].endsWith('/op02.png')
    && SCENARIO_DATA.backgrounds.assist.endsWith('/CUTSCENE H1.png')
    && SCENARIO_DATA.backgrounds.betrayal.endsWith('/CUTSCENE 01.png')
    && SCENARIO_DATA.backgrounds.experiment.endsWith('/ChatGPT Image 2026년 9월 5일 오후 05_22_17.png')
    && SCENARIO_DATA.backgrounds['ending-a'].endsWith('/barrier.png')
    && SCENARIO_DATA.backgrounds['ending-b'].endsWith('/barrier.png')
    && SCENARIO_DATA.backgrounds['ending-c'].endsWith('/barrier.png')
    && SCENARIO_DATA.backgrounds['ending-d-break'].endsWith('/ChatGPT Image 2026년 9월 5일 오후 07_30_12.png')
    && SCENARIO_DATA.backgrounds['ending-d'].endsWith('/ChatGPT Image 2026년 9월 5일 오후 05_12_03.png'), 'Opening, assist, betrayal, experiment and ending phases use their matching artwork');
  UI.cutscene.classList.remove('hidden'); cutsceneFlow.showBackground('op-01'); UI.cutscene.dataset.phase = 'op-01';
  assert(getComputedStyle(UI.cutsceneBackdrop).backgroundImage.includes('op1.png')
    && getComputedStyle(document.querySelector('.story-media-wall')).display === 'none', 'Rendered cutscene uses cover artwork instead of the old media placeholder');
  cutsceneFlow.showBackground('ending-d-break'); UI.cutscene.dataset.phase = 'ending-d-break';
  assert(getComputedStyle(UI.cutsceneBackdrop).backgroundImage.includes('07_30_12.png')
    && document.querySelector('.story-records') === null, 'The temporary centered English records graphic is removed');
  const barrierPhasesRender = ['ending-a', 'ending-b', 'ending-c'].every((phase) => {
    cutsceneFlow.showBackground(phase); UI.cutscene.dataset.phase = phase;
    const backdropStyle = getComputedStyle(UI.cutsceneBackdrop);
    return UI.cutscene.dataset.hasBackground === 'true'
      && backdropStyle.backgroundImage.includes('barrier.png')
      && backdropStyle.backgroundSize.includes('cover');
  });
  assert(barrierPhasesRender, 'CS-06A through CS-06C use the barrier artwork as a cover background');
  cutsceneFlow.showBackground('op-03'); UI.cutscene.dataset.phase = 'op-03';
  assert(UI.cutscene.dataset.hasBackground === 'true'
    && getComputedStyle(UI.cutsceneBackdrop).backgroundImage.includes('op02.png')
    && getComputedStyle(document.querySelector('.story-iris')).display === 'none', 'OP-03 starts the deleted-feed artwork after OP-01 and OP-02 share the first artwork');
  const screenCues = Object.values(SCENARIO_DATA.cutscenes).flatMap(({ script }) => script).filter(({ kind }) => kind === 'system');
  assert(screenCues.every(({ text }) => !/[A-Za-z]/.test(text)), 'Cutscene screen directions contain no English text');
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
    && UI.cutscene.dataset.cueKind === 'narration'
    && UI.cutsceneChapter.textContent === 'QA // OP-01 반복되는 피드 · 장면 설명 1/1 · 큐 1/14'
    && !cutsceneFlow.auto
    && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'false'
    && getComputedStyle(document.querySelector('.cutscene-speaker')).display === 'none'
    && getComputedStyle(document.querySelector('.cutscene-dialogue')).display !== 'none'
    && UI.cutsceneLine.textContent.startsWith('여느 때와 다름없이 김민은 릴스를 보고 있었다.')
    && UI.cutsceneLine.scrollHeight <= UI.cutsceneLine.clientHeight + 1
    && UI.qaPanel.classList.contains('hidden'), 'QA opening starts with the OP-01 scene description and AUTO disabled');
  UI.cutsceneAutoButton.click();
  assert(cutsceneFlow.auto && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'true', 'AUTO starts only when the player turns it on');
  UI.cutsceneAutoButton.click();
  assert(!cutsceneFlow.auto && UI.cutsceneAutoButton.getAttribute('aria-pressed') === 'false', 'AUTO can be turned off again');
  cutsceneFlow.advance();
  assert(UI.cutscene.dataset.phase === 'op-02'
    && UI.cutscene.dataset.cueKind === 'system'
    && UI.cutsceneChapter.textContent === 'QA // OP-02 일괄 삭제 · 화면 문구 1/1 · 큐 2/14'
    && getComputedStyle(document.querySelector('.cutscene-speaker')).display === 'none'
    && UI.cutsceneLine.textContent === '삭제됨\n검색 결과 0건', 'Korean screen directions render without a speaker name');
  const systemPanelRect = UI.cutscenePanel.getBoundingClientRect();
  const systemLineRect = UI.cutsceneLine.getBoundingClientRect();
  cutsceneFlow.advance();
  cutsceneFlow.completeTyping();
  const dialoguePanelRect = UI.cutscenePanel.getBoundingClientRect();
  const dialogueLineRect = UI.cutsceneLine.getBoundingClientRect();
  const sameRect = (a, b) => ['left', 'top', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) < .5);
  assert(UI.cutsceneSpeaker.textContent === '김민'
    && UI.cutsceneLine.textContent === '이상하다. 릴스가 끊길 리가 없는데.'
    && sameRect(systemPanelRect, dialoguePanelRect)
    && sameRect(systemLineRect, dialogueLineRect), 'OP-02 names Kim Min and keeps screen directions and dialogue at the same position');
  const indexedOpening = qaModeFlow.buildStoryPreviewScript(SCENARIO_DATA.cutscenes.opening.script);
  assert(indexedOpening[4].chapterLabel === 'QA // OP-03 삭제된 장면 재현 · 대사 2/3 · 큐 5/14', 'QA labels dialogue order inside each scene');
  cutsceneFlow.finish();
  assert(!UI.qaPanel.classList.contains('hidden') && qaStoryState() === beforeQaStory, 'QA story preview returns to QA without changing progress');
  cutsceneFlow.play({
    chapter: 'QA FINAL CARD',
    script: [SCENARIO_DATA.cutscenes.ending.script.at(-1)],
    auto: false,
    forceDisplay: true,
  });
  const everyScreenCueFits = screenCues.every(({ text }) => {
    UI.cutsceneLine.textContent = text;
    return UI.cutsceneLine.scrollHeight <= UI.cutsceneLine.clientHeight + 1;
  });
  assert(everyScreenCueFits && UI.cutscene.dataset.cueKind === 'system', 'Every Korean screen direction fits in the fixed subtitle panel');
  cutsceneFlow.finish();
  ARCHIVE_STORY_SETTINGS.skipCutscenes = false;
  qaModeFlow.deactivate();
  // 기록실 버튼은 도감이 있어 언제나 열린다 — 엔딩 전에 잠기는 것은 증언 기록 탭이다.
  assert(!UI.mainCodexButton.disabled && UI.codexRecordsTab.disabled, 'Testimony archive stays locked before the ending');
  const menuRect = UI.mainMenu.getBoundingClientRect();
  assert(document.querySelectorAll('.main-menu-actions .menu-button').length === 4
    && menuRect.top >= -1 && menuRect.bottom <= innerHeight + 1, 'Main menu shows four story actions inside the viewport');
  settingsFlow.open();
  const settingsRect = UI.settingsDialog.getBoundingClientRect();
  assert(document.querySelectorAll('.settings-row').length === 5
    && settingsRect.top >= -1 && settingsRect.bottom <= innerHeight + 1, 'Five setting rows fit inside the viewport');
  UI.cutsceneSpeed.value = '200'; UI.cutsceneSpeed.dispatchEvent(new Event('input'));
  assert(ARCHIVE_STORY_SETTINGS.cutsceneSpeed === 2, 'Cutscene speed setting updates');
  settingsFlow.cancel();
  assert(ARCHIVE_STORY_SETTINGS.cutsceneSpeed === 1, 'Cancel restores story settings');
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
  for (let i = 0; i < 20; i++) { scene.primaryAction(); advance(.05); releasedAfter.push(scene.hurdles.filter(h => h.loose).length); }
  assert(releasedAfter[0] === 0 && releasedAfter[1] === 1, 'e1: the first spike only drops on the second flip');
  assert(releasedAfter[19] === 20 && scene.risk === 100, 'e1: every spike is loose once risk tops out at twenty flips');
  const releaseSteps = releasedAfter.map((n, i) => n - (i ? releasedAfter[i - 1] : 0));
  const drops = releaseSteps.filter(n => n);
  assert(drops.length === 12, 'e1: the twenty flips carry twelve separate drops');
  assert(drops.every((n, i) => !i || n >= drops[i - 1]) && drops.at(-1) === 3, 'e1: each drop releases at least as many spikes as the one before');
  // 코스를 실제로 달리는 동안에도, 이번 반전에 새로 풀린 가시는 모두 플레이어 앞에 있어야 합니다.
  load('e1'); scene.state.immune = 100;
  let wastedDrops = 0, aheadDrops = 0;
  advance(16, frame => {
    if (frame % 90) return;
    const before = new Set(scene.hurdles.filter(h => h.loose));
    scene.primaryAction();
    const dropped = scene.hurdles.filter(h => h.loose && !before.has(h));
    wastedDrops += dropped.filter(h => h.x <= scene.state.x).length;
    aheadDrops += dropped.length;
  });
  assert(aheadDrops > 0 && wastedDrops === 0, 'e1: mid-course flips never waste a drop on a spike already behind');
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
  // Aim both drops at the pedestal: with no floor, a miss falls off the screen and is removed.
  load('e3'); scene.state.x = 480; scene.primaryAction(); advance(.5); scene.state.x = 480; scene.primaryAction(); advance(.5);
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
  assert(Math.abs(scene.remaining - (20.26 - scene.elapsed - 2)) < .00001, 'e4: timer retains penalties');
  scene.remaining = .5; scene.timePenalty = 20.26 - scene.elapsed - .5;
  scene.directionRelease('left'); scene.directionPress('right'); advance(.1);
  scene.directionRelease('right'); scene.directionPress('left'); advance(.2);
  assert(scene.mode === 'done' && scene.remaining === 0, 'e4: impact can exhaust timer');
  load('e4');
  assert(scene.state.hits === 0 && scene.timePenalty === 0 && scene.remaining === 20.26, 'e4: retry resets timer and penalty');
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
  load('e8');
  assert(scene.state.rope?.starter && !('grounded' in scene.state) && !scene.roofs, 'e8: starts in an aerial swing without running or landing platforms');
  const startSpeed = scene.state.speed;
  advance(.45);
  assert(scene.state.vx !== startSpeed && scene.state.multiplier === 1, 'e8: pendulum changes velocity under gravity without time-based boosts');
  const r = scene.state.rope, a = scene.anchors[r.anchor];
  assert(Math.abs(Math.hypot(scene.state.x-a.x,scene.state.y-a.y)-r.length)<.001 && Math.abs((scene.state.x-a.x)*scene.state.vx+(scene.state.y-a.y)*scene.state.vy)<.001, 'e8: web keeps constant length and tangential velocity');
  scene.touch.add('action'); scene.primaryAction(); scene.touch.clear();
  const launch = {x:scene.state.x,y:scene.state.y,vx:scene.state.vx,vy:scene.state.vy};
  advance(1/120);
  assert(!scene.state.rope && Math.abs(scene.state.vx-launch.vx)<.001 && Math.abs(scene.state.vy-launch.vy-scene.stageGame.airGravity.call(scene)/120)<.001, 'e8: release preserves horizontal momentum and gravity changes vertical velocity');
  const fallSamples=[];
  for(const multiplier of [1,3]) {
    load('e8'); Object.assign(scene.state,{rope:null,x:1500,y:320,vx:1050,vy:-350,multiplier});
    advance(.3); fallSamples.push({x:scene.state.x,y:scene.state.y,vy:scene.state.vy});
  }
  assert(Math.abs(fallSamples[0].x-fallSamples[1].x)<.001 && fallSamples[1].y>fallSamples[0].y+30 && fallSamples[1].vy>fallSamples[0].vy+200,
    'e8: accumulated speed increases downward pull without erasing horizontal momentum');
  load('e8'); Object.assign(scene.state,{rope:null,x:1500,y:320,vx:1050,vy:-400,multiplier:3});
  let coastX=1500;
  advance(.85,()=>{if(!scene.state.deaths) coastX=Math.max(coastX,scene.state.x);});
  assert(scene.state.deaths===1 && coastX-1500<scene.stageGame.tuning.spacing*1.3, 'e8: fast unassisted flight drops before coasting across multiple building gaps');
  load('e8'); scene.touch.add('action'); scene.primaryAction(); advance(.1); scene.touch.clear(); advance(.02);
  const beforeCatch = {x:scene.state.x,y:scene.state.y,multiplier:scene.state.multiplier,speed:Math.hypot(scene.state.vx,scene.state.vy)};
  scene.pointerAction(600,300);
  assert(scene.state.rope && Math.hypot(scene.state.x-beforeCatch.x,scene.state.y-beforeCatch.y)<.001 && scene.state.multiplier===beforeCatch.multiplier && Math.abs(scene.state.rope.omega*scene.state.rope.length)<=beforeCatch.speed+.001, 'e8: catching the same anchor neither teleports nor adds a boost');
  scene.stageGame.pointerUp.call(scene);
  assert(!scene.state.rope && !scene.state.pointerHeld, 'e8: mouse release detaches the web');
  scene.pointerAction(600,300); const pauseX=scene.state.x;
  archiveGame.pause(true); scene.update(0,1000);
  assert(scene.state.x===pauseX && !scene.state.rope && !scene.state.pointerHeld, 'e8: pause freezes motion and cancels held web input');
  load('e8'); driveE8(1.6);
  assert(Math.abs(scene.state.multiplier-1.35)<.0001, 'e8: first new anchor immediately adds a 35 percent boost');
  const savedBoost=scene.state.multiplier, visited=scene.state.visited.join(',');
  scene.state.rope=null; scene.state.y=720; advance(.02);
  assert(scene.state.deaths===1 && scene.state.multiplier===savedBoost && scene.state.visited.join(',')===visited && scene.state.rope?.starter, 'e8: fall resumes in the air with boosts and visited anchors preserved');
  load('e8'); advance(20.3);
  assert(scene.mode==='done' && scene.state.x<scene.goalX && scene.state.multiplier===1, 'e8: waiting cannot clear or accumulate boosts');
  for(const options of [{},{releaseAngle:.6},{reactionFrames:10,releaseAngle:.45},{reactionFrames:10,releaseAngle:.5}]) {
    load('e8'); driveE8(20.3,options);
    assert(scene.mode==='done' && scene.elapsed>15 && scene.elapsed<20.26 && scene.state.x>=scene.goalX && scene.state.deaths===0 && scene.state.multiplier===3,
      `e8: aerial course clears without falls with capped boosts ${JSON.stringify(options)}`);
  }
  load('e8');
  assert(scene.state.multiplier===1 && scene.state.visited.length===1 && scene.state.hooks===0, 'e8: fresh retry resets accumulated boosts');
  // Every direction is eligible, including the just-released anchor behind or below the player.
  for(const [dx,dy] of [[70,60],[0,-60],[0,30],[320,560]]) {
    load('e8'); const a=scene.anchors[1];
    Object.assign(scene.state,{x:a.x+dx,y:a.y+dy,vx:250,vy:100,rope:null});
    const expected=[...scene.anchors].sort((a,b)=>Math.hypot(a.x-scene.state.x,a.y-scene.state.y)-Math.hypot(b.x-scene.state.x,b.y-scene.state.y))[0];
    const position={x:scene.state.x,y:scene.state.y};
    scene.touch.add('action'); scene.primaryAction();
    assert(scene.state.rope?.anchor===expected.index && Math.hypot(scene.state.x-position.x,scene.state.y-position.y)<.001,
      `e8: nearest anchor connects without direction, height, or former range restrictions ${dx},${dy}`);
    const multiplier=scene.state.multiplier;
    scene.primaryAction();
    assert(scene.state.rope?.anchor===expected.index && scene.state.multiplier===multiplier,
      `e8: immediate repress can recatch the same anchor without another boost ${dx},${dy}`);
  }
  load('e8'); driveE8(5);
  assert(scene.state.visited.length>=5 && scene.state.multiplier===3, 'e8: four new connections reach the 3x boost cap');
  load('e9'); scene.pointerAction(166, 361); scene.stageGame.pointerMove.call(scene, 150, 361); scene.stageGame.pointerUp.call(scene); advance(1);
  assert(scene.state.failures === 1 && scene.state.x === 166 && scene.stageGame.friction.call(scene) < 220, 'e9: failed stone resets; ice remains slippery');
  advance(.4); scene.pointerAction(166, 361);
  assert(scene.state.drag !== null, 'e9: a new stone can be thrown after a failed one');
  scene.stageGame.cancelInput.call(scene);
  // 과녁 정중앙이 아니어도 점선 고리 안에서 멈추면 그 한 번으로 클리어된다.
  const curl = offset => {
    load('e9');
    const s = scene.state, dx = scene.target.x + offset - s.x, dy = scene.target.y - s.y, distance = Math.hypot(dx, dy);
    const pull = Math.sqrt(2 * scene.stageGame.friction.call(scene) * distance) / scene.stageGame.tuning.force;
    scene.pointerAction(s.x, s.y);
    scene.stageGame.pointerMove.call(scene, s.x - dx / distance * pull, s.y - dy / distance * pull);
    scene.stageGame.pointerUp.call(scene);
    advance(20.3);
  };
  curl(scene.stageGame.landingRadius() - 7);
  assert(scene.actions === 1 && scene.state.failures === 0 && scene.remaining > 10, 'e9: one stone resting inside the ring clears the stage');
  curl(scene.stageGame.landingRadius() + 25);
  assert(scene.state.failures > 0 && scene.remaining <= .000001, 'e9: a stone resting outside the ring still misses');
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
  const randomConfigGames = new Set(['e4']); // The merged maze generator must use the story seed.
  let seededRun = archiveRun.reset();
  for (let attempt = 0; attempt < 100 && !randomConfigGames.has(seededRun.expectedStageId); attempt++) seededRun = archiveRun.reset();
  assert(randomConfigGames.has(seededRun.expectedStageId), 'A random-layout stage can be selected for retry verification');
  protocolSelectFlow.refreshStages();
  const seededId = seededRun.expectedStageId;
  protocolSelectFlow.launchStage(seededId);
  const configSignature = () => JSON.stringify(seededId === 'e4' ? JSON.stringify({tiles:scene.state.tiles,goal:scene.state.goal})
    : seededId === 'e7' ? scene.state.rotation
      : seededId === 'e8' ? scene.anchors : scene.state.target);
  const firstConfig = configSignature();
  scene.finish(false); document.querySelector('#primary-button').click();
  assert(configSignature() === firstConfig, `${seededId}: life retry preserves the random layout or target`);
  archiveGameBridge.stop();
  archiveRun.setSelection(MINIGAME_CATALOG.map(stage => stage.id));
  archiveRun.beginAttempt('e4'); archiveRun.consume(500); archiveRun.syncRemaining(18_760);
  assert(archiveRun.snapshot().stageRemainingMs === 18_760 && archiveRun.snapshot().elapsedMs === 500,
    'e4: wall penalties synchronize the story clock without counting as elapsed play time');
  archiveRun.exitQa();
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
  assert(protocolSelectFlow.isBriefOpen() && !UI.protocolBrief.hidden, 'Continuing opens the next briefing with no stage list in between');
  assert(UI.protocolBriefTitle.textContent === protocolSelectFlow.catalog.find(stage => stage.id === archiveRun.snapshot().expectedStageId).title,
    'The briefing shows the stage the story expects next');
  assert(UI.protocolBriefLives.textContent === 'LIVES ◆◆◆', 'The briefing footer keeps the remaining lives');
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
