import { MINI } from './minigame-kit.js';

// 통로와 건물 벽을 포함한 전체 크기로 미로를 필드 중앙에 배치한다.
const MAZE = { cols: 19, rows: 7, passageX: 66, passageY: 90, wall: 28 };
const MAZE_W = (MAZE.cols - 1) / 2 * (MAZE.passageX + MAZE.wall) + MAZE.wall;
const MAZE_H = (MAZE.rows - 1) / 2 * (MAZE.passageY + MAZE.wall) + MAZE.wall;

export const E4_ACCELERATION_DASH = {
  timeLimit: 20.26,
  tuning: { speed: 240, tapGain: 100, maxSpeed: 800, brake: 2400, radius: 10, wallPenalty: 1 },
  chase: { delay: 3, walkDuration: 4, walkSpeed: 200, runSpeed: 440, spawnOffset: 22, bodyRadius: 10 },
  grid: { ...MAZE, x: Math.round(MINI.FIELD.cx - MAZE_W / 2), y: Math.round(MINI.FIELD.cy - MAZE_H / 2) },
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
  route(random = Math.random) {
    const E4 = E4_ACCELERATION_DASH, { cols, rows } = E4.grid;
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));
    const rooms = [], pick = list => list[Math.floor(random() * list.length)];
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
    MINI.init(this, 0x90b9b3);
    const E4 = E4_ACCELERATION_DASH;
    this.state = { ...E4.route(this.random), ...E4.tileCenter(1, 1),
      speed: E4.tuning.speed, heading: null, turns: 0, moving: false, braking: false, vx: 0, vy: 0, hits: 0, flash: 0, contacts: new Set(), trail: [] };
    E4_VILLAGE.build(this, E4);
    E4_TIGER.build(this);
    this.mazeLabels = ['START', 'GOAL'].map((text, i) => this.add.text(0, 0, text,
      { fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: i ? '#a7ffc6' : '#a5c5ef' }).setOrigin(.5));
  },
  press(direction) {
    const E4 = E4_ACCELERATION_DASH;
    if (!E4.steps[direction]) return;
    this.actions++;
    this.state.speed = Math.min(E4.tuning.maxSpeed, this.state.speed + this.penalty(E4.tuning.tapGain));
  },
  wallsAt(x, y, r = E4_ACCELERATION_DASH.tuning.radius) {
    const E4 = E4_ACCELERATION_DASH, { cols, rows } = E4.grid;
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
      s.hits++; s.flash = .65; this.timePenalty += this.penalty(t.wallPenalty);
      this.remaining = Math.max(0, this.timeLimit - this.elapsed - this.timePenalty); this.bump();
    }
    s.contacts = contacts;
    s.moving = Math.hypot(s.x - oldX, s.y - oldY) > .01;
    s.braking = s.braking && s.moving;
    E4_VILLAGE.updateMotion(this, dt, s.x - oldX, s.y - oldY);
    if (s.moving) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 30) s.trail.shift(); }
    else s.trail.shift();
    // 출구 도착은 같은 프레임의 추격보다 먼저 판정한다. 판정 반경은 16이었으나
    // 통로 폭(66)에 비해 너무 좁아 근처까지 가고도 골인이 안 되는 느낌을 줘서 넓혔다.
    if (this.remaining > 0 && Math.hypot(s.x - s.goal.x, s.y - s.goal.y) < 28) { this.finish(true); return; }
    E4_TIGER.update(this, dt);
    const tiger = s.tiger, warning = this.elapsed < E4.chase.delay
      ? `호랑이 출발 ${(E4.chase.delay - this.elapsed).toFixed(1)}초`
      : tiger.gait === 'walk' ? '호랑이 어슬렁' : '호랑이 전력 질주';
    this.anomaly = `속도 ${Math.round(s.speed)} · 벽 ${s.hits}회 · ${warning}`;
    this.risk = Math.min(100, s.hits * 5 + tiger.catches * 15 + (tiger.active ? Math.max(0, 45 - Math.hypot(s.x - tiger.x, s.y - tiger.y) / 4) : 0));
    if (this.remaining <= 0) this.finish(false, '추격 중 시간 소진');
  },
  render() {
    const E4 = E4_ACCELERATION_DASH, s = this.state, g = E4.grid;
    const actualSpeed = Math.hypot(s.vx, s.vy);
    const boost = MINI.clamp((actualSpeed - E4.tuning.speed) / (E4.tuning.maxSpeed - E4.tuning.speed), 0, 1);
    MINI.frame(this);
    const sx = x => x + g.x, sy = y => y + g.y;
    const extent = E4.tileRect(g.cols - 1, g.rows - 1);
    E4_VILLAGE.ground(this, E4, extent);
    // 속도가 높아질수록 길고 밝아지는 이동 궤적과 캐릭터 양옆의 속도선.
    for (let i = 1; i < s.trail.length; i++) {
      const a = s.trail[i - 1], b = s.trail[i], alpha = i / s.trail.length;
      this.ink.lineStyle(2 + alpha * 10, this.accent, alpha * (.2 + boost * .45))
        .lineBetween(sx(a.x), sy(a.y), sx(b.x), sy(b.y));
      if (i % 6 === 0) MINI.circle(this, sx(a.x), sy(a.y), 7, this.accent, alpha * .18);
    }
    const start = E4.tileCenter(1, 1);
    E4_VILLAGE.waitingCharacter(this, sx(s.goal.x), sy(s.goal.y));
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
    E4_VILLAGE.player(this, sx(s.x), sy(s.y));
    E4_TIGER.render(this);
    MINI.meter(this, boost);
  },
};

// Rendering only: footprints never alter route(), tiles, or wallsAt().
const E4_VILLAGE = {
  // Future 1x2 art can use {cellsW:1,cellsH:2}, provided both slots are walls.
  buildings: [
    { role: 'tileRoof', cellsW: 1, cellsH: 1 }, { role: 'tileRoofAlt', cellsW: 1, cellsH: 1 },
    { role: 'thatch', cellsW: 1, cellsH: 1 }, { role: 'thatchAlt', cellsW: 1, cellsH: 1 },
    { role: 'inn', cellsW: 2, cellsH: 1 }, { role: 'longHouse', cellsW: 1, cellsH: 2 },
  ],
  size(scene, base) { return base * Math.min(E4_ACCELERATION_DASH.grid.passageX, E4_ACCELERATION_DASH.grid.passageY) / 64; },
  build(scene, game) {
    const grid = game.grid, unit = grid.wall;
    scene.village = { buildings: [], facingLeft: false, direction: 'right', walkPhase: 0 };
    // Bounds are measured from PNG alpha, not the padded image dimensions.
    for (const role of ['player', ...E4_VILLAGE.buildings.map(item => item.role)]) {
      if (!scene.textures.exists('e4:' + role) || !globalThis.E4_VILLAGE_BOUNDS?.[role]) continue;
      const texture = scene.textures.get('e4:' + role);
      const bounds = globalThis.E4_VILLAGE_BOUNDS[role];
      if (!texture.has('art')) texture.add('art', 0, ...bounds);
    }
    const available = E4_VILLAGE.buildings.filter(b => scene.textures.exists('e4:' + b.role));
    const slots = new Map(), keyOf = (x, y) => `${x},${y}`;
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      if (!scene.state.tiles[row][col]) continue;
      const wall = game.tileRect(col, row);
      for (let y = wall.y; y + unit <= wall.y + wall.h; y += unit) for (let x = wall.x; x + unit <= wall.x + wall.w; x += unit) {
        slots.set(keyOf(x, y), { x, y, col, row });
      }
    }
    const occupied = new Set();
    for (const slot of slots.values()) {
      const { x, y, col, row } = slot;
      if (occupied.has(keyOf(x, y))) continue;
      const options = available.filter(variant => {
        for (let dy = 0; dy < variant.cellsH; dy++) for (let dx = 0; dx < variant.cellsW; dx++) {
          const key = keyOf(x + dx * unit, y + dy * unit);
          if (!slots.has(key) || occupied.has(key)) return false;
        }
        return true;
      });
      // 생성 때만 결정하며 게임의 난수 스트림과 벽 데이터는 건드리지 않는다.
      let variantHash = Math.imul((col * 73856093) ^ (row * 19349663) ^ x ^ (y << 10), 0x45d9f3b);
      variantHash ^= variantHash >>> 16;
      const variant = options[(variantHash >>> 0) % options.length];
      if (!variant) continue;
      const w = variant.cellsW * unit, h = variant.cellsH * unit, footprint = [];
      for (let dy = 0; dy < variant.cellsH; dy++) for (let dx = 0; dx < variant.cellsW; dx++) {
        const key = keyOf(x + dx * unit, y + dy * unit);
        occupied.add(key); footprint.push(slots.get(key));
      }
      const texture = scene.textures.get('e4:' + variant.role);
      const image = scene.add.image(grid.x + x + w / 2, grid.y + y + h / 2,
        'e4:' + variant.role, texture.has('art') ? 'art' : '__BASE').setDepth(1).setMask(scene.ink.mask);
      image.setScale(Math.min((w - 1) / image.width, (h - 1) / image.height));
      scene.village.buildings.push({ image, x, y, w, h, col, row, footprint, role: variant.role });
    }
    scene.village.goalCharacter = E4_MOTION.create(scene, 'goalCharacter', 2);
    for (const role of ['playerRight', 'playerUp', 'playerDown']) E4_MOTION.prepare(scene, role);
    scene.village.actor = E4_MOTION.create(scene, 'playerRight', 3) || E4_MOTION.create(scene, 'playerUp', 3);
  },
  updateMotion(scene, dt, dx, dy) {
    const view = scene.village, speed = Math.hypot(dx, dy) / dt;
    if (speed < 1) { view.walkPhase = 0; return; }
    view.walkPhase += dt * MINI.clamp(speed / 34, 4, 20);
    if (Math.abs(dx) >= Math.abs(dy)) { view.direction = 'right'; view.facingLeft = dx < 0; }
    else { view.direction = dy < 0 ? 'up' : 'down'; view.facingLeft = false; }
  },
  ground(scene, game, extent) {
    const g = game.grid, ink = scene.ink, width = extent.x + extent.w, height = extent.y + extent.h;
    ink.fillStyle(0x73756d).fillRect(g.x, g.y, width, height);
    for (let y = 0; y < height; y += 24) for (let x = 0; x < width; x += 24) {
      const shade = ((x * 13 + y * 7) % 5) / 100;
      ink.fillStyle(0x292e29, .08 + shade).fillRect(g.x + x + 1, g.y + y + 1, Math.min(22, width-x-1), Math.min(22, height-y-1));
    }
    for (let row = 0; row < g.rows; row++) for (let col = 0; col < g.cols; col++) {
      if (!scene.state.tiles[row][col]) continue;
      const r = game.tileRect(col,row);
      ink.fillStyle(0x374b3a).fillRect(g.x+r.x,g.y+r.y,r.w,r.h);
      ink.lineStyle(1,0x9a967a,.65).strokeRect(g.x+r.x+.5,g.y+r.y+.5,r.w-1,r.h-1);
    }
  },
  waitingCharacter(scene, x, y) {
    if (scene.village.goalCharacter) {
      E4_MOTION.pose(scene, scene.village.goalCharacter, 'goalCharacter', Math.floor(scene.elapsed * 1.25) % 2, 44);
      scene.village.goalCharacter.setPosition(x, y); return;
    }
    // 제공될 도착지 캐릭터의 자리. 출구에 고정되며 충돌체나 추격 로직은 없다.
    const g = scene.ink;
    g.lineStyle(4, 0x293a32).lineBetween(x - 4, y + 6, x - 4, y + 13);
    g.lineBetween(x + 4, y + 6, x + 4, y + 13);
    g.fillStyle(0x77bca2).fillTriangle(x, y - 9, x - 12, y + 9, x + 12, y + 9);
    g.lineStyle(3, 0xbce1ce).lineBetween(x - 7, y - 1, x + 7, y - 1);
    g.fillStyle(0xe7bd99).fillCircle(x, y - 13, 6);
    g.fillStyle(0x28352e).fillRoundedRect(x - 7, y - 21, 14, 5, 2);
  },
  player(scene, x, y) {
    const view = scene.village, s = scene.state;
    if (!view.actor) {
      // 정식 인물 에셋 전까지 사용할 두루마기·상투 실루엣.
      const g = scene.ink, bob = s.moving ? Math.sin(scene.elapsed * 24) * 2 : 0;
      g.lineStyle(4, 0x292d29).lineBetween(x - 4, y + 6, x - 6, y + 14 + bob);
      g.lineBetween(x + 4, y + 6, x + 6, y + 14 - bob);
      g.fillStyle(s.flash ? 0xffa28a : 0xe2dbbf).fillTriangle(x, y - 8, x - 12, y + 9, x + 12, y + 9);
      g.fillStyle(0xe5b88e).fillCircle(x, y - 11, 6);
      g.fillStyle(0x292725).fillRoundedRect(x - 6, y - 18, 12, 5, 2).fillCircle(x, y - 20, 3);
      return;
    }
    const role = { right: 'playerRight', up: 'playerUp', down: 'playerDown' }[view.direction];
    const hasSide = scene.textures.exists('e4:playerRight');
    const selected = scene.textures.exists(`e4:${role}`) ? role : 'playerUp';
    E4_MOTION.pose(scene, view.actor, selected, [0, 1, 2, 1][Math.floor(view.walkPhase) % 4], 44);
    // 좌우 시트가 없으면 위에서 본 뒷모습을 몸통 기준으로 돌려 사용한다.
    view.actor.setPosition(x,y).setFlipX(hasSide && view.direction === 'right' && view.facingLeft)
      .setRotation(!hasSide && view.direction === 'right' ? (view.facingLeft ? -Math.PI / 2 : Math.PI / 2) : 0);
    if (s.flash) view.actor.setTint(0xffb0a0); else view.actor.clearTint();
  },
};

// 서로 다른 여백의 프레임도 동일한 배율과 프레임별 몸통 원점으로 정렬한다.
const E4_MOTION = {
  prepare(scene, role) {
    const data = globalThis.E4_VILLAGE_MOTIONS?.[role], key = `e4:${role}`;
    if (!data || !scene.textures.exists(key)) return false;
    const texture = scene.textures.get(key);
    data.frames.forEach((rect, i) => { if (!texture.has(`motion-${i}`)) texture.add(`motion-${i}`, 0, ...rect); });
    return true;
  },
  create(scene, role, depth) {
    if (!E4_MOTION.prepare(scene, role)) return null;
    return scene.add.image(0, 0, `e4:${role}`, 'motion-0').setDepth(depth).setMask(scene.ink.mask);
  },
  pose(scene, image, role, index, size) {
    const data = globalThis.E4_VILLAGE_MOTIONS[role], frame = index % data.frames.length;
    const rect = data.frames[frame], pivot = data.pivots?.[frame] ?? [rect[2] / 2, rect[3] / 2];
    const maxSide = data.referenceSide || Math.max(...data.frames.map(r => Math.max(r[2], r[3])));
    image.setTexture(`e4:${role}`, `motion-${frame}`).setOrigin(pivot[0] / rect[2], pivot[1] / rect[3]);
    image.setScale(E4_VILLAGE.size(scene, size) / maxSide);
  },
};

// 미로 통로 그래프를 따라 추격한다. 노드 사이 이동을 끝낸 뒤 경로를 갱신해 코너를 관통하지 않는다.
const E4_TIGER = {
  build(scene) {
    const game = E4_ACCELERATION_DASH, start = game.tileCenter(1, 1);
    start.x = Math.max(game.grid.wall + game.chase.bodyRadius + 1, start.x - game.chase.spawnOffset);
    scene.state.tiger = { ...start, node: { col: 1, row: 1 }, next: null,
      enabled: true, active: false, gait: 'waiting', speed: 0, catches: 0, facing: 1, angle: Math.PI / 2, phase: 0, moving: false };
    scene.tigerInk = scene.add.graphics().setDepth(3).setMask(scene.ink.mask);
    scene.tigerSprite = E4_MOTION.create(scene, 'tiger', 3);
    scene.tigerLabel = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffe1a0',
      stroke: '#2c2018', strokeThickness: 3,
    }).setOrigin(.5).setDepth(4);
  },
  cell(scene, x, y) {
    const game = E4_ACCELERATION_DASH;
    for (let row = 0; row < game.grid.rows; row++) for (let col = 0; col < game.grid.cols; col++) {
      if (scene.state.tiles[row][col]) continue;
      const r = game.tileRect(col, row);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { col, row };
    }
    return null;
  },
  nextNode(scene, from, to) {
    const key = p => `${p.col},${p.row}`, queue = [from], visited = new Map([[key(from), null]]);
    for (let i = 0; i < queue.length; i++) {
      const here = queue[i];
      if (key(here) === key(to)) {
        let next = here, parent = visited.get(key(next));
        while (parent && key(parent) !== key(from)) { next = parent; parent = visited.get(key(next)); }
        return next;
      }
      for (const d of Object.values(E4_ACCELERATION_DASH.steps)) {
        const next = { col: here.col + d.x, row: here.row + d.y };
        if (scene.state.tiles[next.row]?.[next.col] !== 0 || visited.has(key(next))) continue;
        visited.set(key(next), here); queue.push(next);
      }
    }
    return null;
  },
  update(scene, dt) {
    const s = scene.state, tiger = s.tiger, game = E4_ACCELERATION_DASH, t = game.chase;
    tiger.moving = false;
    if (!tiger.enabled || scene.elapsed < t.delay) return;
    tiger.active = true;
    tiger.gait = scene.elapsed < t.delay + t.walkDuration ? 'walk' : 'run';
    tiger.speed = tiger.gait === 'walk' ? t.walkSpeed : t.runSpeed;
    let budget = tiger.speed * dt;
    const totalBudget = budget;
    const target = E4_TIGER.cell(scene, s.x, s.y);
    if (!target) return;
    while (budget > .001) {
      const center = game.tileCenter(tiger.node.col, tiger.node.row);
      if (!tiger.next) {
        if (tiger.node.col === target.col && tiger.node.row === target.row) {
          tiger.next = { x: s.x, y: s.y, direct: true };
        } else if (Math.hypot(tiger.x - center.x, tiger.y - center.y) > .01) {
          tiger.next = { ...center, ...tiger.node };
        } else {
          const next = E4_TIGER.nextNode(scene, tiger.node, target);
          if (!next) break;
          tiger.next = { ...game.tileCenter(next.col, next.row), ...next };
        }
      }
      const dx = tiger.next.x - tiger.x, dy = tiger.next.y - tiger.y, distance = Math.hypot(dx, dy);
      if (distance < .001) {
        const arrived = tiger.next; tiger.next = null;
        if (arrived.direct) break;
        tiger.node = { col: arrived.col, row: arrived.row }; continue;
      }
      // 이동을 잘게 나눠 검사하므로 프레임이 늦어져도 벽을 뛰어넘지 않는다.
      const step = Math.min(budget, distance, game.tuning.radius / 2);
      const x = tiger.x + dx / distance * step, y = tiger.y + dy / distance * step;
      if (game.wallsAt.call(scene, x, y, t.bodyRadius).length) { tiger.next = null; break; }
      tiger.x = x; tiger.y = y; tiger.moving = true; budget -= step;
      tiger.angle = Math.atan2(dy, dx) + Math.PI / 2; // 원본 위쪽(-Y)을 실제 진행 방향으로 돌린다.
      if (Math.abs(dx) > .1) tiger.facing = Math.sign(dx);
      if (Math.hypot(tiger.x - s.x, tiger.y - s.y) < t.bodyRadius + game.tuning.radius) break;
      if (tiger.next.direct) tiger.next = null;
    }
    if (tiger.moving) tiger.phase += dt * MINI.clamp((totalBudget - budget) / dt / 40, 5, 18);
    if (Math.hypot(tiger.x - s.x, tiger.y - s.y) < t.bodyRadius + game.tuning.radius) {
      tiger.catches++; tiger.next = null; s.flash = .65;
      scene.finish(false, '호랑이에게 붙잡혔습니다');
    }
  },
  render(scene) {
    const t = scene.state.tiger, grid = E4_ACCELERATION_DASH.grid;
    const x = t.x + grid.x, y = t.y + grid.y, g = scene.tigerInk;
    g.clear();
    const visible = t.enabled && t.active;
    if (scene.tigerSprite) {
      E4_MOTION.pose(scene, scene.tigerSprite, 'tiger', [0, 1, 2, 1][Math.floor(t.phase) % 4], 64);
      scene.tigerSprite.setVisible(visible).setPosition(x, y).setRotation(t.angle).setFlipX(false);
    }
    scene.tigerLabel.setPosition(x, y - 31).setText(!t.enabled ? '' : !t.active
      ? `호랑이 출발 ${Math.max(0, E4_ACCELERATION_DASH.chase.delay - scene.elapsed).toFixed(1)}` : t.catches ? '어흥!' : '');
    if (!visible || scene.tigerSprite) return;
    // 에셋 도착 전 주황 몸통·줄무늬·꼬리로 추격 방향을 보여 준다.
    const face = t.facing, stride = t.moving ? Math.sin(scene.elapsed * 25) * 3 : 0;
    g.lineStyle(4, 0xd68c36).lineBetween(x - face * 13, y, x - face * 23, y - 9);
    g.lineStyle(4, 0xf2ab4c).lineBetween(x - 9, y + 5, x - 10 + stride, y + 13);
    g.lineBetween(x + 9, y + 5, x + 10 - stride, y + 13);
    g.fillStyle(0xeaa149).fillEllipse(x, y, 31, 20);
    for (let i = -1; i <= 1; i++) {
      g.fillStyle(0x3d3025).fillTriangle(x + i * 7 - 2, y - 9, x + i * 7 + 3, y - 8, x + i * 7 + 1, y + 3);
    }
    g.fillStyle(0xf4b85e).fillCircle(x + face * 14, y - 2, 9);
    g.fillStyle(0x493727).fillCircle(x + face * 10, y - 10, 3).fillCircle(x + face * 18, y - 10, 3);
    g.fillStyle(0xf8e6be).fillEllipse(x + face * 19, y + 2, 10, 8);
    g.fillStyle(0x1d2421).fillCircle(x + face * 18, y - 4, 1.8).fillCircle(x + face * 23, y + 1, 2);
  },
};
