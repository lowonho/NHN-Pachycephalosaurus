import { MINI } from './minigame-kit.js';

export const E8_WEB_SWING = {
  tuning: {
    speed: 340, boost: 1.35, maxMultiplier: 3, gravity: 1050,
    airGravity: 1600, weightGain: .25,
    retryDelay: .32,
    // 시작 지점(첫 스폰)에서는 줄이 연결점과 수평(90도)이 되게 해서, 최대 진폭으로
    // 떨어지며 첫 스윙에 충분한 탄력이 붙게 한다.
    startAngle: -Math.PI / 2,
    spacing: 660, anchorCount: 22, fallY: 710,
  },
  build() {
    MINI.init(this, 0xff6687);
    const t = E8_WEB_SWING.tuning;
    const heights = [125, 85, 155, 110, 65, 140];
    this.anchors = Array.from({ length: t.anchorCount }, (_, index) => ({
      x: 310 + index * t.spacing, y: heights[index % heights.length], index,
      kind: ['empire', 'crane', 'building'][index % 3],
    }));
    this.goalX = this.anchors.at(-1).x + 410;
    this.goalY = 320;
    this.state = {
      x: 0, y: 0, vx: 0, vy: 0, multiplier: 1, speed: t.speed,
      rope: null, pointerHeld: false, visited: [0], checkpoint: 0,
      hooks: 0, misses: 0, deaths: 0, retry: 0, trail: [], boostAt: -10,
    };
    E8_WEB_SWING.respawn.call(this);
    E8_WEB_SWING.camera.call(this, 0);
  },
  respawn() {
    const s = this.state, t = E8_WEB_SWING.tuning;
    s.rope = { anchor: s.checkpoint, length: 270, theta: s.deaths === 0 && s.checkpoint === 0 ? t.startAngle : -.7,
      omega: t.speed * s.multiplier / 270, starter: true };
    E8_WEB_SWING.pose.call(this);
    s.trail = [];
  },
  pose() {
    const s = this.state, r = s.rope, a = this.anchors[r.anchor];
    const sn = Math.sin(r.theta), cs = Math.cos(r.theta);
    s.x = a.x + sn * r.length; s.y = a.y + cs * r.length;
    s.vx = cs * r.omega * r.length; s.vy = -sn * r.omega * r.length;
  },
  candidate() {
    const s = this.state;
    let nearest = null, nearestDistance = Infinity;
    for (const a of this.anchors) {
      const distance = Math.hypot(a.x - s.x, a.y - s.y);
      // 방향·방문 이력·사거리 제한 없이 가까운 연결점. 길이 0인 줄만 제외합니다.
      if (distance > 1 && distance < nearestDistance) { nearest = a; nearestDistance = distance; }
    }
    return nearest;
  },
  action() {
    const s = this.state, t = E8_WEB_SWING.tuning;
    if (s.retry) return;
    if (s.rope?.starter) { s.rope.starter = false; return; }
    // 해제 후 다음 물리 프레임 전에 다시 눌러도 즉시 새 판정을 합니다.
    s.rope = null;
    this.actions++;
    const a = E8_WEB_SWING.candidate.call(this);
    if (!a) { s.misses++; return; }
    const dx = s.x - a.x, dy = s.y - a.y, length = Math.hypot(dx, dy);
    const oldMultiplier = s.multiplier;
    const fresh = !s.visited.includes(a.index);
    if (fresh) {
      s.visited.push(a.index); s.multiplier = Math.min(t.maxMultiplier, s.multiplier * (1 + this.penalty(t.boost - 1)));
      s.boostAt = this.elapsed;
    }
    // 줄을 잡을 때 반지름 방향의 속도는 사라지고 접선 성분이 남습니다.
    // 새 연결점의 가속 효과는 그 접선 방향으로만 추가합니다.
    const tangent = (s.vx * dy - s.vy * dx) / length;
    const catchSpeed = fresh ? Math.sign(tangent || 1) * Math.max(t.speed * oldMultiplier, Math.abs(tangent)) * (s.multiplier / oldMultiplier) : tangent;
    s.rope = { anchor: a.index, length,
      theta: Math.atan2(dx, dy), omega: catchSpeed / length, starter: false };
    s.hooks++; s.checkpoint = Math.max(s.checkpoint, a.index);
    E8_WEB_SWING.pose.call(this); this.sfx('jump');
  },
  pointerDown() { this.state.pointerHeld = true; E8_WEB_SWING.action.call(this); },
  pointerUp() {
    this.state.pointerHeld = false;
    if (!this.held('action')) this.state.rope = null;
  },
  cancelInput() { this.state.pointerHeld = false; this.state.rope = null; },
  fall() {
    const s = this.state;
    s.deaths++; s.retry = E8_WEB_SWING.tuning.retryDelay;
    E8_WEB_SWING.respawn.call(this);
    MINI.summon(this); this.bump();
  },
  camera(dt) {
    const s = this.state, t = E8_WEB_SWING.tuning;
    const focus = s.rope ? this.anchors[s.rope.anchor] : this.anchors.find(a => a.x > s.x);
    const top = Math.min(focus?.y ?? this.goalY - 170, s.y - 200);
    const zoom = Math.min(.82 - (s.multiplier - 1) / (t.maxMultiplier - 1) * .2, 275 / Math.max(275, s.y - top));
    const blend = dt ? 1 - Math.exp(-12 * dt) : 1;
    s.zoom = (s.zoom ?? zoom) + (zoom - (s.zoom ?? zoom)) * blend;
    const viewY = 178 - top * s.zoom;
    s.viewY = (s.viewY ?? viewY) + (viewY - (s.viewY ?? viewY)) * blend;
  },
  airGravity() {
    const t = E8_WEB_SWING.tuning;
    return t.airGravity * (1 + (this.state.multiplier - 1) * this.penalty(t.weightGain));
  },
  update(dt) {
    const s = this.state, t = E8_WEB_SWING.tuning;
    if (s.rope && !s.rope.starter && !this.held('action') && !s.pointerHeld) s.rope = null;
    if (s.retry > 0) { s.retry = Math.max(0, s.retry - dt); return; }
    const oldX = s.x, oldY = s.y;
    if (s.rope) {
      const r = s.rope;
      r.omega -= t.gravity / r.length * Math.sin(r.theta) * dt;
      r.theta += r.omega * dt;
      E8_WEB_SWING.pose.call(this);
      /*
       * 버튼을 누르고 있는 한 각도·속도와 상관없이 줄이 끊기지 않는다.
       * (버튼을 떼면 위 105행에서 이미 rope를 비우므로, 여기까지 오는 것은
       * 항상 버튼을 누르고 있는 경우다.) 장력 부족으로 인한 자유낙하는 두지 않는다.
       */
    } else {
      // 가속이 쌓일수록 공중에서도 더 무겁게 끌려 내려갑니다.
      // 수평 관성은 유지하되 긴 체공으로 여러 연결점을 건너뛰기 어렵게 합니다.
      s.vy += E8_WEB_SWING.airGravity.call(this) * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    }
    s.speed = Math.hypot(s.vx, s.vy);
    if (s.y > t.fallY || s.x < -180) E8_WEB_SWING.fall.call(this);
    s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 12) s.trail.shift();
    this.anomaly = `가속 ${s.multiplier.toFixed(2)}배 · 연결 ${s.hooks}회 · 추락 ${s.deaths}회`;
    this.risk = (s.multiplier - 1) / (t.maxMultiplier - 1) * 100;
    E8_WEB_SWING.camera.call(this, dt);
    // 공중 게이트를 실제로 가로질러야 성공합니다. 옥상 착지는 없습니다.
    if (oldX < this.goalX && s.x >= this.goalX) {
      const y = oldY + (s.y - oldY) * (this.goalX - oldX) / (s.x - oldX);
      if (Math.abs(y - this.goalY) <= 170) this.finish(true);
    }
  },
  building(x, y, w, index, distant = false) {
    const g = this.ink;
    g.fillStyle(distant ? 0x172c4b : 0x283a58).fillRect(x, y, w, 700);
    g.fillStyle(distant ? 0x22375a : 0x344b6c).fillRect(x + 5, y + 6, Math.max(1, w - 10), 5);
    for (let wx = x + 12; wx < x + w - 8; wx += 24) {
      for (let wy = y + 23; wy < 710; wy += 27) {
        const lit = (Math.floor((wx - x) / 24) + Math.floor(wy / 27) + index) % 4 !== 0;
        g.fillStyle(lit ? (distant ? 0x355272 : 0xe6b66f) : 0x15243c, distant ? .55 : .8).fillRect(wx, wy, 7, 10);
      }
    }
    if (!distant) {
      g.fillStyle(0xc6d3e5).fillRect(x, y, w, 5);
      g.fillStyle(0x526484).fillRect(x + w * .4, y - 19, 48, 19);
      g.lineStyle(2, 0x8093b2).strokeRect(x + w * .4 + 7, y - 15, 33, 10);
    }
  },
  tower(a) {
    const g = this.ink;
    // 엠파이어 스테이트 빌딩의 계단식 크라운과 긴 첨탑. 배경 건물이며 첨탑만 줄 연결점입니다.
    g.fillStyle(0x56607b).fillRect(a.x - 63, a.y + 160, 126, 620);
    g.fillStyle(0x65708c).fillRect(a.x - 48, a.y + 105, 96, 60);
    g.fillStyle(0x78829b).fillRect(a.x - 32, a.y + 65, 64, 44);
    g.fillStyle(0x9a9fb0).fillRect(a.x - 18, a.y + 36, 36, 34);
    g.fillStyle(0xb8bdc9).fillRect(a.x - 7, a.y + 17, 14, 25);
    MINI.line(this, a.x, a.y + 21, a.x, a.y, 0xe9efff, 4);
    for (let offset = -51; offset <= 51; offset += 17) {
      const top = a.y + (Math.abs(offset) > 36 ? 170 : Math.abs(offset) > 20 ? 115 : 78);
      MINI.line(this, a.x + offset, top, a.x + offset, 690, 0xd3b688, 3);
    }
    MINI.circle(this, a.x, a.y, 5, 0xff7892);
  },
  landmark(a) {
    const g = this.ink;
    if (a.kind === 'empire') E8_WEB_SWING.tower.call(this, a);
    else if (a.kind === 'crane') {
      E8_WEB_SWING.building.call(this, a.x - 180, a.y + 285, 260, a.index, true);
      const mast = a.x - 85;
      MINI.line(this, mast, a.y + 300, mast, a.y - 25, 0xba8d47, 13);
      MINI.line(this, mast - 70, a.y, a.x + 155, a.y, 0xf4bd60, 10);
      MINI.line(this, mast, a.y - 65, mast - 70, a.y, 0xffd891, 3);
      MINI.line(this, mast, a.y - 65, a.x + 155, a.y, 0xffd891, 3);
      for (let y = a.y + 15; y < a.y + 280; y += 28) {
        MINI.line(this, mast - 6, y, mast + 6, y + 24, 0xffd891, 2);
      }
      g.fillStyle(0x8d6a39).fillRect(mast - 65, a.y + 8, 45, 24);
      MINI.circle(this, a.x, a.y, 6, 0xff7892);
    } else {
      E8_WEB_SWING.building.call(this, a.x + 30, a.y + 28, 180, a.index);
      MINI.line(this, a.x + 85, a.y + 30, a.x + 85, a.y, 0xa9c8e0, 5);
      MINI.line(this, a.x + 85, a.y, a.x, a.y, 0xa9c8e0, 5);
      MINI.circle(this, a.x, a.y, 6, 0xff7892);
    }
  },
  hero(x, y, angle) {
    if (this.textures.exists('e8:player')) {
      MINI.actor(this, 'player', 'player', x, y, 40, 48, angle); return;
    }
    const g = this.ink, s = this.state;
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(angle);
    const stride = s.rope ? 6 : 10;
    g.lineStyle(7, 0x367cff).lineBetween(-4, 8, -10 - stride, 19).lineBetween(4, 8, 10 + stride, 17);
    g.lineStyle(5, 0xe74061).lineBetween(-10 - stride, 19, -4 - stride, 20).lineBetween(10 + stride, 17, 16 + stride, 17);
    g.fillStyle(0xe74061).fillRoundedRect(-9, -9, 18, 23, 5);
    g.fillStyle(0x164990).fillRect(-9, 5, 5, 8).fillRect(4, 5, 5, 8);
    g.lineStyle(5, 0xe74061).lineBetween(-7, -4, -17, s.rope ? -20 : 5).lineBetween(7, -4, 17, s.rope ? -24 : -1);
    g.fillStyle(0xef4c68).fillEllipse(0, -18, 22, 25);
    g.lineStyle(1, 0x7e203c).lineBetween(0, -29, 0, -7).lineBetween(-10, -22, 10, -16).lineBetween(-10, -15, 10, -21);
    g.fillStyle(0xf3faff).fillTriangle(-9, -23, -2, -19, -5, -15).fillTriangle(9, -23, 2, -19, 5, -15);
    g.fillStyle(0x131d36).fillEllipse(0, 1, 4, 8);
    for (const dy of [-3, 1, 5]) g.lineStyle(1, 0x131d36).lineBetween(-5, dy - 2, 5, dy + 2);
    g.restore();
  },
  render() {
    const s = this.state, t = E8_WEB_SWING.tuning, g = this.ink;
    const progress = MINI.clamp(s.x / this.goalX, 0, 1);
    MINI.frame(this, `WEB SWING  ${Math.floor(progress * 100)}%     BOOST ×${s.multiplier.toFixed(2)}     FALL ${s.deaths}`);
    g.fillStyle(0x101a36).fillRect(MINI.FIELD.x, MINI.FIELD.y, MINI.FIELD.w, MINI.FIELD.h);
    MINI.circle(this, 808, 203, 24, 0xeee2c3, .85);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 103 - s.x * .13) % 1450 + 1450) % 1450 - 200;
      E8_WEB_SWING.building.call(this, x, 265 + (i * 47 % 100), 65 + i % 3 * 22, i, true);
    }
    const scale = s.zoom;
    const cameraX = s.x - 200 / scale;
    const shiftY = s.viewY;
    g.save(); g.translateCanvas(-cameraX * scale, shiftY); g.scaleCanvas(scale, scale);
    const visible = x => x > cameraX - 160 && x < cameraX + 1100 / scale;
    for (const a of this.anchors) if (visible(a.x)) E8_WEB_SWING.landmark.call(this, a);
    const next = E8_WEB_SWING.candidate.call(this);
    if (next && !s.rope) {
      g.lineStyle(2, 0xf7e9db, .7).strokeCircle(next.x, next.y, 12);
    }
    const angle = s.rope ? -s.rope.theta : MINI.clamp(Math.atan2(s.vy, Math.abs(s.vx)) + .6, -.9, 1.1);
    if (s.rope) {
      const a = this.anchors[s.rope.anchor];
      const handX = a.x < s.x ? -17 : 17, handY = a.x < s.x ? -20 : -24;
      MINI.line(this, a.x, a.y,
        s.x + handX * Math.cos(angle) - handY * Math.sin(angle),
        s.y + handX * Math.sin(angle) + handY * Math.cos(angle), 0xffffff, 2);
      g.lineStyle(1, 0xc2e5ff, .35).strokeCircle(a.x, a.y, 10);
    }
    s.trail.forEach((p, i) => { if (i % 2 === 0) MINI.circle(this, p.x, p.y, 3, 0xe94064, i / 35); });
    const boostFlash = (this.elapsed - s.boostAt) / .4;
    if (boostFlash >= 0 && boostFlash < 1) g.lineStyle(3, 0xffa474, 1 - boostFlash).strokeCircle(s.x, s.y, 25 + boostFlash * 25);
    if (!this.textures.exists('e8:player')) E8_WEB_SWING.hero.call(this, s.x, s.y, angle);
    if (visible(this.goalX)) {
      g.lineStyle(6, 0xa7ffc6).strokeEllipse(this.goalX, this.goalY, 75, 340);
      g.lineStyle(2, 0xa7ffc6, .3).strokeEllipse(this.goalX, this.goalY, 98, 365);
      MINI.line(this, this.goalX - 20, this.goalY - 170, this.goalX + 20, this.goalY - 170, 0xffffff, 6);
    }
    g.restore();
    if (this.textures.exists('e8:player')) MINI.actor(this, 'player', 'player', 200, s.y * scale + shiftY, 40 * scale, 48 * scale, angle);
    MINI.spawnFx(this, 200, s.y * scale + shiftY, 28);
    // 속도에 맞춰 시야를 넓히고 화면 가장자리의 잔상만 늘립니다.
    for (let i = 0; i < Math.floor(this.risk / 12); i++) {
      const y = 176 + (i * 43 % 250), x = 735 + (i * 71 + this.elapsed * 700) % 180;
      MINI.line(this, x, y, x - 25 - this.risk * .6, y, 0x9ebeff, 1);
    }
    MINI.meter(this, progress);
  },
};
