import { MINI } from './minigame-kit.js';

/* 코스 좌표. 플레이어는 점프하지 않고 바닥 벽과 천장 벽 사이를 오갑니다. */
const FLOOR_TOP = 467;   // 바닥 벽의 윗면
const CEIL_BOTTOM = 174; // 천장 벽의 아랫면
const FLOOR_Y = 450;     // 바닥에 붙었을 때 플레이어 중심
const CEIL_Y = 189;      // 천장에 붙었을 때 플레이어 중심
const BLOCK = 34;        // 장애물 높이
const FLOAT_Y = 286;     // 떠 있는 장애물의 시작 높이
const GATE = 390;        // 장애물 묶음 사이 간격
const GATES = 10;

export const E1_GRAVITY_DASH = {
  // 약 16.3초 코스. 캐릭터는 약 0.39초에 벽을 옮기고 장애물은 더 늦게 따라옵니다.
  tuning: { speed: 285, distance: 4650, gravity: 3200, obstacleGravity: 620, obstacleMaxSpeed: 190 },
  build() {
    MINI.init(this, 0x67e8f9);
    this.state = { x: 0, y: FLOOR_Y, vy: 0, sign: 1, deaths: 0, immune: 0, obstacles: [] };
    // 가시도 블록과 같은 이동/충돌 경로를 사용합니다. 노란색과 빨간색은 플레이어를
    // 천천히 따라가고, 보라색은 반대쪽으로 움직여 반전 시점을 고민하게 합니다.
    this.hurdles = Array.from({ length: GATES }, (_, i) => ({
      x: 650 + i * GATE, y: i % 2 ? CEIL_BOTTOM : FLOOR_TOP - 24, w: 35, h: 24,
      vy: 0, factor: .8 + (i % 3) * .15, response: 1, spike: true,
    }));
    this.state.obstacles.push(...this.hurdles);
    for (let i = 0; i < GATES; i++) {
      const gate = 650 + i * GATE;
      // 플레이어보다 늦게 벽을 옮깁니다. 너무 일찍 뒤집으면 도착한 벽에서 다시 만납니다.
      this.state.obstacles.push({
        x: gate + 90, y: CEIL_BOTTOM, vy: 0, w: i % 3 === 0 ? 44 : 34, h: BLOCK,
        factor: .8 + (i % 4) * .15, response: 1, float: false,
      });
      // 기존 고정 공중 블록도 반전에 반응합니다. 반대 방향으로 움직이는 느린 장애물입니다.
      if (i < GATES - 1) this.state.obstacles.push({
        x: gate + 285, y: FLOAT_Y, vy: 0, w: BLOCK, h: BLOCK, factor: .7 + (i % 3) * .15, response: -1, float: true,
      });
    }
  },
  action() {
    const s = this.state;
    // 누를 때마다 중력이 통째로 뒤집힙니다. 플레이어는 반대쪽 벽으로 떨어져 붙고,
    // 모든 장애물도 각자의 방향과 느린 속도로 반전에 반응합니다.
    this.actions++; s.sign *= -1; s.vy = s.sign * 40;
    this.sfx('jump');
  },
  update(dt) {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt);
    s.vy += s.sign * t.gravity * dt; s.y = MINI.clamp(s.y + s.vy * dt, CEIL_Y, FLOOR_Y);
    if (s.y === CEIL_Y || s.y === FLOOR_Y) s.vy = 0;
    const player = { x: 165, y: s.y - 15, w: 30, h: 30 };
    const crash = () => {
      // 중력 방향은 그대로 두고 지금 끌리는 쪽 벽에서 다시 시작합니다. 장애물의 낙하 상태도 유지됩니다.
      s.deaths++; s.x = Math.max(0, s.x - 340); s.y = s.sign === 1 ? FLOOR_Y : CEIL_Y; s.vy = 0; s.immune = .8;
      MINI.summon(this); this.bump();
    };
    for (const o of s.obstacles) {
      const limit = Math.min(t.obstacleMaxSpeed, t.speed * .8);
      o.vy = MINI.clamp(o.vy + s.sign * o.response * t.obstacleGravity * o.factor * dt, -limit, limit);
      o.y = MINI.clamp(o.y + o.vy * dt, CEIL_BOTTOM, FLOOR_TOP - o.h);
      if ((o.y === CEIL_BOTTOM && o.vy < 0) || (o.y === FLOOR_TOP - o.h && o.vy > 0)) o.vy = 0;
    }
    // 충돌하더라도 그 프레임의 모든 장애물은 끝까지 움직입니다.
    if (!s.immune && s.obstacles.some(o => MINI.hit(player, { ...o, x: o.x - s.x + 180 }))) crash();
    this.anomaly = `중력 ${s.sign === 1 ? '↓ 바닥' : '↑ 천장'} · 충돌 ${s.deaths}회`;
    this.risk = Math.min(100, this.actions * 9);
    if (s.x >= t.distance) this.finish(true);
  },
  render() {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    MINI.frame(this, `GRAVITY ${s.sign === 1 ? '↓ 바닥' : '↑ 천장'}    ${Math.floor(100 * s.x / t.distance)}%`);
    // 천장 벽과 바닥 벽. 빗금은 진행 방향으로 흘러 속도감을 줍니다.
    MINI.box(this, 22, 156, 916, 18, 0x123a4c);
    MINI.box(this, 22, FLOOR_TOP, 916, 18, 0x123a4c);
    const shift = -(s.x % 40);
    for (let x = shift - 40; x < 960; x += 40) {
      MINI.line(this, x, 158, x + 12, 172, 0x1d5670, 3);
      MINI.line(this, x, FLOOR_TOP + 2, x + 12, FLOOR_TOP + 16, 0x1d5670, 3);
    }
    MINI.box(this, 22, 168, 916, 6, 0x2c6e85);
    MINI.box(this, 22, FLOOR_TOP, 916, 6, 0x2c6e85);
    // 지금 끌려가는 쪽 벽면을 강조해 반전 상태를 한눈에 보여 줍니다.
    MINI.box(this, 22, s.sign === 1 ? FLOOR_TOP : 168, 916, 6, this.accent, .95);
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i], x = o.x - s.x + 180, cx = x + o.w / 2, cy = o.y + o.h / 2;
      if (x <= -60 || x >= 1000) { MINI.hideActor(this, `o${i}`); continue; }
      if (o.spike) {
        const down = s.sign * o.response < 0;
        MINI.spike(this, x, down ? o.y : o.y + o.h, o.w, down ? o.h : -o.h, 0xffcf7b);
      } else if (o.float) {
        // 보라색은 플레이어의 반대 방향으로 이동합니다.
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, s.x / 55, 0xb98cff);
        this.ink.lineStyle(1, 0xd9c2ff, .45).strokeCircle(cx, cy, o.w * .95);
      } else {
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, 0, 0xff6584);
      }
      // 모든 장애물에 중력이 끌어당기는 방향을 표시합니다.
      const dir = s.sign * o.response;
      MINI.line(this, cx, cy + dir * 26, cx, cy + dir * 44, 0xffadb8);
      MINI.line(this, cx - 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
      MINI.line(this, cx + 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
    }
    const pop = MINI.spawnScale(this);
    if (!s.immune || Math.floor(s.immune * 16) % 2) MINI.actor(this, 'player', 'player', 180, s.y, 30 * pop, 30 * pop, -s.sign * s.x / 80);
    else MINI.hideActor(this, 'player');
    MINI.spawnFx(this, 180, s.y, 30);
    const goal = t.distance - s.x + 180;
    if (goal < 980) { MINI.box(this, goal - 4, CEIL_BOTTOM, 8, FLOOR_TOP - CEIL_BOTTOM, 0xa7ffc6, .3); MINI.goal(this, goal, 320); }
    MINI.meter(this, s.x / t.distance);
  },
};
