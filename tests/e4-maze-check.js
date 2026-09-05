(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep();
  const checks = [];
  const assert = (value, name) => { if (!value) throw Error(name); checks.push(name); };
  const load = id => { archiveGameBridge.active = false; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  load('e4');
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
  const e4 = scene.stageGame, grid = e4.grid, bounds = e4.tileRect(grid.cols - 1, grid.rows - 1);
  // 필드(가로 20~940, 세로 61.75~579.25) 안에 들어가고, 아래 조작 안내 줄과도 겹치지 않는다.
  assert(grid.x >= 20 && grid.y >= 80 && grid.x + bounds.x + bounds.w <= 940 && grid.y + bounds.y + bounds.h <= 540, 'e4: whole maze fits fixed viewport');
  assert(grid.passageX >= 80 && grid.passageY >= 80 && grid.wall === 12, 'e4: wide passages with thin walls');
  assert(!scene.readout?.visible && bounds.y + bounds.h === 384, 'e4: explanation row is replaced with a taller playable maze');
  // 위아래 여백이 같아야 미로가 위로 쏠려 보이지 않는다.
  const topGap = grid.y - 61.75, bottomGap = 579.25 - (grid.y + bounds.y + bounds.h);
  assert(Math.abs(topGap - bottomGap) <= 1 && Math.abs((grid.x - 20) - (940 - grid.x - bounds.x - bounds.w)) <= 1, 'e4: maze sits centered in the field');
  const direction = scene.state.tiles[1][2] === 0 ? 'right' : 'down';
  const origin = { x: scene.state.x, y: scene.state.y };
  scene.directionPress(direction); advance(.1);
  const first = Math.hypot(scene.state.x - origin.x, scene.state.y - origin.y);
  const middle = { x: scene.state.x, y: scene.state.y };
  advance(.1);
  const second = Math.hypot(scene.state.x - middle.x, scene.state.y - middle.y);
  assert(Math.abs(second - first) < .001 && scene.state.speed === 340 && scene.actions === 1, 'e4: held input keeps constant speed after one tap');
  scene.directionRelease(direction);
  const storedSpeed = scene.state.speed;
  const stop = { x: scene.state.x, y: scene.state.y }; advance(.1);
  assert(Math.hypot(scene.state.x - stop.x, scene.state.y - stop.y) > 2 && !scene.state.moving, 'e4: release glides briefly before stopping');
  assert(scene.state.speed === storedSpeed, 'e4: stopping cannot reset accumulated speed');
  scene.directionPress(direction); advance(1 / 120);
  assert(scene.state.speed === storedSpeed + e4.tuning.tapGain && scene.state.turns === 0, 'e4: same-direction repress increases accumulated speed');
  assert(Math.abs(Math.hypot(scene.state.vx, scene.state.vy) - scene.state.speed) < .001, 'e4: short tap uses the newly accumulated speed');
  assert(scene.mazeLabels[0].x === grid.x + origin.x && scene.mazeLabels[0].y === grid.y + origin.y + 28, 'e4: camera stays fixed during movement');
  load('e4');
  const before = { x: scene.state.x, y: scene.state.y };
  scene.directionPress('right'); advance(.08);
  const straightDistance = Math.hypot(scene.state.x - before.x, scene.state.y - before.y);
  scene.touch.clear(); Object.assign(scene.state, before, { speed: e4.tuning.speed, heading: null, vx: 0, vy: 0 });
  scene.directionPress('right'); scene.directionPress('down'); scene.state.speed -= e4.tuning.tapGain; advance(.08);
  assert(Math.abs(Math.hypot(scene.state.x - before.x, scene.state.y - before.y) - straightDistance) < .001, 'e4: diagonal input does not exceed cardinal speed');
  load('e4');
  scene.state.speed = e4.tuning.maxSpeed; scene.state.vx = -e4.tuning.maxSpeed; scene.directionPress('left'); advance(.3);
  assert(scene.state.x >= grid.wall + e4.tuning.radius && scene.state.hits === 1 && !e4.wallsAt.call(scene, scene.state.x, scene.state.y).length, 'e4: maximum speed cannot tunnel through a 12px wall');
  load('e4');
  scene.directionPress('right'); advance(.1);
  const beforeTurn = scene.state.speed;
  scene.directionRelease('right'); scene.directionPress('down'); advance(.025);
  assert(scene.state.speed === beforeTurn + e4.tuning.tapGain && scene.state.turns === 1 && scene.state.moving, 'e4: different-direction tap adds the same 100px/s boost');
  advance(.025);
  assert(scene.state.turns === 1, 'e4: holding direction does not repeat turn boost');
  load('e4');
  for (let tap = 1; tap <= 12; tap++) {
    scene.directionPress('right'); scene.directionPress('right');
    assert(scene.state.speed === Math.min(1100, 240 + tap * 100) && scene.actions === tap, 'e4: tap ' + tap + ' adds one capped speed step');
    scene.directionRelease('right');
  }
  advance(.2);
  assert(scene.state.speed === 1100 && scene.state.vx === 0, 'e4: released input retains capped speed without automatic movement');
  const coast = (speed, step = 1 / 120) => {
    load('e4');
    const initialX = scene.state.x;
    Object.assign(scene.state, { speed, vx: speed, vy: 0 });
    for (let i = 0; i < Math.ceil(.3 / step); i++) e4.update.call(scene, step);
    assert(scene.state.vx === 0 && scene.state.vy === 0 && scene.state.hits === 0, 'e4: braking reaches rest in open corridor');
    return scene.state.x - initialX;
  };
  const lowDrift = coast(280), highDrift = coast(1100);
  assert(lowDrift > 8 && lowDrift < 11 && highDrift > 106 && highDrift < 116, 'e4: high speed slides over about 112px versus 10px at low speed');
  // 관성이 남는 구간: 등감속이라면 이미 서 있을 시점에도 아직 미끄러지는 중이어야 한다.
  load('e4'); Object.assign(scene.state, { speed: 1100, vx: 1100, vy: 0 });
  for (let i = 0; i < 18; i++) e4.update.call(scene, 1 / 120);
  assert(scene.state.vx > 240 && scene.state.vx < 360 && scene.state.moving, 'e4: releasing at top speed still coasts after 0.15s');
  assert(Math.abs(coast(1100, 1 / 60) - highDrift) < .001, 'e4: brake distance stays consistent across simulation step sizes');
  load('e4'); Object.assign(scene.state, { x: 30, speed: 1100, vx: -1100, vy: 0 });
  advance(.2);
  assert(scene.state.hits === 1 && scene.timePenalty === 1 && scene.state.x >= 22 && scene.state.vx === 0, 'e4: braking into wall stops drift and costs one second');
  advance(.2);
  assert(scene.state.hits === 1, 'e4: stopped drift does not repeatedly charge wall penalty');
  load('e4'); Object.assign(scene.state, { speed: 1100, vx: 1100, vy: 0 });
  const frozenX = scene.state.x;
  archiveGame.pause(true); scene.update(0, 500);
  assert(scene.state.x === frozenX && scene.state.vx === 1100, 'e4: pause freezes braking motion');
  archiveGame.pause(false); advance(.3);
  assert(scene.state.x > frozenX && scene.state.vx === 0, 'e4: resume completes pending braking');
  load('e4'); advance(20.3);
  assert(scene.mode === 'done' && scene.remaining === 0 && Math.abs(scene.elapsed - 20.26) < .001, 'e4: time expires at 20.26 seconds');

  for (let attempt = 0; attempt < 25; attempt++) {
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
  const dirs = path.slice(1).map((p, i) => `${p.x - path[i].x},${p.y - path[i].y}`);
  const turns = dirs.slice(1).filter((d, i) => d !== dirs[i]).length;
  assert(turns === 7, 'e4: generated maze ' + attempt + ' needs seven turns to exit');
  let waypoint = 1;
  advance(20.3, () => {
    const p = path[waypoint]; if (!p) return;
    const dx = center(p.x, p.y).x - maze.x, dy = center(p.x, p.y).y - maze.y;
    scene.touch.clear();
    if (Math.hypot(dx, dy) < 8) { waypoint++; return; }
    scene.directionPress(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }); assert(scene.mode === 'done' && Math.hypot(maze.x - maze.goal.x, maze.y - maze.goal.y) < 16, 'e4: generated maze ' + attempt + ' cleared with real movement');

  }
  load('e4');
  const qaActive = ARCHIVE_QA.active, qaTime = ARCHIVE_QA.timeLimit;
  ARCHIVE_QA.active = true; ARCHIVE_QA.timeLimit = 12; load('e4');
  assert(scene.timeLimit === 12, 'e4: QA time override works');
  ARCHIVE_QA.active = qaActive; ARCHIVE_QA.timeLimit = qaTime; load('e4');
  const run = archiveRun;
  run.setAttemptTime(20260); run.syncRemaining(17260);
  assert(run.snapshot().totalRemainingMs === 17260, 'e4: desk clock accepts penalty-adjusted remaining time');
  run.setAttemptTime(20260);
  assert(archiveRecords.record('e4', 19, 10).best.elapsed <= 19, 'e4: clear records within new time limit save');
  return checks;
})()
