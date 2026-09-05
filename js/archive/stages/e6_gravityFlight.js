import { MINI } from './minigame-kit.js';

export const E6_GRAVITY_FLIGHT = {
  tuning: { speed: 255, distance: 4200, gravity: 640, gravityLoss: 35, minGravity: 240, lift: 570, liftGain: 24, maxLift: 850, gap: 155, knockback: 245 },
  build() {
    MINI.init(this, 0x7cd9ff);
    this.state = { x: 0, y: 323, vy: 0, presses: 0, hits: 0, immune: 0 };
    this.gates = Array.from({ length: 12 }, (_, i) => ({ x: 500 + i * 305, y: 314 + Math.sin(i * 1.7) * 65 }));
  },
  action() { this.state.presses++; this.actions++; this.sfx('jump'); },
  update(dt) {
    const s = this.state, t = E6_GRAVITY_FLIGHT.tuning;
    const gravity = Math.max(t.minGravity, t.gravity - s.presses * t.gravityLoss);
    const lift = Math.min(t.maxLift, t.lift + s.presses * t.liftGain);
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt);
    s.vy = MINI.clamp(s.vy + (this.held('action') ? -lift : gravity) * dt, -340, 320);
    s.y += s.vy * dt;
    const gate = this.gates.find(g => Math.abs(g.x - s.x) < 45 && (s.y - 13 < g.y - t.gap / 2 || s.y + 13 > g.y + t.gap / 2));
    if (!s.immune && (gate || s.y < 169 || s.y > 467)) {
      s.hits++; s.x = Math.max(0, s.x - t.knockback); s.y = gate?.y ?? MINI.clamp(s.y, 220, 415); s.vy = 0; s.immune = .85; this.bump();
    }
    s.y = MINI.clamp(s.y, 168, 468);
    this.anomaly = `중력 ${gravity} · 상승 ${lift} · 충돌 ${s.hits}회`;
    this.risk = Math.min(100, s.presses * 6);
    if (s.x >= t.distance) this.finish(true);
  },
  render() {
    const s = this.state, t = E6_GRAVITY_FLIGHT.tuning;
    MINI.frame(this, `FLIGHT ${Math.floor(s.x / t.distance * 100)}%    ${this.held('action') ? '↑ 상승' : '↓ 하강'}    PUSH BACK ${s.hits}`);
    for (const gate of this.gates) {
      const x = gate.x - s.x + 180;
      if (x < -50 || x > 990) continue;
      MINI.box(this, x - 30, 153, 60, gate.y - t.gap / 2 - 153, 0x4c657f);
      MINI.box(this, x - 30, gate.y + t.gap / 2, 60, 480 - gate.y - t.gap / 2, 0x4c657f);
      MINI.line(this, x - 30, gate.y - t.gap / 2, x + 30, gate.y - t.gap / 2, 0xff779b, 5);
      MINI.line(this, x - 30, gate.y + t.gap / 2, x + 30, gate.y + t.gap / 2, 0xff779b, 5);
    }
    MINI.actor(this, 'player', 'player', 180, s.y, 36, 28, s.vy / 900);
    if (this.held('action')) MINI.spike(this, 146, s.y - 8, -MINI.rand(12, 28), 18, 0xffc47e);
    MINI.goal(this, t.distance - s.x + 180, 316);
    MINI.meter(this, s.x / t.distance);
  },
};
