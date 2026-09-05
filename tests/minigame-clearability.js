(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false; modalFlow.close();
  const results = [];
  let outcome;
  const listener = event => { outcome = event.detail; };
  window.addEventListener('archive-stage-end', listener);
  const load = id => { outcome = null; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  const save = id => results.push({ id, success: outcome?.success ?? false, elapsed: scene.elapsed, actions: scene.actions, state: JSON.parse(JSON.stringify(scene.state, (key, value) => ['obstacles','points','balls','targets','timbers','map','toGoal','seen'].includes(key) ? undefined : value)) });
  load('e1');
  const flippedGates = new Set();
  const lead = scene.hurdles[0].x, gateGap = scene.hurdles[2].x - scene.hurdles[0].x;
  advance(20.3, () => {
    const s = scene.state;
    // 다음 묶음 0.386초 앞에서 반전해 느리게 따라오는 가시/블록보다 먼저 벽을 옮깁니다.
    // 코스 간격은 속도에 따라 달라지므로 반응 거리도 속도에서 뽑습니다.
    // 가시는 묶음마다 두 개씩 붙어 있으므로 묶음 번호로 묶어 한 번만 반전합니다.
    const next = scene.hurdles.find(h => h.x - s.x > -15), gate = next && Math.round((next.x - lead) / gateGap);
    if (next && next.x - s.x < scene.stageGame.tuning.speed * .386 && !flippedGates.has(gate)) { flippedGates.add(gate); scene.primaryAction(); }
  }); save('e1');
  load('e2'); driveE2(); save('e2');
  load('e3');
  let lastDrop = -10;
  // 메챠 포즈는 옛 마네킹보다 훨씬 홀쭉해서, 한 명이 자리를 잡는 데 1초쯤 걸린다.
  // 그보다 빨리 떨어뜨리면 이미 서 있는 사람을 무너뜨리기만 한다.
  // 떨어진 사람은 레일 속도를 물려받아 옆으로 흐르므로, 낙하 시간만큼 앞서 겨냥해 놓는다.
  // 단상이 넓으니 픽셀 단위로 맞출 필요는 없다 — 사람처럼 한가운데 20px 안쪽이면 떨어뜨린다.
  const e3OnTarget = () => {
    const t = scene.stageGame.tuning, s = scene.state, rail = scene.stageGame.speed.call(scene);
    const flight = Math.sqrt(2 * Math.max(40, t.baseY - s.height - s.spawnY) / (t.gravity * 1000));
    return Math.abs(s.x + s.direction * rail * t.carryMomentum * flight - 480) < Math.max(20, rail / 90);
  };
  advance(20.3, () => { if (e3OnTarget() && scene.elapsed - lastDrop > 1 && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); lastDrop = scene.elapsed; } });
  save('e3');
  load('e4');
  const maze = scene.state, center = scene.stageGame.tileCenter;
  const queue = [{ x: 1, y: 1, parent: -1 }], seen = new Set(['1,1']);
  let end;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (Math.hypot(center(p.x, p.y).x - maze.goal.x, center(p.x, p.y).y - maze.goal.y) < 1) { end = i; break; }
    for (const d of Object.values(scene.stageGame.steps)) {
      const x = p.x + d.x, y = p.y + d.y, key = `${x},${y}`;
      if (maze.tiles[y]?.[x] === 0 && !seen.has(key)) { seen.add(key); queue.push({ x, y, parent: i }); }
    }
  }
  if (end === undefined) throw Error('e4: unreachable exit');
  const path = [];
  for (let i = end; i >= 0; i = queue[i].parent) path.unshift(queue[i]);
  let waypoint = 1;
  advance(20.3, () => {
    const p = path[waypoint]; if (!p) return;
    const dx = center(p.x, p.y).x - maze.x, dy = center(p.x, p.y).y - maze.y;
    scene.touch.clear();
    if (Math.hypot(dx, dy) < 8) { waypoint++; return; }
    scene.directionPress(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }); save('e4');
  load('e5');
  // Real full-pull inputs: fracture the supports, then hit the remaining resident through the rubble.
  // The former predictor ignored Matter joints and kept aiming at the same ineffective obstacle.
  // 무너지는 과정은 강체 시뮬레이션이라 판이 조금만 움직여도 같은 각도가 다른 결과를 낳는다.
  // 무대 좌표를 옮겼다면 이 각도들도 실제로 클리어되는 조합으로 다시 찾아야 한다.
  for(const angle of [.2, .3, .3, .3, .2, .3]) {
    if(!scene.playable()) break;
    const pull=scene.stageGame.tuning.maxPull;
    scene.pointerAction(164,418);
    scene.stageGame.pointerMove.call(scene,164-Math.cos(angle)*pull,418+Math.sin(angle)*pull);
    scene.stageGame.pointerUp.call(scene);
    advance(1.5);
  }
  advance(2); save('e5');
  // e6은 밈 세트가 무작위로 서므로 판이 매번 다르다. 4글자 기둥 쌍이 어느 벽에서 시작하느냐에 따라
  // 한 판은 20.26초 안에 못 들어올 수 있어, 사람이 그러듯 세 판까지 다시 날아 본다.
  // 세 판 모두 못 끝내면 그건 운이 아니라 스테이지가 막힌 것이다.
  const flyE6 = () => advance(20.3, frame => {
    if (frame % 16 !== 0) return; // 사람도 입력 가능한 133ms 간격으로만 조작.
    const s = scene.state, ahead = s.x + 70;
    const index = scene.gates.findIndex(g => g.x > ahead);
    const next = scene.gates[index] ?? {x: 4400, y: 315};
    const previous = scene.gates[Math.max(0,index - 1)] ?? {x: 0, y: 323};
    const fraction = Math.max(0, Math.min(1, (ahead - previous.x)/(next.x-previous.x || 1)));
    const desired = previous.y+(next.y-previous.y)*fraction;
    const vy = Math.max(-190,Math.min(190,(desired-s.y)*3));
    const hold = s.vy > vy;
    if(hold && !scene.touch.has('action')) { scene.touch.add('action'); scene.primaryAction(); }
    if(!hold) scene.touch.delete('action');
  });
  let clearedE6 = false;
  for (let attempt = 1; attempt <= 3 && !clearedE6; attempt++) { load('e6'); flyE6(); clearedE6 = Boolean(outcome?.success); }
  save('e6');
  // A real random roulette round can lose; verify the actual resting wedge judges both outcomes.
  load('e7'); scene.state.rotation = scene.stageGame.POINTER_ANGLE - .2; scene.state.spinning=true; scene.state.speed=.0001; scene.state.deceleration=8;
  advance(.02); save('e7');
  load('e8'); driveE8(); save('e8');
  load('e9');
  const dx=scene.target.x-scene.state.x, dy=scene.target.y-scene.state.y, distance=Math.hypot(dx,dy);
  const pull=Math.sqrt(2*220*distance)/5.7;
  scene.pointerAction(scene.state.x,scene.state.y); scene.stageGame.pointerMove.call(scene,scene.state.x-dx/distance*pull,scene.state.y-dy/distance*pull); scene.stageGame.pointerUp.call(scene);
  advance(20.3); save('e9');
  load('e10');
  // 실제 이동·제동·점프만으로 가장 긴 왕복 조합을 입력한다(9→0→9→0).
  scene.state.target = '9090';
  let decodeDirection = null;
  const steerDecode = direction => {
    if (direction === decodeDirection) return;
    if (decodeDirection) scene.directionRelease(decodeDirection);
    decodeDirection = direction;
    if (decodeDirection) scene.directionPress(decodeDirection);
  };
  advance(20.3, () => {
    const s = scene.state, t = scene.stageGame.tuning;
    const expected = s.target[s.input.length];
    if (!expected) { steerDecode(null); return; }
    const block = scene.digitBlocks.find(item => item.digit === expected);
    const targetX = block.x + block.w / 2;
    const error = targetX - s.x;
    if (!s.grounded) {
      if (Math.abs(s.vx) > 28) steerDecode(s.vx > 0 ? 'left' : 'right');
      else steerDecode(null);
      return;
    }
    if (Math.abs(error) < 25 && Math.abs(s.vx) < 32) {
      steerDecode(null); scene.primaryAction(); return;
    }
    const towardTarget = Math.sign(s.vx) === Math.sign(error);
    const brakeDistance = s.vx * s.vx / (2 * t.acceleration);
    if (towardTarget && Math.abs(error) < brakeDistance + 13) steerDecode(s.vx > 0 ? 'left' : 'right');
    else steerDecode(error < 0 ? 'left' : 'right');
  });
  steerDecode(null);
  save('e10');
  window.removeEventListener('archive-stage-end', listener);
  const failures = results.filter(result => !result.success);
  if (failures.length) throw new Error(`Clearability failed: ${JSON.stringify(failures)}`);
  return results;
})()
