import { MINI } from './minigame-kit.js';

export const E9_ICE_CURLING = {
  tuning: { friction: 220, decay: .69, minFriction: 26, force: 5.7, maxPull: 130, targetRadius: 41, stoneRadius: 14 },
  build() {
    MINI.init(this, 0xabe5ff);
    this.state = { x: 166, y: 361, vx: 0, vy: 0, failures: 0, moving: false, drag: null, cooldown: 0, hold: 0 };
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
    s.moving = true; s.hold = 0; this.actions++; this.sfx('jump');
  },
  cancelInput() { this.state.drag = null; },
  retryStone() {
    const s = this.state;
    s.failures++; s.moving = false; s.cooldown = .28; s.x = 166; s.y = 361; s.vx = s.vy = s.hold = 0;
    MINI.summon(this); this.sfx('failure');
  },
  update(dt) {
    const s = this.state, t = E9_ICE_CURLING.tuning;
    s.cooldown = Math.max(0, s.cooldown - dt);
    if (s.moving) {
      const speed = Math.hypot(s.vx, s.vy), next = Math.max(0, speed - E9_ICE_CURLING.friction.call(this) * dt);
      if (speed) {
        s.x += s.vx / speed * (speed + next) * .5 * dt; s.y += s.vy / speed * (speed + next) * .5 * dt;
        s.vx *= next / speed; s.vy *= next / speed;
      }
      if (s.x < 37 || s.x > 923 || s.y < 167 || s.y > 470) E9_ICE_CURLING.retryStone.call(this);
      else if (next === 0) {
        if (Math.hypot(s.x - this.target.x, s.y - this.target.y) <= t.targetRadius - t.stoneRadius) {
          s.hold += dt; if (s.hold >= .2) this.finish(true);
        } else E9_ICE_CURLING.retryStone.call(this);
      }
    }
    this.anomaly = `마찰 ${Math.round(E9_ICE_CURLING.friction.call(this))} · 실패 ${s.failures}회 · ${s.moving ? '미끄러지는 중' : '새 돌 준비'}`;
    this.risk = Math.min(100, s.failures * 18);
  },
  render() {
    const s = this.state, target = this.target;
    MINI.frame(this, `ICE ${Math.round(E9_ICE_CURLING.friction.call(this))}    SHOT ${this.actions}    과녁 안에 돌 전체를 멈추세요`);
    MINI.box(this, 32, 158, 896, 321, 0xc7e8f0, .12);
    for (let y = 187; y < 466; y += 35) MINI.line(this, 55, y, 905, y - 18, 0xd6f5ff, .5);
    MINI.circle(this, target.x, target.y, 71, 0x719dd5, .5);
    MINI.circle(this, target.x, target.y, 53, 0xe6faff, .7);
    MINI.circle(this, target.x, target.y, 41, 0xf77891, .85);
    MINI.circle(this, target.x, target.y, 14, 0xf5feff);
    if (s.drag) {
      MINI.line(this, s.drag.x, s.drag.y, s.x, s.y, 0xffdc90, 3);
      MINI.line(this, s.x, s.y, s.x + (s.x - s.drag.x) * 1.4, s.y + (s.y - s.drag.y) * 1.4, 0xffdc90, 2);
      MINI.circle(this, s.drag.x, s.drag.y, 6, 0xffdc90);
    }
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'stone', 'stone', s.x, s.y, 28 * pop, 28 * pop, 0, 0xffd78f);
    MINI.line(this, s.x - 7, s.y - 3, s.x + 7, s.y - 3, 0x735743, 5);
    MINI.spawnFx(this, s.x, s.y, 28);
  },
};
