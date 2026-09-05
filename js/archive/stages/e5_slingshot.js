import { MINI } from './minigame-kit.js';

export const E5_SLINGSHOT = {
  tuning: { force: 8.4, decay: .045, minPower: .76, gravity: 640, maxPull: 112, cooldown: .38, targetHP: 29 },
  build() {
    MINI.init(this, 0xffbd69);
    this.state = { shots: 0, cooldown: 0, drag: null, balls: [], targets: [] };
    for (let i = 0; i < 6; i++) this.state.targets.push({ x: 650 + (i % 3) * 86, y: 424 - Math.floor(i / 3) * 53, w: 38, h: 46, hp: E5_SLINGSHOT.tuning.targetHP });
  },
  power() { return Math.max(E5_SLINGSHOT.tuning.minPower, 1 - this.state.shots * this.penalty(E5_SLINGSHOT.tuning.decay)); },
  pointerDown(x, y) {
    if (this.state.cooldown || Math.hypot(x - 164, y - 382) > 55) return;
    this.state.drag = { x: 164, y: 382 };
    E5_SLINGSHOT.pointerMove.call(this, x, y);
  },
  pointerMove(x, y) {
    if (!this.state.drag) return;
    const dx = x - 164, dy = y - 382, length = Math.max(1, Math.hypot(dx, dy)), scale = Math.min(1, E5_SLINGSHOT.tuning.maxPull / length);
    this.state.drag = { x: 164 + dx * scale, y: 382 + dy * scale };
  },
  pointerUp() {
    const s = this.state, d = s.drag, t = E5_SLINGSHOT.tuning;
    if (!d) return;
    s.drag = null;
    if (Math.hypot(d.x - 164, d.y - 382) < 8) return;
    const power = E5_SLINGSHOT.power.call(this);
    s.balls.push({ x: d.x, y: d.y, vx: (164 - d.x) * t.force * power, vy: (382 - d.y) * t.force * power, power, age: 0, hit: new Set(), id: s.shots });
    s.shots++; this.actions++; s.cooldown = t.cooldown; this.sfx('jump');
  },
  cancelInput() { this.state.drag = null; },
  update(dt) {
    const s = this.state, t = E5_SLINGSHOT.tuning;
    s.cooldown = Math.max(0, s.cooldown - dt);
    for (const b of s.balls) {
      b.age += dt; b.vy += t.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > 457) { b.y = 457; b.vy *= -.36; b.vx *= .78; }
      s.targets.forEach((target, i) => {
        if (target.hp <= 0 || b.hit.has(i) || !MINI.hit({ x: b.x - 12, y: b.y - 12, w: 24, h: 24 }, target)) return;
        target.hp = Math.max(0, target.hp - Math.max(6, Math.hypot(b.vx, b.vy) * .1 * b.power));
        b.hit.add(i); b.vx *= .73; b.vy -= 60; this.sfx('hit');
      });
    }
    s.balls = s.balls.filter(b => {
      const keep = b.age < 3.2 && b.x < 980 && b.x > -30;
      if (!keep) { this.assetSprites.get(`ball${b.id}`)?.destroy(); this.assetSprites.delete(`ball${b.id}`); }
      return keep;
    });
    const left = s.targets.filter(o => o.hp > 0).length;
    this.anomaly = `고무줄 힘 ${Math.round(E5_SLINGSHOT.power.call(this) * 100)}% · 남은 목표 ${left}`;
    this.risk = (1 - E5_SLINGSHOT.power.call(this)) * 180;
    if (!left) this.finish(true);
  },
  render() {
    const s = this.state, d = s.drag ?? { x: 164, y: 382 }, power = E5_SLINGSHOT.power.call(this), t = E5_SLINGSHOT.tuning;
    MINI.frame(this, `TARGET ${s.targets.filter(o => o.hp <= 0).length} / 6    POWER ${Math.round(power * 100)}%`);
    MINI.box(this, 25, 471, 910, 9, 0x695e4b);
    MINI.line(this, 146, 447, 137, 358, 0xa78260, 12); MINI.line(this, 146, 404, 184, 357, 0xa78260, 12);
    MINI.line(this, 137, 360, d.x, d.y, 0xffd99b, 3); MINI.line(this, 184, 357, d.x, d.y, 0xffd99b, 3);
    MINI.actor(this, 'projectile', 'ready', d.x, d.y, 26, 26);
    if (s.drag) for (let i = 1; i <= 16; i++) {
      const time = i * .065;
      MINI.circle(this, d.x + (164 - d.x) * t.force * power * time, d.y + (382 - d.y) * t.force * power * time + .5 * t.gravity * time * time, 2, 0xffe1b8, .6);
    }
    s.targets.forEach((o, i) => {
      if (o.hp <= 0) { MINI.hideActor(this, `target${i}`); return; }
      MINI.actor(this, 'target', `target${i}`, o.x + o.w / 2, o.y + o.h / 2, o.w, o.h, 0, 0xfa7a91);
      MINI.box(this, o.x, o.y - 8, o.w * o.hp / t.targetHP, 4, 0xa7ffc6);
    });
    for (const b of s.balls) MINI.actor(this, 'projectile', `ball${b.id}`, b.x, b.y, 24, 24, b.age * 8);
  },
};
