import { MINI } from './minigame-kit.js';

export const E2_BOUNCE_BALL = {
  tuning: { speed: 245, gravity: 1300, jump: 365, jumpGain: 34, maxJump: 760, goal: 2880 },
  build() {
    MINI.init(this, 0xb8f77b);
    this.state = { x: 90, y: 433, vy: 0, grounded: true, jumps: 0, deaths: 0, checkpoint: 90 };
    this.platforms = [
      { x: 0, y: 449, w: 375, h: 28 }, { x: 480, y: 429, w: 335, h: 48 },
      { x: 930, y: 449, w: 335, h: 28 }, { x: 1400, y: 415, w: 335, h: 62 },
      { x: 1860, y: 442, w: 335, h: 35 }, { x: 2320, y: 426, w: 310, h: 51 },
      { x: 2730, y: 449, w: 330, h: 28 },
    ];
  },
  action() {
    const s = this.state, t = E2_BOUNCE_BALL.tuning;
    if (!s.grounded) return;
    s.vy = -Math.min(t.maxJump, t.jump + s.jumps * t.jumpGain);
    s.grounded = false; s.jumps++; this.actions++; this.sfx('jump');
  },
  update(dt) {
    const s = this.state, t = E2_BOUNCE_BALL.tuning, previous = s.y;
    s.x = MINI.clamp(s.x + this.axis('left', 'right') * t.speed * dt, 16, 3030);
    // W/S도 공중 위치 조정에 사용. 스페이스를 길게 눌러도 점프력은 변하지 않습니다.
    s.vy += (t.gravity + this.axis('up', 'down') * 420) * dt;
    s.y += s.vy * dt; s.grounded = false;
    for (const p of this.platforms) {
      if (s.vy >= 0 && s.x + 13 > p.x && s.x - 13 < p.x + p.w && previous + 15 <= p.y + 1 && s.y + 15 >= p.y) {
        s.y = p.y - 15; s.vy = 0; s.grounded = true;
        s.checkpoint = p.x + 50;
      }
    }
    if (s.y < 202 || s.y > 535) {
      s.deaths++; s.x = s.checkpoint;
      const p = this.platforms.find(p => s.x >= p.x && s.x <= p.x + p.w);
      s.y = (p?.y ?? 449) - 15; s.vy = 0; s.grounded = true; MINI.summon(this); this.bump();
    }
    this.anomaly = `점프력 ${Math.min(t.maxJump, t.jump + s.jumps * t.jumpGain)} · 사망 ${s.deaths}회`;
    this.risk = Math.min(100, s.jumps * 9);
    if (s.x >= t.goal && s.grounded) this.finish(true);
  },
  render() {
    const s = this.state, cam = Math.max(0, s.x - 190), f = MINI.FIELD;
    MINI.frame(this);
    // 천장 가시는 화면 위 끝까지 이어지는 띠에 매달린다.
    MINI.box(this, f.x, f.y, f.w, 153 - f.y, 0x33203a);
    for (let x = f.x; x < f.right; x += 24) MINI.spike(this, x, 153, 24, 35);
    // 발판 아래는 떨어지면 끝인 낭떠러지다. 화면 아래 끝까지 어둡게 깐다.
    MINI.box(this, f.x, 535, f.w, f.bottom - 535, 0x02070f, .85);
    for (const p of this.platforms) MINI.box(this, p.x - cam, p.y, p.w, p.h, 0x4f7560);
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'player', 'player', s.x - cam, s.y, 30 * pop, 30 * pop, s.x / 60);
    MINI.spawnFx(this, s.x - cam, s.y, 30);
    MINI.goal(this, E2_BOUNCE_BALL.tuning.goal - cam, 424);
    MINI.meter(this, s.x / E2_BOUNCE_BALL.tuning.goal);
  },
};
