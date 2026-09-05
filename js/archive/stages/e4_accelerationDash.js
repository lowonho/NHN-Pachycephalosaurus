import { MINI } from './minigame-kit.js';

export const E4_ACCELERATION_DASH = {
  timeLimit: 90,
  tuning: { speed: 180, gain: 650, maxSpeed: 520, radius: 10, wallPenalty: 1 },
  grid: { cols: 19, rows: 7, passageX: 84, passageY: 88, wall: 12, x: 42, y: 160 },
  steps: { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } },
  tileRect(col, row) {
    const g = E4_ACCELERATION_DASH.grid;
    return { x: Math.floor(col / 2) * (g.passageX + g.wall) + (col % 2 ? g.wall : 0),
      y: Math.floor(row / 2) * (g.passageY + g.wall) + (row % 2 ? g.wall : 0),
      w: col % 2 ? g.passageX : g.wall, h: row % 2 ? g.passageY : g.wall };
  },
  tileCenter(col, row) {
    const r = E4_ACCELERATION_DASH.tileRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  },
  // 모든 방을 연결한 뒤 일부 벽을 열어 갈림길, 막다른 길, 순환 통로를 만든다.
  route() {
    const E4 = E4_ACCELERATION_DASH, { cols, rows } = E4.grid;
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));
    const stack = [{ x: 1, y: 1 }], steps = Object.values(E4.steps);
    tiles[1][1] = 0;
    while (stack.length) {
      const p = stack[stack.length - 1];
      const options = steps.filter(d => {
        const x = p.x + d.x * 2, y = p.y + d.y * 2;
        return x > 0 && y > 0 && x < cols - 1 && y < rows - 1 && tiles[y][x];
      });
      if (!options.length) { stack.pop(); continue; }
      const d = options[Math.floor(Math.random() * options.length)];
      tiles[p.y + d.y][p.x + d.x] = 0;
      const next = { x: p.x + d.x * 2, y: p.y + d.y * 2 };
      tiles[next.y][next.x] = 0; stack.push(next);
    }
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      if (tiles[y][x] && (x % 2 !== y % 2) && Math.random() < .12) tiles[y][x] = 0;
    }
    const queue = [{ x: 1, y: 1 }], seen = new Set(['1,1']);
    for (let i = 0; i < queue.length; i++) for (const d of steps) {
      const p = { x: queue[i].x + d.x, y: queue[i].y + d.y }, key = `${p.x},${p.y}`;
      if (tiles[p.y]?.[p.x] === 0 && !seen.has(key)) { seen.add(key); queue.push(p); }
    }
    const end = queue[queue.length - 1];
    return { tiles, goal: E4.tileCenter(end.x, end.y) };
  },
  build() {
    MINI.init(this, 0xc6a2ff);
    const E4 = E4_ACCELERATION_DASH;
    this.state = { ...E4.route(), ...E4.tileCenter(1, 1),
      speed: E4.tuning.speed, moving: false, vx: 0, vy: 0, hits: 0, flash: 0, contacts: new Set(), trail: [] };
    this.mazeLabels = ['START', 'GOAL'].map((text, i) => this.add.text(0, 0, text,
      { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: i ? '#a7ffc6' : '#a5c5ef' }).setOrigin(.5));
  },
  press(direction) { if (E4_ACCELERATION_DASH.steps[direction]) this.actions++; },
  wallsAt(x, y) {
    const E4 = E4_ACCELERATION_DASH, { cols, rows } = E4.grid, r = E4.tuning.radius;
    const hits = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!this.state.tiles[row][col]) continue;
        const wall = E4.tileRect(col, row);
        if (x + r > wall.x && x - r < wall.x + wall.w && y + r > wall.y && y - r < wall.y + wall.h) hits.push(`${col},${row}`);
      }
    }
    return hits;
  },
  update(dt) {
    const E4 = E4_ACCELERATION_DASH, s = this.state, t = E4.tuning;
    const dx = this.axis('left', 'right'), dy = this.axis('up', 'down'), length = Math.hypot(dx, dy);
    const oldX = s.x, oldY = s.y;
    s.flash = Math.max(0, s.flash - dt);
    s.speed = length ? Math.min(t.maxSpeed, s.speed + t.gain * dt) : t.speed;
    // 축별로 이동을 잘게 나누어 벽 관통을 막고 벽을 따라 이동하게 한다.
    const count = Math.max(1, Math.ceil(s.speed * dt / (t.radius / 2)));
    let impacted = false;
    const contacts = new Set();
    for (let i = 0; i < count; i++) {
      for (const [axis, input] of [['x', dx], ['y', dy]]) {
        if (!input) continue;
        const next = s[axis] + input / length * s.speed * dt / count;
        const walls = E4.wallsAt.call(this, axis === 'x' ? next : s.x, axis === 'y' ? next : s.y);
        if (!walls.length) s[axis] = next;
        else { impacted = true; walls.forEach(key => contacts.add(key)); }
      }
    }
    // 접촉 유지 중에는 중복 차감하지 않는다. 입력을 놓아도 벽에서 떨어져야 재무장된다.
    E4.wallsAt.call(this, s.x - 5, s.y).concat(E4.wallsAt.call(this, s.x + 5, s.y),
      E4.wallsAt.call(this, s.x, s.y - 5), E4.wallsAt.call(this, s.x, s.y + 5))
      .forEach(key => { if (s.contacts.has(key)) contacts.add(key); });
    if (impacted && !s.contacts.size) {
      s.hits++; s.flash = .65; this.timePenalty += t.wallPenalty;
      this.remaining = Math.max(0, this.timeLimit - this.elapsed - this.timePenalty); this.bump();
    }
    s.contacts = contacts;
    s.moving = Math.hypot(s.x - oldX, s.y - oldY) > .01;
    s.vx = dt ? (s.x - oldX) / dt : 0; s.vy = dt ? (s.y - oldY) / dt : 0;
    if (s.moving) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 30) s.trail.shift(); }
    else s.trail.shift();
    this.anomaly = `속도 ${Math.round(s.moving ? s.speed : 0)} · 벽 충돌 ${s.hits}회 (-${s.hits}초)`;
    this.risk = Math.min(100, s.hits * 5);
    if (this.remaining <= 0) this.finish(false, '벽 충돌로 시간 소진');
    else if (Math.hypot(s.x - s.goal.x, s.y - s.goal.y) < 16) this.finish(true);
  },
  render() {
    const E4 = E4_ACCELERATION_DASH, s = this.state, g = E4.grid;
    const boost = s.moving ? (s.speed - E4.tuning.speed) / (E4.tuning.maxSpeed - E4.tuning.speed) : 0;
    MINI.frame(this, `${s.flash ? '벽 충돌 -1초!' : '가속 대쉬'}    SPEED ${Math.round(s.moving ? s.speed : 0)}    충돌 ${s.hits}회`);
    const sx = x => x + g.x, sy = y => y + g.y;
    const extent = E4.tileRect(g.cols - 1, g.rows - 1);
    this.ink.fillStyle(0x171c30).fillRect(g.x, g.y, extent.x + extent.w, extent.y + extent.h);
    for (let row = 0; row < g.rows; row++) for (let col = 0; col < g.cols; col++) {
      if (!s.tiles[row][col]) continue;
      const r = E4.tileRect(col, row), px = sx(r.x), py = sy(r.y);
      this.ink.fillStyle(0x4a3b69).fillRect(px, py, r.w, r.h);
      this.ink.lineStyle(1, 0x9476b5, .65).strokeRect(px + 1, py + 1, r.w - 2, r.h - 2);
    }
    // 속도가 높아질수록 길고 밝아지는 이동 궤적과 캐릭터 양옆의 속도선.
    for (let i = 1; i < s.trail.length; i++) {
      const a = s.trail[i - 1], b = s.trail[i], alpha = i / s.trail.length;
      MINI.line(this, sx(a.x), sy(a.y), sx(b.x), sy(b.y), this.accent, 2 + alpha * 10);
      if (i % 6 === 0) MINI.circle(this, sx(a.x), sy(a.y), 7, this.accent, alpha * .18);
    }
    const start = E4.tileCenter(1, 1);
    this.ink.lineStyle(2, 0x779fcd, .7).strokeCircle(sx(start.x), sy(start.y), 17);
    MINI.goal(this, sx(s.goal.x), sy(s.goal.y), 19);
    this.mazeLabels[0].setPosition(sx(start.x), sy(start.y) + 28);
    this.mazeLabels[1].setPosition(sx(s.goal.x), sy(s.goal.y) + 29);
    if (s.moving && boost > .05) {
      const angle = Math.atan2(s.vy, s.vx), ux = Math.cos(angle), uy = Math.sin(angle);
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
        const offset = side * (16 + i * 7), back = 6 + i * 13;
        const x = sx(s.x) - uy * offset - ux * back, y = sy(s.y) + ux * offset - uy * back;
        this.ink.lineStyle(2, 0xe3d6ff, boost * .7).lineBetween(x, y, x - ux * (12 + boost * 26), y - uy * (12 + boost * 26));
      }
    }
    MINI.actor(this, 'player', 'player', sx(s.x), sy(s.y), 20, 20, 0, s.flash ? 0xff8799 : this.accent);
    MINI.meter(this, boost);
  },
};
