import { MINI } from './minigame-kit.js';

/* 코스 좌표. 플레이어는 점프하지 않고 바닥 벽과 천장 벽 사이를 오갑니다.
   통로 높이는 381 — 필드 세로 중심(320.5)을 기준으로 위아래 대칭이고, 남는 68씩이 벽입니다. */
const FLOOR_TOP = 511;   // 바닥 벽의 윗면
const CEIL_BOTTOM = 130; // 천장 벽의 아랫면
const FLOOR_Y = 494;     // 바닥에 붙었을 때 플레이어 중심
const CEIL_Y = 145;      // 천장에 붙었을 때 플레이어 중심
const BLOCK = 34;        // 장애물 높이
const FLOAT_Y = 276;     // 떠 있는 장애물의 시작 높이
const GATES = 10;
/* 맵이 흐르는 속도(px/s)입니다. 코스 길이와 장애물 간격을 모두 이 속도에 비례해 잡으므로,
   속도를 올리면 간격도 그만큼 벌어져 묶음 사이 시간(약 1.37초)과 코스 시간(약 16.3초)은 그대로입니다. */
const SPEED = 340;
const PACE = SPEED / 285;                  // 예전 기준 속도 285 대비 배율
const GATE = Math.round(390 * PACE);       // 장애물 묶음 사이 간격
const LEAD = Math.round(650 * PACE);       // 출발선에서 첫 묶음까지
const DISTANCE = Math.round(4650 * PACE);  // 골인 지점
const SPIKE_GAP = Math.round(38 * PACE);   // 한 묶음에 나란히 붙는 가시 두 개의 간격
const BLOCK_OFF = Math.round(90 * PACE);   // 묶음 안에서 블록이 서는 자리
const FLOAT_OFF = Math.round(285 * PACE);  // 묶음 안에서 공중 블록이 뜨는 자리
const SPIKES = GATES * 2;  // 가시 20개 — 게이트마다 두 개씩 나란히
const MAX_FLIPS = 25;      // risk 게이지가 100%에 닿는 반전 횟수. 이때 가시가 전부 풀립니다.
// 한 번에 풀리는 양은 앞에서 한 개, 뒤로 갈수록 여러 개. 합계는 SPIKES와 같습니다.
const RELEASE_STEPS = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
// 판정 간격을 두 반전에 한 번으로 벌려, 마지막 묶음이 MAX_FLIPS번째에 떨어지도록 뒤에서부터 맞춥니다.
const SPIKE_RELEASE = RELEASE_STEPS.flatMap((n, i) => Array(n).fill(MAX_FLIPS - (RELEASE_STEPS.length - 1 - i) * 2));

const HITBOX = 30;  // 판정 정사각형. 그림을 아무리 키워도 이 크기로만 부딪칩니다.
/* 캐릭터 그림(assets/images/minigame/geomatric dash)의 표시 높이입니다. 가로는 텍스처
   비율에서 뽑으므로 여기 없습니다. 원본이 자세마다 다르게 잘려 있어서, 머리 크기가
   같아 보이도록 자세별로 따로 맞춘 값입니다. 그림을 다시 그렸다면 여기부터 맞춥니다. */
const POSE_HEIGHT = { run: 78, jump: 88, hurt: 71, fall: 61 };
const GOAL_HEIGHT = 189;  // 골지점 표지의 표시 높이. 통로(381)의 절반입니다.
const GOAL_HOP = 16;      // 골지점 표지가 제자리에서 튀어오르는 높이.
const GOAL_HOPS = 1.2;    // 초당 튀는 횟수.
const SPAWN_FX = 52;      // 되살아날 때의 빛기둥 굵기. 달리기 그림 가로(약 59)에 맞춥니다.

export const E1_GRAVITY_DASH = {
  // 약 16.3초 코스. 캐릭터는 약 0.45초에 벽을 옮기고 장애물은 더 늦게 따라옵니다.
  // (통로가 381로 넓어져 건너는 거리가 261 → 349가 되었습니다. 중력은 그대로 둡니다.)
  tuning: { speed: SPEED, distance: DISTANCE, gravity: 3200, obstacleGravity: 620, obstacleMaxSpeed: 190 },
  build() {
    MINI.init(this, 0x67e8f9);
    this.state = { x: 0, y: FLOOR_Y, vy: 0, sign: 1, deaths: 0, immune: 0, failed: false, obstacles: [] };
    // 가시도 블록과 같은 이동/충돌 경로를 쓰지만 처음에는 모두 벽에 붙어 있습니다.
    // 반전을 거듭할수록 한 번에 더 많은 수가 풀려나고, MAX_FLIPS번째에는 전부 떨어집니다.
    this.hurdles = Array.from({ length: SPIKES }, (_, i) => {
      // 게이트마다 가시 두 개를 나란히 붙여 둡니다. 반전 리듬은 예전처럼 게이트 간격 그대로입니다.
      const gate = Math.floor(i / 2), wall = gate % 2 ? CEIL_BOTTOM : FLOOR_TOP - 24;
      return {
        x: LEAD + gate * GATE + (i % 2) * SPIKE_GAP, y: wall, w: 35, h: 24,
        vy: 0, factor: .8 + (i % 3) * .15, response: 1, spike: true,
        wall, loose: false, releaseAt: SPIKE_RELEASE[i],
      };
    });
    this.state.obstacles.push(...this.hurdles);
    for (let i = 0; i < GATES; i++) {
      const gate = LEAD + i * GATE;
      // 플레이어보다 늦게 벽을 옮깁니다. 너무 일찍 뒤집으면 도착한 벽에서 다시 만납니다.
      if (i % 2 === 0) this.state.obstacles.push({
        x: gate + BLOCK_OFF, y: CEIL_BOTTOM, vy: 0, w: i % 3 === 0 ? 44 : 34, h: BLOCK,
        factor: .8 + (i % 4) * .15, response: 1, float: false,
      });
      // 기존 고정 공중 블록도 반전에 반응합니다. 반대 방향으로 움직이는 느린 장애물입니다.
      if (i % 2 === 1 && i < GATES - 1) this.state.obstacles.push({
        x: gate + FLOAT_OFF, y: FLOAT_Y, vy: 0, w: BLOCK, h: BLOCK, factor: .7 + (i % 3) * .15, response: -1, float: true,
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
      // 붙어 있는 가시는 정해진 반전 횟수를 넘기기 전까지 자기 벽에 그대로 고정됩니다.
      if (o.spike && !o.loose) {
        if (this.actions < o.releaseAt) { o.y = o.wall; o.vy = 0; continue; }
        o.loose = true;
      }
      const limit = Math.min(t.obstacleMaxSpeed, t.speed * .8);
      o.vy = MINI.clamp(o.vy + s.sign * o.response * this.penalty(t.obstacleGravity) * o.factor * dt, -limit, limit);
      o.y = MINI.clamp(o.y + o.vy * dt, CEIL_BOTTOM, FLOOR_TOP - o.h);
      if ((o.y === CEIL_BOTTOM && o.vy < 0) || (o.y === FLOOR_TOP - o.h && o.vy > 0)) o.vy = 0;
    }
    // 충돌하더라도 그 프레임의 모든 장애물은 끝까지 움직입니다.
    if (!s.immune && s.obstacles.some(o => MINI.hit(player, { ...o, x: o.x - s.x + 180 }))) crash();
    this.anomaly = `중력 ${s.sign === 1 ? '↓ 바닥' : '↑ 천장'} · 충돌 ${s.deaths}회`;
    this.risk = Math.min(100, this.actions / MAX_FLIPS * 100);
    if (s.x >= t.distance) this.finish(true);
  },
  /* 시간이 다 되면 실패입니다. 판정이 끝난 뒤에도 render가 한 번 더 도니까,
     여기서 표시만 바꿔 두면 화면에 남는 마지막 그림이 주저앉은 자세가 됩니다. */
  timeout() { this.state.failed = true; return false; },
  /* 키에 묶인 이미지를 만들거나 다시 씁니다. 없는 텍스처면 null을 돌려줍니다. */
  sprite(key, texture) {
    if (!this.textures.exists(texture)) { this.assetSprites.get(key)?.setVisible(false); return null; }
    let sprite = this.assetSprites.get(key);
    if (!sprite) { sprite = this.add.image(0, 0, texture).setMask(this.ink.mask); this.assetSprites.set(key, sprite); }
    return sprite.setTexture(texture).setVisible(true);
  },
  /* 표시만 그림으로 바꾸고 판정 사각형은 그대로 둡니다. 발끝을 판정 사각형의 중력 쪽
     모서리에 맞추므로, 그림이 판정보다 커도 발은 지금 달리는 벽에 붙어 있습니다.
     천장을 달릴 때는 위아래로 뒤집어 발이 천장을 딛게 합니다(좌우는 그대로). */
  drawPlayer(pose, pop) {
    const s = this.state;
    const sprite = E1_GRAVITY_DASH.sprite.call(this, 'player', `e1:${pose}`);
    if (!sprite) { MINI.actor(this, 'player', 'player', 180, s.y, HITBOX * pop, HITBOX * pop, -s.sign * s.x / 80); return; }
    const height = POSE_HEIGHT[pose] * pop, feet = s.y + s.sign * HITBOX / 2;
    sprite.setPosition(180, feet - s.sign * height / 2).setFlipY(s.sign === -1).setDepth(2)
      .setDisplaySize(height * sprite.width / sprite.height, height);
  },
  render() {
    const s = this.state, t = E1_GRAVITY_DASH.tuning, f = MINI.FIELD;
    MINI.frame(this);
    // 천장 벽과 바닥 벽. 벽 속은 화면 끝까지 채운다 — 통로 밖은 벽이지 빈 자리가 아니다.
    MINI.box(this, f.x, f.y, f.w, CEIL_BOTTOM - f.y, 0x123a4c);
    MINI.box(this, f.x, FLOOR_TOP, f.w, f.bottom - FLOOR_TOP, 0x123a4c);
    // 빗금은 진행 방향으로 흘러 속도감을 줍니다.
    const shift = -(s.x % 40);
    for (let x = shift - 40; x < 960; x += 40) {
      MINI.line(this, x, CEIL_BOTTOM - 16, x + 12, CEIL_BOTTOM - 2, 0x1d5670, 3);
      MINI.line(this, x, FLOOR_TOP + 2, x + 12, FLOOR_TOP + 16, 0x1d5670, 3);
    }
    // 벽면 띠는 통로 안쪽으로 두께 6을 차지합니다. 통로 높이를 바꿔도 따라오도록 좌표에서 뽑습니다.
    MINI.box(this, f.x, CEIL_BOTTOM - 6, f.w, 6, 0x2c6e85);
    MINI.box(this, f.x, FLOOR_TOP, f.w, 6, 0x2c6e85);
    // 지금 끌려가는 쪽 벽면을 강조해 반전 상태를 한눈에 보여 줍니다.
    MINI.box(this, f.x, s.sign === 1 ? FLOOR_TOP : CEIL_BOTTOM - 6, f.w, 6, this.accent, .95);
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i], x = o.x - s.x + 180, cx = x + o.w / 2, cy = o.y + o.h / 2;
      if (x <= -60 || x >= 1000) { MINI.hideActor(this, `o${i}`); continue; }
      if (o.spike) {
        // 붙어 있는 가시는 자기 벽에서 통로 쪽을 향하고, 풀려난 뒤에야 중력을 따라 떨어집니다.
        const down = o.loose ? s.sign * o.response < 0 : o.wall === CEIL_BOTTOM;
        MINI.spike(this, x, down ? o.y : o.y + o.h, o.w, down ? o.h : -o.h, o.loose ? 0xffcf7b : 0xb08341);
      } else if (o.float) {
        // 보라색은 플레이어의 반대 방향으로 이동합니다.
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, s.x / 55, 0xb98cff);
        this.ink.lineStyle(1, 0xd9c2ff, .45).strokeCircle(cx, cy, o.w * .95);
      } else {
        MINI.actor(this, 'obstacle', `o${i}`, cx, cy, o.w, o.h, 0, 0xff6584);
      }
      // 붙어 있는 가시는 아직 움직이지 않으므로 방향 표시를 생략합니다.
      if (o.spike && !o.loose) continue;
      // 모든 장애물에 중력이 끌어당기는 방향을 표시합니다.
      const dir = s.sign * o.response;
      MINI.line(this, cx, cy + dir * 26, cx, cy + dir * 44, 0xffadb8);
      MINI.line(this, cx - 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
      MINI.line(this, cx + 5, cy + dir * 37, cx, cy + dir * 44, 0xffadb8);
    }
    // 자세는 상태를 그대로 읽습니다. 실패하면 주저앉고, 부딪친 뒤 무적인 동안은 아파하고,
    // 두 벽 어디에도 닿아 있지 않으면 중력에 끌려가는 중이라 점프, 나머지는 달리기입니다.
    const pop = s.failed ? 1 : MINI.spawnScale(this);
    const airborne = s.y !== CEIL_Y && s.y !== FLOOR_Y;
    const pose = s.failed ? 'fall' : s.immune ? 'hurt' : airborne ? 'jump' : 'run';
    if (s.failed || !s.immune || Math.floor(s.immune * 16) % 2) E1_GRAVITY_DASH.drawPlayer.call(this, pose, pop);
    else MINI.hideActor(this, 'player');
    if (!s.failed) MINI.spawnFx(this, 180, s.y, SPAWN_FX);
    const goal = t.distance - s.x + 180;
    if (goal < 980) {
      const banner = E1_GRAVITY_DASH.sprite.call(this, 'goal', 'e1:goal');
      // 표지는 제자리에서 통통 튑니다. 꼭대기에서 길쭉, 바닥에서 납작해지도록 가로세로를
      // 반대로 늘여 넓이를 지킵니다. 공통 게임 시간만 읽으므로 따로 타이머를 두지 않습니다.
      if (banner) {
        const hop = Math.abs(Math.sin(this.elapsed * Math.PI * GOAL_HOPS));
        const stretch = 1 + (hop - .5) * .08, ratio = banner.width / banner.height;
        banner.setPosition(goal, (CEIL_BOTTOM + FLOOR_TOP) / 2 - hop * GOAL_HOP).setDepth(1)
          .setDisplaySize(GOAL_HEIGHT * ratio / stretch, GOAL_HEIGHT * stretch);
      } else MINI.goal(this, goal, (CEIL_BOTTOM + FLOOR_TOP) / 2);
    } else MINI.hideActor(this, 'goal');
    MINI.meter(this, s.x / t.distance);
  },
};
