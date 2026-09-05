import { MINI } from './minigame-kit.js';

export const E4_ACCELERATION_DASH = {
  timeLimit: 20.26,
  tuning: { speed: 240, tapGain: 100, maxSpeed: 1100, brake: 7200, radius: 10, wallPenalty: 1 },
  grid: { cols: 19, rows: 7, passageX: 84, passageY: 112, wall: 12, x: 42, y: 88 },
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
  // 8개 직선(7번 회전)의 주 경로를 먼저 만들고, 나머지 방을 가지로 연결한다.
  // 이미 열린 방끼리는 연결하지 않아 출구까지의 지름길이 생기지 않는다.
  route() {
    const E4 = E4_ACCELERATION_DASH, { cols, rows } = E4.grid;
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));
    const rooms = [], pick = list => list[Math.floor(Math.random() * list.length)];
    const carve = (from, to) => {
      tiles[(from.y + to.y) / 2][(from.x + to.x) / 2] = 0;
      tiles[to.y][to.x] = 0; rooms.push(to);
    };
    // 수평 길이를 1~3개 방 단위로 섞어 짧은 코너와 긴 가속 구간을 번갈아 만든다.
    const spans = [1, 1, 1, 1];
    for (let left = 4; left > 0; left--) spans[pick([0, 1, 2, 3].filter(i => spans[i] < 3))]++;
    let here = { x: 1, y: 1 };
    tiles[1][1] = 0; rooms.push(here);
    for (let leg = 0; leg < 4; leg++) {
      for (let i = 0; i < spans[leg]; i++) {
        const next = { x: here.x + 2, y: here.y }; carve(here, next); here = next;
      }
      const targetY = leg % 2 === 0 ? pick([3, 5]) : 1;
      while (here.y !== targetY) {
        const next = { x: here.x, y: here.y + Math.sign(targetY - here.y) * 2 };
        carve(here, next); here = next;
      }
    }
    const goal = E4.tileCenter(here.x, here.y);
    const frontier = rooms.slice(), steps = Object.values(E4.steps);
    while (frontier.length) {
      const from = pick(frontier);
      const options = steps.map(d => ({ x: from.x + d.x * 2, y: from.y + d.y * 2 }))
        .filter(p => p.x > 0 && p.y > 0 && p.x < cols - 1 && p.y < rows - 1 && tiles[p.y][p.x]);
      if (!options.length) { frontier.splice(frontier.indexOf(from), 1); continue; }
      const next = pick(options); carve(from, next); frontier.push(next);
    }
    return { tiles, goal };
  },
  build() {
    MINI.init(this, 0xc6a2ff);
    this.readout.setVisible(false);
    this.fieldMask.clear().fillStyle(0xffffff).fillRect(20, 80, 920, 417);
    const E4 = E4_ACCELERATION_DASH;
    this.state = { ...E4.route(), ...E4.tileCenter(1, 1),
      speed: E4.tuning.speed, heading: null, turns: 0, moving: false, braking: false, vx: 0, vy: 0, hits: 0, flash: 0, contacts: new Set(), trail: [] };
    this.mazeLabels = ['START', 'GOAL'].map((text, i) => this.add.text(0, 0, text,
      { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: i ? '#a7ffc6' : '#a5c5ef' }).setOrigin(.5));
  },
  press(direction) {
    const E4 = E4_ACCELERATION_DASH;
    if (!E4.steps[direction]) return;
    this.actions++;
    this.state.speed = Math.min(E4.tuning.maxSpeed, this.state.speed + E4.tuning.tapGain);
  },
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
    let moveX = 0, moveY = 0;
    // 가속 기록은 유지하되 실제 이동 속도는 브레이크로 줄인다.
    if (length) {
      const heading = `${dx},${dy}`;
      if (s.heading !== null && s.heading !== heading) s.turns++;
      s.heading = heading;
      // 누적 속도는 새 입력에서만 증가한다. 유지 중에는 같은 속도로 이동한다.
      const driveSpeed = s.speed;
      s.vx = dx / length * driveSpeed; s.vy = dy / length * driveSpeed;
      moveX = s.vx * dt; moveY = s.vy * dt;
      s.braking = false;
    } else {
      const velocity = Math.hypot(s.vx, s.vy);
      s.braking = velocity > 0;
      if (velocity > 0) {
        // 정지하는 마지막 스텝도 정확히 적분한다. 고속일수록 제동 거리가 길어진다.
        const brakeTime = Math.min(dt, velocity / t.brake);
        const distance = velocity * brakeTime - .5 * t.brake * brakeTime * brakeTime;
        moveX = s.vx / velocity * distance; moveY = s.vy / velocity * distance;
        const factor = Math.max(0, velocity - t.brake * dt) / velocity;
        s.vx *= factor; s.vy *= factor;
      }
    }
    // 축별로 이동을 잘게 나누어 벽 관통을 막고 벽을 따라 이동하게 한다.
    const count = Math.max(1, Math.ceil(Math.hypot(moveX, moveY) / (t.radius / 2)));
    let impacted = false;
    const contacts = new Set();
    for (let i = 0; i < count; i++) {
      for (const axis of ['x', 'y']) {
        const distance = axis === 'x' ? moveX : moveY;
        if (!distance) continue;
        const next = s[axis] + distance / count;
        const walls = E4.wallsAt.call(this, axis === 'x' ? next : s.x, axis === 'y' ? next : s.y);
        if (!walls.length) s[axis] = next;
        else {
          impacted = true; walls.forEach(key => contacts.add(key));
          if (axis === 'x') { moveX = 0; s.vx = 0; } else { moveY = 0; s.vy = 0; }
        }
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
    s.braking = s.braking && s.moving;
    if (s.moving) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 30) s.trail.shift(); }
    else s.trail.shift();
    this.anomaly = `누적 속도 ${Math.round(s.speed)} · 방향 전환 ${s.turns}회 · 충돌 -${s.hits}초`;
    this.risk = Math.min(100, s.hits * 5);
    if (this.remaining <= 0) this.finish(false, '벽 충돌로 시간 소진');
    else if (Math.hypot(s.x - s.goal.x, s.y - s.goal.y) < 16) this.finish(true);
  },
  render() {
    const E4 = E4_ACCELERATION_DASH, s = this.state, g = E4.grid;
    const actualSpeed = Math.hypot(s.vx, s.vy);
    const boost = MINI.clamp((actualSpeed - E4.tuning.speed) / (E4.tuning.maxSpeed - E4.tuning.speed), 0, 1);
    this.ink.clear();
    this.ink.fillStyle(0x0c202e).fillRoundedRect(20, 80, 920, 417, 14);
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
      this.ink.lineStyle(2 + alpha * 10, this.accent, alpha * (.2 + boost * .45))
        .lineBetween(sx(a.x), sy(a.y), sx(b.x), sy(b.y));
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
