import { MINI } from './minigame-kit.js';

export const E4_ACCELERATION_DASH = {
  /* turns: 출구까지 필요한 "최소" 꺾기 횟수. 출구는 아무리 잘 꺾어도 이만큼은 꺾어야 닿는 칸에만 놓는다.
     speed/gain/maxSpeed: 꺾을 때마다 붙는 대쉬 가속. buffer: 미리 누른 방향키를 기억하는 시간. */
  tuning: { turns: 10, speed: 235, gain: 28, maxSpeed: 520, buffer: .55, braid: .2, attempts: 80 },
  /* 미로 전체가 필드(MINI.FIELD) 안에 들어오는 홀수 격자. 화면이 따라 움직이지 않아 길을 한눈에 읽는다. */
  grid: { cell: 36, cols: 25, rows: 9, x: 30, y: 158 },
  /* 방향 번호는 dir ^ 1이 곧 반대 방향이 되도록 짝지어 둔다. */
  names: ['right', 'left', 'up', 'down'],
  steps: { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } },
  labels: { right: 'D →', left: 'A ←', up: 'W ↑', down: 'S ↓' },
  index(cx, cy) { return cy * E4_ACCELERATION_DASH.grid.cols + cx; },
  step(dir) { const E4 = E4_ACCELERATION_DASH; return E4.steps[E4.names[dir]]; },
  next(cell, dir) { const E4 = E4_ACCELERATION_DASH, step = E4.step(dir); return cell + step.y * E4.grid.cols + step.x; },
  open(map, cell, dir) { return Boolean(map[E4_ACCELERATION_DASH.next(cell, dir)]); },
  center(cell) {
    const g = E4_ACCELERATION_DASH.grid, cx = cell % g.cols, cy = (cell - cx) / g.cols;
    return { x: g.x + (cx + .5) * g.cell, y: g.y + (cy + .5) * g.cell };
  },
  /* 벽 칸과 통로 칸이 번갈아 놓이는 홀수 격자를 재귀 백트래킹으로 판다.
     막다른 칸 일부는 벽을 한 겹 더 뚫어(braid) 대쉬가 자주 갇히지 않게 한다. */
  carve() {
    const E4 = E4_ACCELERATION_DASH, g = E4.grid, t = E4.tuning, map = new Uint8Array(g.cols * g.rows);
    const inside = cell => {
      const cx = cell % g.cols, cy = (cell - cx) / g.cols;
      return cx > 0 && cy > 0 && cx < g.cols - 1 && cy < g.rows - 1;
    };
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const first = E4.index(1 + 2 * Math.floor(Math.random() * ((g.cols - 1) / 2)), 1 + 2 * Math.floor(Math.random() * ((g.rows - 1) / 2)));
    const stack = [first];
    map[first] = 1;
    while (stack.length) {
      const cell = stack[stack.length - 1];
      const options = [0, 1, 2, 3].filter(dir => { const far = E4.next(E4.next(cell, dir), dir); return inside(far) && !map[far]; });
      if (!options.length) { stack.pop(); continue; }
      const dir = pick(options), mid = E4.next(cell, dir), far = E4.next(mid, dir);
      map[mid] = 1; map[far] = 1; stack.push(far);
    }
    for (let cell = 0; cell < map.length; cell++) {
      if (!map[cell] || !inside(cell)) continue;
      // 출구가 하나뿐인 칸이 막다른 길이다. 통로 사이 칸은 출구가 둘이라 걸리지 않는다.
      const exits = [0, 1, 2, 3].filter(dir => map[E4.next(cell, dir)]);
      if (exits.length !== 1 || Math.random() > t.braid) continue;
      const walls = [0, 1, 2, 3].filter(dir => !map[E4.next(cell, dir)] && inside(E4.next(E4.next(cell, dir), dir)));
      if (walls.length) map[E4.next(cell, pick(walls))] = 1;
    }
    return map;
  },
  /* (칸, 진행 방향) 상태로 0-1 BFS를 돈다. 직진은 0, 꺾기는 1이라 결과가 곧 "몇 번 꺾어야 하는가"다.
     back이면 화살표를 뒤집어 "그 칸에서 from까지 몇 번 꺾어야 하는가"가 된다. */
  scan(map, from, back) {
    const E4 = E4_ACCELERATION_DASH, cost = new Int32Array(map.length * 4).fill(-1), queue = [];
    for (let dir = 0; dir < 4; dir++) { cost[from * 4 + dir] = 0; queue.push(from * 4 + dir); }
    while (queue.length) {
      const state = queue.shift(), cell = state >> 2, dir = state & 3, here = cost[state];
      if (here < 0) continue;
      const ahead = E4.next(cell, back ? dir ^ 1 : dir), straight = ahead * 4 + dir;
      if (map[ahead] && (cost[straight] < 0 || cost[straight] > here)) { cost[straight] = here; queue.unshift(straight); }
      for (let turn = 0; turn < 4; turn++) {
        const state = cell * 4 + turn;
        if (turn === dir || (cost[state] >= 0 && cost[state] <= here + 1)) continue;
        cost[state] = here + 1; queue.push(state);
      }
    }
    return cost;
  },
  /* 미로를 뽑고, 최소 꺾기 횟수가 정확히 tuning.turns인 칸만 출구 후보로 남긴다.
     그중 출발점에서 먼 쪽을 골라 코스가 화면 한쪽에 몰리지 않게 한다. */
  route() {
    const E4 = E4_ACCELERATION_DASH, t = E4.tuning;
    for (let attempt = 0; attempt < t.attempts; attempt++) {
      const map = E4.carve(), cells = [];
      for (let cell = 0; cell < map.length; cell++) if (map[cell]) cells.push(cell);
      const start = cells[Math.floor(Math.random() * cells.length)], cost = E4.scan(map, start, false);
      const goals = cells.filter(cell => Math.min(cost[cell * 4], cost[cell * 4 + 1], cost[cell * 4 + 2], cost[cell * 4 + 3]) === t.turns);
      if (!goals.length) continue;
      const from = E4.center(start);
      const ranked = goals
        .map(cell => ({ cell, span: Math.hypot(E4.center(cell).x - from.x, E4.center(cell).y - from.y) }))
        .sort((a, b) => b.span - a.span);
      const goal = ranked[Math.floor(Math.random() * Math.ceil(ranked.length / 3))].cell;
      return { map, start, goal, toGoal: E4.scan(map, goal, true) };
    }
    return E4.comb();
  },
  /* 무작위 미로가 조건을 못 맞추면 정확히 tuning.turns번(짝수) 꺾어야 하는 빗살 미로로 되돌아간다.
     세로 통로를 오르내릴 때마다 두 번씩 꺾이므로 turns/2번째 통로의 반대쪽 끝이 곧 목표다. */
  comb() {
    const E4 = E4_ACCELERATION_DASH, g = E4.grid, t = E4.tuning;
    const map = new Uint8Array(g.cols * g.rows), top = 1, bottom = g.rows - 2, lane = Math.floor(t.turns / 2);
    for (let i = 0; i < (g.cols - 1) / 2; i++) {
      const cx = 1 + i * 2;
      for (let cy = top; cy <= bottom; cy++) map[E4.index(cx, cy)] = 1;
      if (i) map[E4.index(cx - 1, i % 2 ? bottom : top)] = 1;
    }
    const goal = E4.index(1 + lane * 2, lane % 2 ? top : bottom);
    return { map, start: E4.index(1, top), goal, toGoal: E4.scan(map, goal, true) };
  },
  build() {
    MINI.init(this, 0xc6a2ff);
    const E4 = E4_ACCELERATION_DASH, course = E4.route();
    this.state = {
      map: course.map, toGoal: course.toGoal, start: course.start, goal: course.goal, cell: course.start,
      dir: null, want: null, wantAt: -9, off: 0, turns: 0, bumps: 0, stuck: false,
      left: E4.tuning.turns, seen: new Set([course.start]),
    };
  },
  speed() {
    const t = E4_ACCELERATION_DASH.tuning;
    return Math.min(t.maxSpeed, t.speed + this.state.turns * t.gain);
  },
  /* 방향이 실제로 바뀌는 지점. 꺾을 때마다 속도가 붙고, 첫 출발은 꺾기로 세지 않는다. */
  steer(dir) {
    const s = this.state;
    if (s.dir !== null) s.turns++;
    s.dir = dir; s.want = null; s.stuck = false; this.sfx('hit');
  },
  press(direction) {
    const E4 = E4_ACCELERATION_DASH, s = this.state, dir = E4.names.indexOf(direction);
    if (dir < 0 || s.want === dir || (s.want === null && s.dir === dir)) return;
    this.actions++; s.want = dir; s.wantAt = this.elapsed;
    // 멈춰 있을 때와 되돌아갈 때는 칸 중앙을 기다리지 않고 그 자리에서 꺾는다.
    if (s.dir === null) { if (E4.open(s.map, s.cell, dir)) E4.steer.call(this, dir); return; }
    if (dir !== (s.dir ^ 1)) return;
    if (!s.off) { if (E4.open(s.map, s.cell, dir)) E4.steer.call(this, dir); return; }
    s.cell = E4.next(s.cell, s.dir); s.off = E4.grid.cell - s.off; E4.steer.call(this, dir);
  },
  cancelInput() { if (this.state) this.state.want = null; },
  /* 자동 플레이/테스트용. 다음 판단 지점(칸 중앙)에서 출구까지 꺾기가 가장 적은 방향을 고른다. */
  hint() {
    const E4 = E4_ACCELERATION_DASH, s = this.state;
    const cell = s.off ? E4.next(s.cell, s.dir) : s.cell;
    // 다음 칸이 곧 출구면 그대로 들어가면 된다. 여기서 다시 재면 "출구를 떠나는 값"을 보게 된다.
    if (cell === s.goal) return E4.names[s.dir];
    let best = s.dir, cost = Infinity;
    for (let dir = 0; dir < 4; dir++) {
      // 막힌 방향은 후보에서 뺀다. 벽을 보고 선 채로 같은 방향을 계속 고르면 영영 못 움직인다.
      if (!E4.open(s.map, cell, dir)) continue;
      // 한 칸 나아간 뒤의 값으로 재야 "여기서 꺾는다"와 "지나치고 나중에 꺾는다"가 구분된다.
      const total = (dir === s.dir ? 0 : 1) + s.toGoal[E4.next(cell, dir) * 4 + dir];
      if (total < cost) { cost = total; best = dir; }
    }
    return E4.names[best];
  },
  update(dt) {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning, g = E4.grid;
    if (s.want !== null && this.elapsed - s.wantAt > t.buffer) s.want = null;
    let move = s.dir === null ? 0 : E4.speed.call(this) * dt;
    // 칸 중앙에서만 직각으로 꺾고 벽을 판정한다. 그 사이 구간은 이미 뚫린 통로라 그냥 지나간다.
    while (move > 0) {
      if (!s.off) {
        if (s.want !== null && s.want !== s.dir && E4.open(s.map, s.cell, s.want)) E4.steer.call(this, s.want);
        if (!E4.open(s.map, s.cell, s.dir)) {
          if (!s.stuck) { s.stuck = true; s.bumps++; this.bump(); }
          break;
        }
      }
      const use = Math.min(move, g.cell - s.off);
      s.off += use; move -= use;
      if (s.off >= g.cell - 1e-9) { s.cell = E4.next(s.cell, s.dir); s.off = 0; s.seen.add(s.cell); }
    }
    const at = s.off ? E4.next(s.cell, s.dir) : s.cell;
    s.left = s.dir === null
      ? Math.min(s.toGoal[at * 4], s.toGoal[at * 4 + 1], s.toGoal[at * 4 + 2], s.toGoal[at * 4 + 3])
      : s.toGoal[at * 4 + s.dir];
    this.anomaly = `속도 ${Math.round(E4.speed.call(this))} · 남은 코너 ${s.left}`;
    this.risk = Math.min(100, s.turns * 6 + s.bumps * 5);
    if (s.cell === s.goal) this.finish(true, `${s.turns}번 꺾어 도착`);
  },
  render() {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning, g = E4.grid, ink = this.ink, f = MINI.FIELD;
    MINI.frame(this);
    // 미로판을 화면 가득 깔고 통로 칸만 다시 파낸다.
    ink.fillStyle(0x241d46).fillRect(f.x, f.y, f.w, f.h);
    for (let cell = 0; cell < s.map.length; cell++) {
      if (!s.map[cell]) continue;
      const point = E4.center(cell);
      ink.fillStyle(0x0d2234).fillRect(point.x - g.cell / 2, point.y - g.cell / 2, g.cell, g.cell);
    }
    // 지나온 칸을 옅게 남겨 헤맨 길을 되짚을 수 있게 한다.
    s.seen.forEach(cell => {
      const point = E4.center(cell);
      ink.fillStyle(this.accent, .12).fillRect(point.x - g.cell / 2, point.y - g.cell / 2, g.cell, g.cell);
    });
    const start = E4.center(s.start);
    MINI.circle(this, start.x, start.y, 5, 0x554279);
    // 출구는 금색 과녁이라 통로 표시와 헷갈리지 않는다.
    const goal = E4.center(s.goal);
    ink.lineStyle(3, 0xffcf7b).strokeCircle(goal.x, goal.y, 13);
    ink.lineStyle(2, 0xffcf7b, .35).strokeCircle(goal.x, goal.y, 18);
    MINI.circle(this, goal.x, goal.y, 8, 0xffcf7b, .85);
    MINI.circle(this, goal.x, goal.y, 4, 0x2c2350);
    const here = E4.center(s.cell), step = E4.step(s.dir ?? 0);
    const px = here.x + step.x * s.off, py = here.y + step.y * s.off;
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'player', 'player', px, py, 24 * pop, 24 * pop);
    MINI.spawnFx(this, px, py, 20);
    MINI.meter(this, 1 - s.left / t.turns);
  },
};
