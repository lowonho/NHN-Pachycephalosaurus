import { MINI } from './minigame-kit.js';

export const E8_WEB_SWING = {
  tuning: {
    speed: 320, acceleration: 55, maxSpeed: 1120, gravity: 1500, jump: 530,
    radius: 18, roofY: 434, hookRange: 620, maxLaunchRise: 820, retryDelay: .32,
    roofWidths: [650, 620, 650, 700, 750, 800, 850, 900, 1000],
    gapWidths: [350, 430, 510, 590, 670, 750, 810, 850],
  },
  build() {
    MINI.init(this, 0xff6687);
    const t = E8_WEB_SWING.tuning;
    let x = 0;
    this.roofs = t.roofWidths.map((w, index) => {
      const roof = { x, w, y: t.roofY, index };
      x += w + (t.gapWidths[index] || 0);
      return roof;
    });
    this.anchors = this.roofs.slice(0, -1).map((roof, index) => ({
      x: roof.x + roof.w + t.gapWidths[index] / 2,
      y: 205 - index * 17, index,
    }));
    this.goalX = x - 260;
    this.state = {
      x: 90, y: t.roofY - t.radius, vx: t.speed, vy: 0, speed: t.speed,
      grounded: true, roofIndex: 0, checkpoint: 0, rope: null, pointerHeld: false,
      jumps: 0, hooks: 0, misses: 0, deaths: 0, retry: 0, trail: [],
    };
  },
  candidate() {
    const s = this.state, t = E8_WEB_SWING.tuning;
    return this.anchors.find(a => a.x > s.x + 18 && a.y < s.y - 35 &&
      Math.hypot(a.x - s.x, a.y - s.y) <= t.hookRange) ?? null;
  },
  action() {
    const s = this.state, t = E8_WEB_SWING.tuning;
    if (s.retry || s.rope) return;
    this.actions++;
    if (s.grounded) {
      s.grounded = false; s.vy = -t.jump; s.jumps++; this.sfx('jump');
      return;
    }
    const anchor = E8_WEB_SWING.candidate.call(this);
    if (anchor) {
      s.rope = { anchor: anchor.index, length: Math.hypot(s.x - anchor.x, s.y - anchor.y), taut: false };
      s.hooks++; this.sfx('jump');
    } else s.misses++;
  },
  pointerDown() {
    this.state.pointerHeld = true;
    E8_WEB_SWING.action.call(this);
  },
  pointerUp() {
    this.state.pointerHeld = false;
    if (!this.held('action')) this.state.rope = null;
  },
  cancelInput() { this.state.pointerHeld = false; this.state.rope = null; },
  fall() {
    const s = this.state, t = E8_WEB_SWING.tuning, roof = this.roofs[s.checkpoint];
    s.deaths++; s.x = roof.x + 60; s.y = roof.y - t.radius; s.vy = 0;
    s.grounded = true; s.roofIndex = roof.index; s.rope = null; s.trail = [];
    s.retry = t.retryDelay;
    MINI.summon(this); this.bump();
  },
  update(dt) {
    const s = this.state, t = E8_WEB_SWING.tuning;
    s.speed = Math.min(t.maxSpeed, t.speed + this.elapsed * t.acceleration);
    s.vx = s.speed;
    if (s.rope && !this.held('action') && !s.pointerHeld) s.rope = null;
    if (s.retry > 0) { s.retry = Math.max(0, s.retry - dt); return; }
    const oldX = s.x, oldY = s.y;
    s.x += s.vx * dt;
    const support = this.roofs[s.roofIndex];
    if (s.grounded && s.x - t.radius > support.x + support.w) s.grounded = false;
    if (!s.grounded) {
      s.vy += t.gravity * dt; s.y += s.vy * dt;
      if (s.rope) {
        const rope = s.rope, a = this.anchors[rope.anchor], dx = s.x - a.x;
        // 자동 전진 속도를 유지하면서 팽팽해진 줄의 원호를 따라 스윙합니다.
        // 줄은 당기기만 하고, 놓으면 원호의 접선 방향 상승 속도를 이어받습니다.
        const dy2 = rope.length ** 2 - dx ** 2;
        if (dy2 <= 0) s.rope = null;
        else {
          const dy = Math.sqrt(dy2), limitY = a.y + dy;
          if (s.y >= limitY) {
            s.y = limitY; s.vy = -dx / dy * s.vx; rope.taut = true;
            if (s.vy < -t.maxLaunchRise) { s.vy = -t.maxLaunchRise; s.rope = null; }
          } else rope.taut = false;
        }
      }
      let landed = false, wall = false;
      for (const roof of this.roofs) {
        if (s.x + t.radius <= roof.x || s.x - t.radius >= roof.x + roof.w) continue;
        if (s.vy >= 0 && oldY + t.radius <= roof.y + .01 && s.y + t.radius >= roof.y) {
          s.y = roof.y - t.radius; s.vy = 0; s.grounded = true; s.roofIndex = roof.index;
          s.checkpoint = roof.index; s.rope = null; landed = true; break;
        }
        if (s.y + t.radius > roof.y + 5 && oldX + t.radius <= roof.x) wall = true;
      }
      if (!landed && (wall || s.y > 660)) E8_WEB_SWING.fall.call(this);
    }
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 10) s.trail.shift();
    this.anomaly = `속도 ${(s.speed / t.speed).toFixed(1)}배 · 거미줄 ${s.hooks}회 · 추락 ${s.deaths}회`;
    this.risk = (s.speed - t.speed) / (t.maxSpeed - t.speed) * 100;
    if (s.x >= this.goalX && s.grounded) this.finish(true);
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
  hero(x, y, angle) {
    if (this.textures.exists('e8:player')) {
      MINI.actor(this, 'player', 'player', x, y, 40, 48, angle); return;
    }
    const g = this.ink, s = this.state;
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(angle);
    const stride = s.grounded ? Math.sin(this.elapsed * s.speed / 18) * 8 : 6;
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
    const progress = MINI.clamp((s.x - 90) / (this.goalX - 90), 0, 1);
    MINI.frame(this, `WEB RUN  ${Math.floor(progress * 100)}%     SPEED ×${(s.speed / t.speed).toFixed(1)}     FALL ${s.deaths}`);
    g.fillStyle(0x101a36).fillRect(22, 146, 916, 339);
    MINI.circle(this, 808, 203, 24, 0xeee2c3, .85);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 103 - s.x * .13) % 1450 + 1450) % 1450 - 200;
      E8_WEB_SWING.building.call(this, x, 265 + (i * 47 % 100), 65 + i % 3 * 22, i, true);
    }
    const scale = 1 - (s.speed - t.speed) / (t.maxSpeed - t.speed) * .34;
    const cameraX = s.x - 200 / scale;
    const shiftY = MINI.clamp(420 - t.roofY * scale, 190 - s.y * scale, 462 - s.y * scale);
    g.save(); g.translateCanvas(-cameraX * scale, shiftY); g.scaleCanvas(scale, scale);
    const visible = x => x > cameraX - 160 && x < cameraX + 1100 / scale;
    for (const a of this.anchors) if (visible(a.x)) E8_WEB_SWING.tower.call(this, a);
    for (const roof of this.roofs) if (roof.x + roof.w > cameraX && visible(roof.x)) {
      E8_WEB_SWING.building.call(this, roof.x, roof.y, roof.w, roof.index);
    }
    const next = E8_WEB_SWING.candidate.call(this);
    if (next && !s.grounded && !s.rope) {
      g.lineStyle(2, 0xf7e9db, .7).strokeCircle(next.x, next.y, 12);
    }
    const angle = s.rope ? MINI.clamp((s.x - this.anchors[s.rope.anchor].x) / s.rope.length, -.8, .8) : MINI.clamp(s.vy / 1700, -.45, .45);
    if (s.rope) {
      const a = this.anchors[s.rope.anchor];
      const handX = a.x < s.x ? -17 : 17, handY = a.x < s.x ? -20 : -24;
      MINI.line(this, a.x, a.y,
        s.x + handX * Math.cos(angle) - handY * Math.sin(angle),
        s.y + handX * Math.sin(angle) + handY * Math.cos(angle), 0xffffff, 2);
      g.lineStyle(1, 0xc2e5ff, .35).strokeCircle(a.x, a.y, 10);
    }
    s.trail.forEach((p, i) => { if (i % 2 === 0) MINI.circle(this, p.x, p.y, 3, 0xe94064, i / 35); });
    if (!this.textures.exists('e8:player')) E8_WEB_SWING.hero.call(this, s.x, s.y, angle);
    if (visible(this.goalX)) {
      MINI.line(this, this.goalX, t.roofY, this.goalX, t.roofY - 132, 0xa7ffc6, 4);
      g.fillStyle(0xa7ffc6).fillTriangle(this.goalX, t.roofY - 132, this.goalX + 57, t.roofY - 115, this.goalX, t.roofY - 98);
      MINI.goal(this, this.goalX, t.roofY - 55, 20);
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
