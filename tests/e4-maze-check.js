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
  assert(Math.abs(scene.remaining - (90 - scene.elapsed - 2)) < .00001, 'e4: timer retains penalties');
  scene.remaining = .5; scene.timePenalty = 90 - scene.elapsed - .5;
  scene.directionRelease('left'); scene.directionPress('right'); advance(.1);
  scene.directionRelease('right'); scene.directionPress('left'); advance(.2);
  assert(scene.mode === 'done' && scene.remaining === 0, 'e4: impact can exhaust timer');
  load('e4');
  assert(scene.state.hits === 0 && scene.timePenalty === 0 && scene.remaining === 90, 'e4: retry resets timer and penalty');

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
  let waypoint = 1;
  advance(90.1, () => {
    const p = path[waypoint]; if (!p) return;
    const dx = center(p.x, p.y).x - maze.x, dy = center(p.x, p.y).y - maze.y;
    scene.touch.clear();
    if (Math.hypot(dx, dy) < 3) { waypoint++; return; }
    scene.directionPress(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }); assert(scene.mode === 'done' && Math.hypot(maze.x - maze.goal.x, maze.y - maze.goal.y) < 16, 'e4: generated maze ' + attempt + ' cleared with real movement');

  }
  load('e4');
  const qaActive = ARCHIVE_QA.active, qaTime = ARCHIVE_QA.timeLimit;
  ARCHIVE_QA.active = true; ARCHIVE_QA.timeLimit = 12; load('e4');
  assert(scene.timeLimit === 12, 'e4: QA time override works');
  ARCHIVE_QA.active = qaActive; ARCHIVE_QA.timeLimit = qaTime; load('e4');
  const run = archiveRun;
  run.setAttemptTime(90000); run.syncRemaining(87000);
  assert(run.snapshot().totalRemainingMs === 87000, 'e4: desk clock accepts penalty-adjusted remaining time');
  run.setAttemptTime(20260);
  assert(archiveRecords.record('e4', 45, 10).best.elapsed <= 45, 'e4: clear records beyond 20.26 seconds save');
  return checks;
})()
