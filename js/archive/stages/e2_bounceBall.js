import { MINI } from './minigame-kit.js';

export const E2_BOUNCE_BALL = {
  tuning: { speed: 245, gravity: 1300, jump: 480, jumpLoss: 38, minJump: 260, radius: 20, goal: 2880 },
  build() {
    MINI.init(this, 0xb8f77b);
    this.state = { x: 90, y: 429, vy: 0, grounded: true, jumps: 0, deaths: 0, checkpoint: 90,
      roll: 0, squash: 0, burst: 0, shards: [] };
    this.ballInk = this.add.graphics().setMask(this.ink.mask).setDepth(3);
    // 약해진 공으로도 가장자리에서 뛰면 건널 수 있도록 뒤쪽 간격을 좁힙니다.
    this.platforms = [
      { x: 0, y: 449, w: 395, h: 28 }, { x: 480, y: 443, w: 370, h: 34 },
      { x: 930, y: 449, w: 390, h: 28 }, { x: 1400, y: 441, w: 385, h: 36 },
      { x: 1860, y: 449, w: 390, h: 28 }, { x: 2320, y: 445, w: 345, h: 32 },
      { x: 2730, y: 449, w: 330, h: 28 },
    ];
  },
  jumpPower() {
    const t = E2_BOUNCE_BALL.tuning;
    return Math.max(t.minJump, t.jump - this.state.jumps * t.jumpLoss);
  },
  action() {
    const s = this.state, t = E2_BOUNCE_BALL.tuning;
    if (!s.grounded) return;
    s.vy = -E2_BOUNCE_BALL.jumpPower.call(this);
    s.grounded = false; s.jumps++; this.actions++; this.sfx('jump');
    s.burst = 1;
    // 조각은 월드 좌표로 움직여 카메라나 리스폰을 따라 공에 달라붙지 않습니다.
    for (let i = 0; i < 5; i++) {
      const a = s.roll + s.jumps * 2.4 + i * 1.25;
      s.shards.push({ x: s.x + Math.cos(a) * t.radius, y: s.y + Math.sin(a) * t.radius,
        vx: Math.cos(a) * (65 + i * 14), vy: -90 - i * 23, age: 0, angle: a, spin: (i % 2 ? 1 : -1) * 7, size: 3 + i % 3 });
    }
  },
  update(dt) {
    const s = this.state, t = E2_BOUNCE_BALL.tuning, previous = s.y, wasGrounded = s.grounded, oldX = s.x;
    s.x = MINI.clamp(s.x + this.axis('left', 'right') * t.speed * dt, t.radius, 3030);
    s.roll += (s.x - oldX) / t.radius;
    s.squash = Math.max(0, s.squash - dt * 5); s.burst = Math.max(0, s.burst - dt * 4);
    for (const shard of s.shards) {
      shard.age += dt; shard.vy += 700 * dt; shard.x += shard.vx * dt; shard.y += shard.vy * dt; shard.angle += shard.spin * dt;
    }
    s.shards = s.shards.filter(shard => shard.age < .7).slice(-35);
    // W/S도 공중 위치 조정에 사용. 스페이스를 길게 눌러도 점프력은 변하지 않습니다.
    s.vy += (t.gravity + this.axis('up', 'down') * 420) * dt;
    s.y += s.vy * dt; s.grounded = false;
    for (const p of this.platforms) {
      if (s.vy >= 0 && s.x + t.radius - 2 > p.x && s.x - t.radius + 2 < p.x + p.w && previous + t.radius <= p.y + 1 && s.y + t.radius >= p.y) {
        s.y = p.y - t.radius; s.vy = 0; s.grounded = true;
        if (!wasGrounded) s.squash = 1;
        s.checkpoint = p.x + 50;
      }
    }
    if (s.y < 188 + t.radius || s.y > 535) {
      s.deaths++; s.x = s.checkpoint;
      const p = this.platforms.find(p => s.x >= p.x && s.x <= p.x + p.w);
      s.y = (p?.y ?? 449) - t.radius; s.vy = 0; s.grounded = true; MINI.summon(this); this.bump();
    }
    const power = E2_BOUNCE_BALL.jumpPower.call(this);
    this.anomaly = `다음 점프력 ${Math.round(power / t.jump * 100)}% · 껍질 파손 ${s.jumps}회 · 사망 ${s.deaths}회`;
    this.risk = (t.jump - power) / (t.jump - t.minJump) * 100;
    if (s.x >= t.goal && s.grounded) this.finish(true);
  },
  drawBall(x, y, pop) {
    const s = this.state, t = E2_BOUNCE_BALL.tuning, g = this.ballInk, r = t.radius;
    const textured = this.textures.exists('e2:player');
    const sx = pop * (1 + s.squash * .16 - s.burst * .08), sy = pop * (1 - s.squash * .14 + s.burst * .1);
    if (textured) MINI.actor(this, 'player', 'player', x, y, r * 2 * sx, r * 2 * sy, s.roll);
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(s.roll);
    g.scaleCanvas(sx, sy);
    if (!textured) {
      g.fillStyle(0x41685c).fillCircle(0, 0, r + 1);
      g.fillStyle(0x9be8ba).fillCircle(0, 0, r);
      g.fillStyle(0xd9ffe2, .65).fillEllipse(-6, -7, 19, 13);
      g.lineStyle(2, 0x5fb88d, .55).strokeCircle(0, 0, r - 2);
    }
    // 같은 균열이 누적되고 바깥 왁스가 떨어진 자리로 분홍색 속이 드러납니다.
    const order = [2, 7, 0, 5, 9, 3, 8, 1, 6, 4];
    for (let i = 0; i < Math.min(s.jumps, order.length); i++) {
      const a = order[i] * Math.PI / 5, edge = angle => ({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      const tip = { x: Math.cos(a + .05) * 7, y: Math.sin(a + .05) * 7 };
      if (i < s.jumps - 1) {
        g.fillStyle(0xf3a2bb).fillPoints([edge(a - .22), edge(a), edge(a + .22), tip], true);
        g.fillStyle(0xffd0de, .8).fillTriangle(tip.x, tip.y, Math.cos(a) * 16, Math.sin(a) * 16, Math.cos(a + .2) * 13, Math.sin(a + .2) * 13);
      }
      const rim = edge(a), bend = { x: Math.cos(a - .14) * 13, y: Math.sin(a - .14) * 13 };
      g.lineStyle(1.4, 0x43584f, .9).lineBetween(rim.x, rim.y, bend.x, bend.y).lineBetween(bend.x, bend.y, tip.x, tip.y);
    }
    if (!textured) {
      g.fillStyle(0x243b35).fillEllipse(-6, -2, 3, 5).fillEllipse(6, -2, 3, 5);
      g.fillStyle(0xef91a6, .65).fillEllipse(-11, 3, 5, 3).fillEllipse(11, 3, 5, 3);
      if (s.jumps < 4) g.lineStyle(1.5, 0x243b35).lineBetween(-3, 5, 0, 7).lineBetween(0, 7, 3, 5);
      else g.fillStyle(0x243b35).fillEllipse(0, 7, 5, 3);
    }
    g.restore();
  },
  render() {
    const s = this.state, cam = Math.max(0, s.x - 190);
    const t = E2_BOUNCE_BALL.tuning;
    MINI.frame(this, `다음 점프 ${Math.round(E2_BOUNCE_BALL.jumpPower.call(this) / t.jump * 100)}%    파손 ${s.jumps}회    CHECKPOINT ${Math.max(1, this.platforms.findIndex(p => s.checkpoint === p.x + 50) + 1)}`);
    this.ballInk.clear();
    for (let x = 22; x < 938; x += 24) MINI.spike(this, x, 153, 24, 35);
    for (const p of this.platforms) MINI.box(this, p.x - cam, p.y, p.w, p.h, 0x4f7560);
    const pop = MINI.spawnScale(this);
    for (const shard of s.shards) {
      const g = this.ballInk;
      g.save(); g.translateCanvas(shard.x - cam, shard.y); g.rotateCanvas(shard.angle);
      g.fillStyle(0xc8ffda, 1 - shard.age / .7).fillTriangle(-shard.size, -shard.size / 2, shard.size, 0, 0, shard.size); g.restore();
    }
    E2_BOUNCE_BALL.drawBall.call(this, s.x - cam, s.y, pop);
    MINI.spawnFx(this, s.x - cam, s.y, t.radius * 2);
    MINI.goal(this, E2_BOUNCE_BALL.tuning.goal - cam, 424);
    MINI.meter(this, s.x / E2_BOUNCE_BALL.tuning.goal);
  },
};
