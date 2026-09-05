import { MINI } from './minigame-kit.js';

/* 코스 좌표. 플레이어는 점프하지 않고 바닥 벽과 천장 벽 사이를 오갑니다. */
const FLOOR_TOP = 467;   // 바닥 벽의 윗면
const CEIL_BOTTOM = 174; // 천장 벽의 아랫면
const FLOOR_Y = 450;     // 바닥에 붙었을 때 플레이어 중심
const CEIL_Y = 189;      // 천장에 붙었을 때 플레이어 중심
const BLOCK = 34;        // 장애물 높이
const FLOAT_Y = 286;     // 떠 있는 장애물의 고정 높이(통로 한가운데)
const GATE = 500;        // 가시 사이 간격
const GATES = 8;

export const E1_GRAVITY_DASH = {
  // 난이도: 약 16.3초 코스. 반전은 약 0.39초(112px)가 걸리므로 가시 앞에서 미리 눌러야 합니다.
  tuning: { speed: 285, distance: 4650, gravity: 3200, obstacleGravity: 900 },
  build() {
    MINI.init(this, 0x67e8f9);
    this.state = { x: 0, y: FLOOR_Y, vy: 0, sign: 1, deaths: 0, immune: 0, obstacles: [] };
    // 가시는 바닥과 천장에 번갈아 놓여 구간마다 반드시 한 번 반전하게 만듭니다.
    this.hurdles = Array.from({ length: GATES }, (_, i) => ({
      x: 700 + i * GATE, y: i % 2 ? CEIL_BOTTOM : FLOOR_TOP - 24, w: 35, h: 24, ceiling: i % 2 === 1,
    }));
    for (let i = 0; i < GATES; i++) {
      const gate = 700 + i * GATE;
      // 벽에 붙어 있는 장애물. 반전하면 떨어져서 반대쪽 벽으로 이동합니다.
      // 중력이 아래일 때 천장에, 위일 때 바닥에 붙으므로 언제나 플레이어의 반대쪽 벽에 있습니다.
      this.state.obstacles.push({
        x: gate + 55, y: CEIL_BOTTOM, vy: 0, w: i % 3 === 0 ? 44 : 34, h: BLOCK,
        factor: .8 + (i % 4) * .3, float: false,
      });
      // 처음부터 통로 한가운데 떠 있는 장애물. 반전에 반응하지 않고 제자리를 지킵니다.
      // 벽에 붙어 지나가면 안전하지만 반전 중에 닿으면 죽으므로 "여기서는 못 뒤집는다"는 표시가 됩니다.
      if (i < GATES - 1) this.state.obstacles.push({
        x: gate + 420, y: FLOAT_Y, vy: 0, w: BLOCK, h: BLOCK, factor: 0, float: true,
      });
    }
  },
  action() {
    const s = this.state;
    // 누를 때마다 중력이 통째로 뒤집힙니다. 플레이어는 반대쪽 벽으로 떨어져 붙고,
    // 벽에 붙어 있던 장애물도 같이 떨어져 서로 자리를 바꿉니다.
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
      if (!o.float) {
        const rest = s.sign === 1 ? CEIL_BOTTOM : FLOOR_TOP - o.h;
        o.vy += -s.sign * t.obstacleGravity * o.factor * dt;
        o.vy = MINI.clamp(o.vy, -340, 340);
        o.y = MINI.clamp(o.y + o.vy * dt, CEIL_BOTTOM, FLOOR_TOP - o.h);
        if (o.y === rest) o.vy = 0;
      }
      if (!s.immune && MINI.hit(player, { ...o, x: o.x - s.x + 180 })) { crash(); break; }
    }
    if (!s.immune && this.hurdles.some(h => MINI.hit(player, { ...h, x: h.x - s.x + 180 }))) crash();
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
    for (const h of this.hurdles) {
      const x = h.x - s.x + 180;
      if (x > -50 && x < 980) MINI.spike(this, x, h.ceiling ? CEIL_BOTTOM : FLOOR_TOP, h.w, h.ceiling ? h.h : -h.h, 0xffcf7b);
    }
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i], x = o.x - s.x + 180, cx = x + o.w / 2, cy = o.y + o.h / 2;
      if (x <= -60 || x >= 1000) { MINI.hideActor(this, `o${i}`); continue; }
      if (o.float) {
        // 떠 있는 장애물: 회전하는 보라색 블록과 고정 표시용 링.
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, s.x / 55, 0xb98cff);
        this.ink.lineStyle(1, 0xd9c2ff, .45).strokeCircle(cx, cy, o.w * .95);
      } else {
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, 0, 0xff6584);
        // 낙하 방향 화살표. 중력이 뒤집히면 이 장애물도 반대쪽으로 떨어집니다.
        const dir = -s.sign;
        MINI.line(this, cx, cy + dir * 26, cx, cy + dir * 44, 0xffadb8);
        MINI.line(this, cx - 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
        MINI.line(this, cx + 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
      }
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
