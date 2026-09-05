import { MINI } from './minigame-kit.js';

export const E8_SEESAW = {
  tuning: { drops: 7, moveSpeed: 245, playerMass: 12, inertia: 1900, damping: 3.7, beamHalf: 350, pivotY: 350, floorY: 477 },
  build() {
    MINI.init(this, 0x91ead7);
    this.state = { x: -100, angle: .015, omega: 0, count: 0, weights: [], age: 0 };
    this.dropPlan = Array.from({ length: E8_SEESAW.tuning.drops }, (_, i) => ({
      time: 1.1 + i * 2.45, x: MINI.rand(105, 280, this.random), mass: MINI.rand(.8, 1.4, this.random),
    }));
  },
  press(direction) { if (direction === 'left' || direction === 'right') this.actions++; },
  update(dt) {
    const s = this.state, t = E8_SEESAW.tuning;
    s.age += dt;
    s.x = MINI.clamp(s.x + this.axis('left', 'right') * t.moveSpeed * dt, -330, -42);
    if (s.count < this.dropPlan.length && s.age >= this.dropPlan[s.count].time) {
      const plan = this.dropPlan[s.count++]; s.weights.push({ ...plan, y: 154, vy: 0, landed: false });
    }
    for (const w of s.weights) if (!w.landed) {
      w.vy += 700 * dt; w.y += w.vy * dt;
      if (w.y >= t.pivotY + Math.sin(s.angle) * w.x - 16) { w.landed = true; s.omega += w.mass * .055; this.sfx('hit'); }
    }
    const rightTorque = (1200 + s.weights.filter(w => w.landed).reduce((sum, w) => sum + w.mass * w.x, 0)) * this.penalty(1);
    s.omega += ((rightTorque + s.x * t.playerMass) * Math.cos(s.angle) / t.inertia - s.omega * t.damping) * dt;
    s.angle += s.omega * dt;
    // 우리 쪽 끝은 바닥에 닿아도 받쳐집니다. 실패 조건은 반대쪽 끝만입니다.
    const contact = Math.asin((t.floorY - t.pivotY - 7) / t.beamHalf);
    if (s.angle < -contact) { s.angle = -contact; s.omega = Math.max(0, s.omega); }
    if (s.angle >= contact) this.finish(false, '반대편이 바닥에 닿았습니다.');
    this.anomaly = `랜덤 추 ${s.count}/${t.drops} · 반대편 여유 ${Math.max(0, Math.round(t.floorY - t.pivotY - Math.sin(s.angle) * t.beamHalf - 7))}`;
    this.risk = MINI.clamp(s.angle / contact * 100, 0, 100);
  },
  timeout() { return true; },
  render() {
    const s = this.state, t = E8_SEESAW.tuning, c = Math.cos(s.angle), sn = Math.sin(s.angle), f = MINI.FIELD;
    MINI.frame(this);
    // 바닥은 화면 아래 끝까지 이어진다.
    MINI.box(this, f.x, t.floorY, f.w, f.bottom - t.floorY, 0x4a6668);
    MINI.spike(this, 448, 471, 64, -121, 0x446e78);
    MINI.line(this, 480 - c * 350, t.pivotY - sn * 350, 480 + c * 350, t.pivotY + sn * 350, 0xa9bcce, 13);
    MINI.line(this, 480, t.pivotY, 480 + c * 350, t.pivotY + sn * 350, s.angle > .2 ? 0xff6584 : 0xffc47e, 13);
    MINI.circle(this, 480, t.pivotY, 12, 0xefffe7);
    MINI.actor(this, 'player', 'player', 480 + s.x * c, t.pivotY + s.x * sn - 26, 39, 48, s.angle);
    MINI.actor(this, 'weight', 'base', 480 + 100 * c, t.pivotY + 100 * sn - 20, 43, 33, s.angle, 0xffc47e);
    s.weights.forEach((w, i) => MINI.actor(this, 'weight', `w${i}`, 480 + w.x * c, w.landed ? t.pivotY + w.x * sn - 16 : w.y, 24 + w.mass * 8, 30, w.landed ? s.angle : 0, 0xffa8b8));
    const next = this.dropPlan[s.count];
    if (next && next.time - s.age < .85) { MINI.line(this, 480 + next.x, 160, 480 + next.x, 215, 0xff6584); MINI.spike(this, 470 + next.x, 205, 20, 14); }
    MINI.meter(this, this.elapsed / this.timeLimit);
  },
};
