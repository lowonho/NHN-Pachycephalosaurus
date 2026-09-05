import { MINI } from './minigame-kit.js';

export const E1_GRAVITY_DASH = {
  // 난이도: 약 16.3초 코스. 장애물은 각각 다른 가속도로 중력에 반응합니다.
  tuning: { speed: 285, distance: 4650, jump: 465, gravity: 1250, obstacleGravity: 270 },
  build() {
    MINI.init(this, 0x67e8f9);
    this.state = { x: 0, y: 450, vy: 0, sign: 1, deaths: 0, immune: 0, obstacles: [] };
    for (let i = 0; i < 17; i++) this.state.obstacles.push({
      x: 520 + i * 245, y: i % 3 === 1 ? 250 : 441, vy: 0,
      w: i % 4 === 0 ? 46 : 32, h: 34, factor: .65 + (i % 4) * .32,
    });
    this.hurdles = Array.from({ length: 6 }, (_, i) => ({ x: 860 + i * 650, y: 443, w: 35, h: 24 }));
  },
  action() {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    // 공중에서도 키를 누르면 장애물의 중력은 뒤집힙니다. 플레이어는 착지 후 점프.
    this.actions++; s.sign *= -1;
    if (s.y >= 449) s.vy = -t.jump;
    this.sfx('jump');
  },
  update(dt) {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt);
    s.vy += t.gravity * dt; s.y = Math.min(450, s.y + s.vy * dt);
    if (s.y === 450) s.vy = 0;
    for (const o of s.obstacles) {
      o.vy += s.sign * this.penalty(t.obstacleGravity) * o.factor * dt;
      o.vy = MINI.clamp(o.vy, -340, 340); o.y += o.vy * dt;
      if (o.y < 173 || o.y > 441) { o.y = MINI.clamp(o.y, 173, 441); o.vy = 0; }
      if (!s.immune && MINI.hit({ x: 165, y: s.y - 15, w: 30, h: 30 }, { ...o, x: o.x - s.x + 180 })) {
        s.deaths++; s.x = Math.max(0, s.x - 340); s.y = 450; s.vy = 0; s.immune = .8;
        MINI.summon(this); this.bump(); break;
      }
    }
    if (!s.immune && this.hurdles.some(o => MINI.hit({ x: 165, y: s.y - 15, w: 30, h: 30 }, { ...o, x: o.x - s.x + 180 }))) {
      s.deaths++; s.x = Math.max(0, s.x - 340); s.y = 450; s.vy = 0; s.immune = .8; MINI.summon(this); this.bump();
    }
    this.anomaly = `장애물 중력 ${s.sign === 1 ? '↓' : '↑'} · 충돌 ${s.deaths}회`;
    this.risk = Math.min(100, this.actions * 7);
    if (s.x >= t.distance) this.finish(true);
  },
  render() {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    MINI.frame(this, `GRAVITY ${s.sign === 1 ? '↓' : '↑'}    ${Math.floor(100 * s.x / t.distance)}%`);
    MINI.box(this, 22, 467, 916, 10, 0x2c6e85);
    for (const h of this.hurdles) {
      const x = h.x - s.x + 180;
      if (x > -50 && x < 980) MINI.spike(this, x, 467, h.w, -h.h, 0xffcf7b);
    }
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i], x = o.x - s.x + 180;
      if (x > -60 && x < 1000) {
        MINI.actor(this, 'obstacle', `o${i}`, x + o.w / 2, o.y + o.h / 2, o.w, o.h, 0, 0xff6584);
        MINI.line(this, x + o.w / 2, o.y - 8, x + o.w / 2, o.y - 8 - s.sign * 18, 0xffadb8);
      } else MINI.hideActor(this, `o${i}`);
    }
    const pop = MINI.spawnScale(this);
    if (!s.immune || Math.floor(s.immune * 16) % 2) MINI.actor(this, 'player', 'player', 180, s.y, 30 * pop, 30 * pop, -s.x / 80);
    else MINI.hideActor(this, 'player');
    MINI.spawnFx(this, 180, s.y, 30);
    const goal = t.distance - s.x + 180; if (goal < 950) MINI.goal(this, goal, 433);
    MINI.meter(this, s.x / t.distance);
  },
};
