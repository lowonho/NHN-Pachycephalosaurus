import { MINI } from './minigame-kit.js';

export const E9_ICE_CURLING = {
  tuning: { friction: 220, decay: .69, minFriction: 26, force: 5.7, maxPull: 130, targetRadius: 41, stoneRadius: 14 },
  /* 성공 판정: 돌이 과녁(붉은 하우스)에 걸친 채 멈추면 그 한 번으로 클리어다.
     돌 반지름만큼 여유를 두므로 가장자리에 살짝 걸쳐도 성공으로 친다. */
  landingRadius() { const t = E9_ICE_CURLING.tuning; return t.targetRadius + t.stoneRadius; },
  build() {
    MINI.init(this, 0xabe5ff);
    this.state = { x: 166, y: 361, vx: 0, vy: 0, failures: 0, moving: false, drag: null, cooldown: 0 };
    this.target = { x: 769, y: 287 };
  },
  friction() { const t = E9_ICE_CURLING.tuning; return Math.max(t.minFriction, t.friction * t.decay ** (this.state.failures * this.penalty(1))); },
  pointerDown(x, y) {
    const s = this.state;
    if (s.moving || s.cooldown || Math.hypot(x - s.x, y - s.y) > 43) return;
    s.drag = { x: s.x, y: s.y };
  },
  pointerMove(x, y) {
    const s = this.state, t = E9_ICE_CURLING.tuning;
    if (!s.drag) return;
    const dx = x - s.x, dy = y - s.y, scale = Math.min(1, t.maxPull / Math.max(1, Math.hypot(dx, dy)));
    s.drag = { x: s.x + dx * scale, y: s.y + dy * scale };
  },
  pointerUp() {
    const s = this.state, d = s.drag;
    s.drag = null;
    if (!d || Math.hypot(d.x - s.x, d.y - s.y) < 5) return;
    s.vx = (s.x - d.x) * E9_ICE_CURLING.tuning.force; s.vy = (s.y - d.y) * E9_ICE_CURLING.tuning.force;
    s.moving = true; this.actions++; this.sfx('jump');
  },
  cancelInput() { this.state.drag = null; },
  retryStone() {
    const s = this.state;
    s.failures++; s.moving = false; s.cooldown = .28; s.x = 166; s.y = 361; s.vx = s.vy = 0;
    MINI.summon(this); this.sfx('failure');
  },
  update(dt) {
    const s = this.state;
    s.cooldown = Math.max(0, s.cooldown - dt);
    if (s.moving) {
      const speed = Math.hypot(s.vx, s.vy), next = Math.max(0, speed - E9_ICE_CURLING.friction.call(this) * dt);
      if (speed) {
        s.x += s.vx / speed * (speed + next) * .5 * dt; s.y += s.vy / speed * (speed + next) * .5 * dt;
        s.vx *= next / speed; s.vy *= next / speed;
      }
      if (s.x < 37 || s.x > 923 || s.y < 167 || s.y > 470) E9_ICE_CURLING.retryStone.call(this);
      // 멈춘 자리가 과녁이면 재시도 없이 바로 성공. 아니면 새 돌로 다시 던진다.
      else if (next === 0) {
        if (Math.hypot(s.x - this.target.x, s.y - this.target.y) <= E9_ICE_CURLING.landingRadius()) {
          this.finish(true, s.failures ? `${s.failures + 1}번째 투구로 과녁 안착` : '첫 투구로 과녁 안착');
        } else E9_ICE_CURLING.retryStone.call(this);
      }
    }
    this.anomaly = `마찰 ${Math.round(E9_ICE_CURLING.friction.call(this))} · 실패 ${s.failures}회 · 과녁에 한 번만 멈추면 성공`;
    this.risk = Math.min(100, s.failures * 18);
  },
  render() {
    const s = this.state, target = this.target, f = MINI.FIELD;
    MINI.frame(this);
    // 링크 둘레는 화면 끝까지 채우고, 그 안쪽만 돌이 미끄러지는 얼음이다.
    MINI.box(this, f.x, f.y, f.w, f.h, 0x123243);
    MINI.box(this, 32, 158, 896, 321, 0xc7e8f0, .12);
    for (let y = 187; y < 466; y += 35) MINI.line(this, 55, y, 905, y - 18, 0xd6f5ff, .5);
    MINI.circle(this, target.x, target.y, 71, 0x719dd5, .5);
    MINI.circle(this, target.x, target.y, 53, 0xe6faff, .7);
    MINI.circle(this, target.x, target.y, 41, 0xf77891, .85);
    MINI.circle(this, target.x, target.y, 14, 0xf5feff);
    // 성공으로 인정되는 정지 범위를 그대로 보여 준다 — 이 안에서 멈추면 한 번에 끝난다.
    E9_ICE_CURLING.landingRing.call(this, target);
    if (s.drag) {
      MINI.line(this, s.drag.x, s.drag.y, s.x, s.y, 0xffdc90, 3);
      MINI.line(this, s.x, s.y, s.x + (s.x - s.drag.x) * 1.4, s.y + (s.y - s.drag.y) * 1.4, 0xffdc90, 2);
      MINI.circle(this, s.drag.x, s.drag.y, 6, 0xffdc90);
    }
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'stone', 'stone', s.x, s.y, 28 * pop, 28 * pop, 0, 0xffd78f);
    if (pop) MINI.line(this, s.x - 7 * pop, s.y - 3, s.x + 7 * pop, s.y - 3, 0x735743, 5);
    MINI.spawnFx(this, s.x, s.y, 28);
  },
  /* 판정 원을 점선 고리로 두른다. 밝은 얼음 위에서도 읽히도록 어두운 테두리를 깔고,
     돌이 다가올수록 초록이 진해져 "여기서 멈추면 끝"임을 알린다. */
  landingRing(target) {
    const s = this.state, radius = E9_ICE_CURLING.landingRadius();
    const near = Math.max(0, 1 - Math.hypot(s.x - target.x, s.y - target.y) / 260);
    const g = this.ink;
    const dashes = [];
    for (let i = 0; i < 28; i += 2) {
      const from = i / 28 * Math.PI * 2, to = (i + 1.15) / 28 * Math.PI * 2;
      dashes.push([target.x + Math.cos(from) * radius, target.y + Math.sin(from) * radius,
        target.x + Math.cos(to) * radius, target.y + Math.sin(to) * radius]);
    }
    g.lineStyle(6, 0x0b3324, .55);
    for (const [x, y, xx, yy] of dashes) g.lineBetween(x, y, xx, yy);
    g.lineStyle(3, 0x6dffa8, .7 + near * .3);
    for (const [x, y, xx, yy] of dashes) g.lineBetween(x, y, xx, yy);
  },
};
