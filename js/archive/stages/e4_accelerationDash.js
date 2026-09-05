import { MINI } from './minigame-kit.js';

export const E4_ACCELERATION_DASH = {
  tuning: { turns: 10, speed: 175, gain: 14, maxSpeed: 320, tolerance: 30, minCells: 2, maxCells: 3 },
  /* 미로 전체가 필드(20,144~940,497) 안에 들어오는 격자. 화면이 따라 움직이지 않으므로
     출발선에서 골인 지점까지 한눈에 보인다. */
  grid: { cell: 56, cols: 15, rows: 6, x: 88, y: 180 },
  steps: { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } },
  labels: { right: 'D →', left: 'A ←', up: 'W ↑', down: 'S ↓' },
  /* 격자를 벗어나지도 지나온 칸을 다시 밟지도 않는 길을 되돌아가며 찾는다.
     방향은 매번 직각으로만 꺾으므로 코너 수는 정확히 tuning.turns개다. */
  route() {
    const E4 = E4_ACCELERATION_DASH, t = E4.tuning, g = E4.grid;
    const spans = []; for (let n = t.minCells; n <= t.maxCells; n++) spans.push(n);
    const shuffle = list => list.map(value => ({ value, order: Math.random() })).sort((a, b) => a.order - b.order).map(item => item.value);
    const dig = (taken, cells, dirs, left, budget) => {
      if (!left) return true;
      if (budget.left-- <= 0) return false;
      const here = cells[cells.length - 1], from = dirs[dirs.length - 1];
      for (const name of shuffle(Object.keys(E4.steps))) {
        const step = E4.steps[name];
        if (from && step.x * E4.steps[from].x + step.y * E4.steps[from].y !== 0) continue;
        for (const span of shuffle(spans)) {
          const walked = [];
          for (let i = 1; i <= span; i++) {
            const cx = here.cx + step.x * i, cy = here.cy + step.y * i;
            if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows || taken.has(cy * g.cols + cx)) break;
            walked.push({ cx, cy });
          }
          if (walked.length < span) continue;
          walked.forEach(cell => taken.add(cell.cy * g.cols + cell.cx));
          cells.push(walked[walked.length - 1]); dirs.push(name);
          if (dig(taken, cells, dirs, left - 1, budget)) return true;
          cells.pop(); dirs.pop();
          walked.forEach(cell => taken.delete(cell.cy * g.cols + cell.cx));
        }
      }
      return false;
    };
    for (let attempt = 0; attempt < 24; attempt++) {
      const start = { cx: Math.floor(Math.random() * g.cols), cy: Math.floor(Math.random() * g.rows) };
      const cells = [start], dirs = [null], taken = new Set([start.cy * g.cols + start.cx]);
      if (dig(taken, cells, dirs, t.turns + 1, { left: 4000 })) return E4.toCourse(cells, dirs.slice(1));
    }
    // 되돌아가기까지 막히면 반드시 성립하는 지그재그 코스를 쓴다.
    const cells = [{ cx: 0, cy: 0 }], dirs = [];
    for (let i = 0; i <= t.turns; i++) {
      const name = i % 2 === 0 ? 'right' : (i % 4 === 1 ? 'down' : 'up'), step = E4.steps[name], here = cells[cells.length - 1];
      cells.push({ cx: here.cx + step.x * t.minCells, cy: here.cy + step.y * t.minCells }); dirs.push(name);
    }
    return E4.toCourse(cells, dirs);
  },
  /* 뽑힌 길이 화면 한쪽으로 몰리지 않도록 격자 안에서 가운데로 밀어 준다. */
  toCourse(cells, dirs) {
    const g = E4_ACCELERATION_DASH.grid;
    const span = key => ({ min: Math.min(...cells.map(cell => cell[key])), max: Math.max(...cells.map(cell => cell[key])) });
    const x = span('cx'), y = span('cy');
    const shiftX = Math.round((g.cols - 1 - x.max - x.min) / 2), shiftY = Math.round((g.rows - 1 - y.max - y.min) / 2);
    return {
      points: cells.map(cell => ({ x: g.x + (cell.cx + shiftX) * g.cell, y: g.y + (cell.cy + shiftY) * g.cell })),
      dirs,
    };
  },
  build() {
    MINI.init(this, 0xc6a2ff);
    const course = E4_ACCELERATION_DASH.route();
    this.state = { points: course.points, dirs: course.dirs, segment: 0, progress: 0, misses: 0, retry: 0 };
  },
  press(direction) {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning;
    if (s.retry || !E4.steps[direction] || direction === s.dirs[s.segment]) return;
    this.actions++;
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (direction === s.dirs[s.segment + 1] && Math.abs(length - s.progress) <= t.tolerance) {
      s.segment++; s.progress = Math.max(0, s.progress - length); this.sfx('hit');
    } else E4.miss.call(this);
  },
  miss() { this.state.misses++; this.state.progress = 0; this.state.retry = .22; MINI.summon(this); this.bump(); },
  update(dt) {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning;
    s.retry = Math.max(0, s.retry - dt);
    const speed = Math.min(t.maxSpeed, t.speed + s.segment * t.gain);
    if (!s.retry) s.progress += speed * dt;
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (s.segment === t.turns && s.progress >= length) this.finish(true);
    else if (s.progress > length + t.tolerance) E4.miss.call(this);
    this.anomaly = `속도 ${Math.round(speed)} · 코너 ${s.segment}/${t.turns}`;
    this.risk = s.segment * 9;
  },
  /* 코너에서 꺾을 방향을 통로 위에 그린다. 미로를 읽는 단서라 먼 코너도 흐리게 남긴다. */
  arrow(scene, x, y, direction, color, alpha) {
    const g = scene.ink;
    g.save(); g.translateCanvas(x, y); g.rotateCanvas({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[direction]);
    g.fillStyle(color, alpha).fillTriangle(-4, -8, -4, 8, 9, 0);
    g.restore();
  },
  render() {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning;
    const last = s.points.length - 1, next = s.dirs[s.segment + 1];
    MINI.frame(this, `TURN ${s.segment} / ${t.turns}    MISS ${s.misses}    ${next ? `다음 코너 ${E4.labels[next]}` : '마지막 직선 · 골인!'}`);
    // 통로 → 모서리 이음 → 중심선 순서로 겹쳐 미로 복도를 만든다.
    for (let i = 0; i < last; i++) MINI.line(this, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y, 0x2c2350, 34);
    s.points.forEach(point => MINI.circle(this, point.x, point.y, 17, 0x2c2350));
    for (let i = 0; i < last; i++) MINI.line(this, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y, 0x554279, 2);
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    const px = a.x + (b.x - a.x) * s.progress / length, py = a.y + (b.y - a.y) * s.progress / length;
    for (let i = 0; i < s.segment; i++) MINI.line(this, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y, this.accent, 7);
    MINI.line(this, a.x, a.y, px, py, this.accent, 7);
    for (let i = 1; i <= t.turns; i++) if (i !== s.segment + 1) E4.arrow(this, s.points[i].x, s.points[i].y, s.dirs[i], 0xbba7e8, i <= s.segment ? .25 : .5);
    if (next) {
      MINI.goal(this, b.x, b.y, t.tolerance);
      E4.arrow(this, b.x, b.y, next, 0xa7ffc6, 1);
    }
    MINI.circle(this, s.points[0].x, s.points[0].y, 6, 0x554279);
    // 골인 지점은 다음 코너 표시(초록)와 헷갈리지 않도록 금색 과녁으로 둔다.
    const goal = s.points[last];
    this.ink.lineStyle(3, 0xffcf7b).strokeCircle(goal.x, goal.y, 20);
    this.ink.lineStyle(2, 0xffcf7b, .35).strokeCircle(goal.x, goal.y, 27);
    MINI.circle(this, goal.x, goal.y, 11, 0xffcf7b, .85);
    MINI.circle(this, goal.x, goal.y, 5, 0x2c2350);
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'player', 'player', px, py, 26 * pop, 26 * pop);
    MINI.spawnFx(this, px, py, 22);
    MINI.meter(this, s.segment / t.turns);
  },
};
