import { MINI } from './minigame-kit.js';

/* 그림(assets/minigames/manifest.js 의 e2)은 표시만 바꾼다. 판정은 예전 그대로
   공의 반지름 20과 발판 윗면 한 줄이라 여기 수치를 만져도 난이도는 달라지지 않는다. */
// 왁뿌볼 정사각 그림의 한 변 / 공 지름. 위로 솟은 매듭이 들어갈 만큼 여유를 둔 값이고,
// scripts/bake-wakppu.ps1 의 -BallPad 와 같아야 공이 판정 지름 그대로 그려진다.
const BALL_ART = 1.45;
// 파손 그림이 바뀌는 점프 횟수. 0~2회는 ball1, 3~5회는 ball2, 6~8회는 ball3, 9회부터 ball4다.
const BALL_STAGE = [0, 3, 6, 9];
// 밟은 발판이 출렁이는 시간과 첫 눌림에서 줄어드는 두께 비율. 말랑이 발판을 디딜 때의
// "디용" 하는 연출이고, 그림만 눌렀다 펴므로 판정선도 공의 운동도 그대로다.
// 부서지는 왁뿌바는 이미 갈라지는 그림이 따로 있어 걸지 않는다.
const WOBBLE_TIME = .4;
const WOBBLE_SQUASH = .18;

export const E2_BOUNCE_BALL = {
  tuning: { speed: 245, gravity: 1300, jump: 740, jumpDecay: .9, minJump: 300, radius: 20, goal: 3730,
    liftRange: 22, liftSpeed: 2.1, crumbleTime: .55, rebuildTime: 1.4 },
  build() {
    MINI.init(this, 0xb8f77b);
    this.state = { x: 90, y: 429, vy: 0, grounded: true, jumps: 0, deaths: 0, checkpoint: 90,
      roll: 0, squash: 0, burst: 0, shards: [], platformIndex: 0 };
    this.ballInk = this.add.graphics().setMask(this.ink.mask).setDepth(3);
    this.add.text(925, 137, '파랑: 승강 발판 · 주황: 밟으면 무너짐', {
      fontFamily: 'Arial', fontSize: '13px', color: '#cbdce4',
    }).setOrigin(1, 1);
    // 오르막/내리막 사이에 승강 발판과 착지 후 무너지는 발판을 섞습니다.
    this.platforms = [
      { x: 0, y: 449, w: 300, h: 28 }, { x: 410, y: 410, w: 170, h: 24 },
      { x: 690, y: 375, w: 130, h: 24, kind: 'lift' }, { x: 935, y: 413, w: 115, h: 24, kind: 'crumble' },
      { x: 1160, y: 380, w: 100, h: 24 }, { x: 1365, y: 417, w: 150, h: 24 },
      { x: 1580, y: 410, w: 135, h: 24, kind: 'lift', range: 10 }, { x: 1780, y: 430, w: 155, h: 24, kind: 'crumble' },
      { x: 2000, y: 416, w: 125, h: 24 }, { x: 2190, y: 438, w: 160, h: 24 },
      { x: 2415, y: 432, w: 130, h: 24, kind: 'lift', range: 10 }, { x: 2610, y: 444, w: 160, h: 24, kind: 'crumble' },
      // 높이는 고정하고 간격은 90px. 최소 점프력에서도 체공 보정 없이 끝에서 도약할 수 있습니다.
      { x: 2860, y: 424, w: 150, h: 24 }, { x: 3100, y: 404, w: 150, h: 24 },
      { x: 3340, y: 384, w: 150, h: 24 }, { x: 3580, y: 364, w: 240, h: 28 },
    ].map((p, index) => ({ ...p, index, baseY: p.y, previousY: p.y, active: true, crumbleLeft: null, rebuildLeft: 0,
      wobble: 0 }));
  },
  jumpPower() {
    const t = E2_BOUNCE_BALL.tuning;
    return Math.max(t.minJump, t.jump * (1 - this.penalty(1 - t.jumpDecay)) ** this.state.jumps);
  },
  action() {
    const s = this.state, t = E2_BOUNCE_BALL.tuning;
    if (!s.grounded) return;
    s.vy = -E2_BOUNCE_BALL.jumpPower.call(this);
    s.grounded = false; s.jumps++; this.actions++; this.sfx('sfxE2WaxJump');
    if (s.jumps === 2) this.sfx('sfxE2WaxCrack1');
    else if (s.jumps === 4) this.sfx('sfxE2WaxCrack2');
    s.burst = 1;
    // 조각은 월드 좌표로 움직여 카메라나 리스폰을 따라 공에 달라붙지 않습니다.
    for (let i = 0; i < 5; i++) {
      const a = s.roll + s.jumps * 2.4 + i * 1.25;
      s.shards.push({ x: s.x + Math.cos(a) * t.radius, y: s.y + Math.sin(a) * t.radius,
        vx: Math.cos(a) * (65 + i * 14), vy: -90 - i * 23, age: 0, angle: a, spin: (i % 2 ? 1 : -1) * 7, size: 3 + i % 3 });
    }
  },
  update(dt) {
    const s = this.state, t = E2_BOUNCE_BALL.tuning, wasGrounded = s.grounded, oldX = s.x;
    for (const p of this.platforms) {
      p.previousY = p.y;
      // 출렁임은 그림에만 쓰는 값입니다. 일시정지 중에는 update가 돌지 않아 함께 멈춥니다.
      p.wobble = Math.max(0, p.wobble - dt);
      if (p.kind === 'lift') p.y = p.baseY + (p.range ?? t.liftRange) * Math.sin(this.elapsed * t.liftSpeed + p.index);
      if (!p.active) {
        p.rebuildLeft = Math.max(0, p.rebuildLeft - dt);
        if (p.rebuildLeft === 0) { p.active = true; p.crumbleLeft = null; }
      } else if (p.crumbleLeft !== null) {
        p.crumbleLeft = Math.max(0, p.crumbleLeft - dt);
        if (p.crumbleLeft === 0) {
          p.active = false; p.rebuildLeft = t.rebuildTime;
          this.sfx('sfxE2WaxDrop');
        }
      }
    }
    const support = this.platforms[s.platformIndex];
    if (wasGrounded && support?.active) s.y += support.y - support.previousY;
    const previous = s.y;
    const lastPlatform = this.platforms[this.platforms.length - 1];
    s.x = MINI.clamp(s.x + this.axis('left', 'right') * t.speed * dt, t.radius, lastPlatform.x + lastPlatform.w - t.radius);
    s.roll += (s.x - oldX) / t.radius;
    s.squash = Math.max(0, s.squash - dt * 5); s.burst = Math.max(0, s.burst - dt * 4);
    for (const shard of s.shards) {
      shard.age += dt; shard.vy += 700 * dt; shard.x += shard.vx * dt; shard.y += shard.vy * dt; shard.angle += shard.spin * dt;
    }
    s.shards = s.shards.filter(shard => shard.age < .7).slice(-35);
    // 공중 보정 없이 점프 순간의 힘과 중력만으로 궤적이 결정됩니다.
    s.vy += t.gravity * dt;
    s.y += s.vy * dt; s.grounded = false;
    for (const p of this.platforms) {
      const previousTop = wasGrounded && p === support ? p.y : p.previousY;
      if (p.active && s.vy >= (p.y - previousTop) / dt && s.x + t.radius - 2 > p.x && s.x - t.radius + 2 < p.x + p.w && previous + t.radius <= previousTop + 1 && s.y + t.radius >= p.y) {
        s.y = p.y - t.radius; s.vy = 0; s.grounded = true;
        // 밟은 발판 그림을 출렁이게 합니다. 공의 위치·속도는 위에서 이미 정해졌고
        // 이 값은 render만 읽으므로 궤적에는 아무 영향이 없습니다.
        if (!wasGrounded) { s.squash = 1; if (p.kind !== 'crumble') p.wobble = WOBBLE_TIME; }
        s.platformIndex = p.index;
        if (p.kind === 'crumble') {
          if (p.crumbleLeft === null) p.crumbleLeft = t.crumbleTime;
        } else s.checkpoint = p.x + 50;
      }
    }
    // 천장은 열려 있습니다. 높이 뛰면 카메라만 따라가고, 추락했을 때만 체크포인트로 돌아갑니다.
    if (s.y > 535) {
      s.deaths++; s.x = s.checkpoint;
      const p = this.platforms.find(p => s.x >= p.x && s.x <= p.x + p.w);
      s.platformIndex = p?.index ?? 0;
      s.y = (p?.y ?? 449) - t.radius; s.vy = 0; s.grounded = true; MINI.summon(this); this.bump();
    }
    const power = E2_BOUNCE_BALL.jumpPower.call(this);
    this.anomaly = `다음 점프력 ${Math.round(power / t.jump * 100)}% · 껍질 파손 ${s.jumps}회 · 사망 ${s.deaths}회`;
    this.risk = (t.jump - power) / (t.jump - t.minJump) * 100;
    if (s.x >= t.goal && s.grounded) this.finish(true);
  },
  /* 키에 묶인 이미지를 만들거나 다시 씁니다. 없는 텍스처면 null을 돌려줍니다. */
  sprite(key, texture) {
    if (!this.textures.exists(texture)) { this.assetSprites.get(key)?.setVisible(false); return null; }
    let sprite = this.assetSprites.get(key);
    if (!sprite) { sprite = this.add.image(0, 0, texture).setMask(this.ink.mask); this.assetSprites.set(key, sprite); }
    return sprite.setTexture(texture).setVisible(true);
  },
  /* 발판 그림은 폭을 발판에 맞추고 윗면을 판정선(p.y)에 겁니다. 아래로 얼마나 두껍게
     그려지든 충돌은 예전 그대로 윗면 한 줄이라 난이도는 달라지지 않습니다.
     윗면이 둥근 호빵만 조금 파묻어야 공이 표면에 닿아 보입니다.
     그림이 없으면 false를 돌려주고 예전 도형으로 그립니다. */
  drawPlatform(p, x, y) {
    const role = p.kind === 'lift' ? (p.w >= 135 ? 'liftWide' : 'liftNarrow')
      : p.kind === 'crumble' ? (p.crumbleLeft === null ? 'crumble' : 'crumbleSplit')
      : p.w >= 240 ? 'platformLong' : p.w >= 150 ? 'platformMedium' : 'platformShort';
    const sprite = E2_BOUNCE_BALL.sprite.call(this, `p${p.index}`, `e2:${role}`);
    if (!sprite) return false;
    const h = p.w * sprite.height / sprite.width, sink = p.kind === 'lift' ? .2 : .06;
    // 밟은 뒤 WOBBLE_TIME 동안 두께가 줄었다 늘기를 두 바퀴 반 되풀이하며 잦아듭니다.
    // 윗면은 판정선에 붙여 둔 채 아랫면만 오르내리므로 공은 언제나 발판 표면에 닿아 보이고,
    // 옆으로 부푸는 폭은 착지할 수 있는 자리를 넘겨짚지 않게 눌린 만큼의 1/4로 둡니다.
    const left = p.wobble / WOBBLE_TIME;
    const press = left > 0 ? Math.cos((1 - left) * Math.PI * 5) * left * left * WOBBLE_SQUASH : 0;
    sprite.setPosition(x + p.w / 2, y + h * (1 - press) / 2 - h * sink)
      .setDisplaySize(p.w * (1 + press * .25), h * (1 - press));
    return true;
  },
  drawBall(x, y, pop) {
    const s = this.state, t = E2_BOUNCE_BALL.tuning, g = this.ballInk, r = t.radius;
    const sx = pop * (1 + s.squash * .16 - s.burst * .08), sy = pop * (1 - s.squash * .14 + s.burst * .1);
    // 그림이 있으면 파손 단계를 넉 장이 대신하므로 아래의 도형과 균열은 그리지 않습니다.
    const stage = BALL_STAGE.filter(jumps => s.jumps >= jumps).length;
    if (this.textures.exists(`e2:ball${stage}`)) {
      MINI.actor(this, `ball${stage}`, 'player', x, y, r * 2 * BALL_ART * sx, r * 2 * BALL_ART * sy, s.roll);
      // 발판 그림은 화면에 들어올 때마다 새로 생겨 공보다 나중에 그려집니다. 한 층 위에 세워
      // 어느 발판에 올라서도 공이 가려지지 않게 합니다(균열·조각을 그리는 ballInk는 3층).
      this.assetSprites.get('player')?.setDepth(2);
      return;
    }
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(s.roll);
    g.scaleCanvas(sx, sy);
    g.fillStyle(0x41685c).fillCircle(0, 0, r + 1);
    g.fillStyle(0x9be8ba).fillCircle(0, 0, r);
    g.fillStyle(0xd9ffe2, .65).fillEllipse(-6, -7, 19, 13);
    g.lineStyle(2, 0x5fb88d, .55).strokeCircle(0, 0, r - 2);
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
    g.fillStyle(0x243b35).fillEllipse(-6, -2, 3, 5).fillEllipse(6, -2, 3, 5);
    g.fillStyle(0xef91a6, .65).fillEllipse(-11, 3, 5, 3).fillEllipse(11, 3, 5, 3);
    if (s.jumps < 4) g.lineStyle(1.5, 0x243b35).lineBetween(-3, 5, 0, 7).lineBetween(0, 7, 3, 5);
    else g.fillStyle(0x243b35).fillEllipse(0, 7, 5, 3);
    g.restore();
  },
  render() {
    const s = this.state, cam = Math.max(0, s.x - 190), camY = Math.min(0, s.y - 205);
    const t = E2_BOUNCE_BALL.tuning;
    MINI.frame(this, `다음 점프 ${Math.round(E2_BOUNCE_BALL.jumpPower.call(this) / t.jump * 100)}%    파손 ${s.jumps}회    CHECKPOINT ${Math.max(1, this.platforms.findIndex(p => s.checkpoint === p.x + 50) + 1)}`);
    this.ballInk.clear();
    for (const p of this.platforms) {
      const x = p.x - cam, y = p.y - camY;
      // 화면 밖이거나 무너진 발판은 그림도 함께 감춥니다.
      if (x + p.w < 20 || x > 940 || !p.active) MINI.hideActor(this, `p${p.index}`);
      if (x + p.w < 20 || x > 940) continue;
      const color = p.kind === 'lift' ? 0x65d8ef : p.kind === 'crumble' ? 0xffbd77 : 0xb8f77b;
      if (p.kind === 'lift') {
        const range = p.range ?? t.liftRange;
        MINI.line(this, x + p.w / 2, p.baseY - range - camY, x + p.w / 2, p.baseY + range + p.h - camY, 0x397186, 3);
      }
      if (!p.active) {
        this.ink.lineStyle(1, color, .3).strokeRect(x, y, p.w, p.h);
        MINI.box(this, x, y + p.h + 5, p.w * (1 - p.rebuildLeft / t.rebuildTime), 3, color, .5);
        continue;
      }
      if (!E2_BOUNCE_BALL.drawPlatform.call(this, p, x, y)) {
        MINI.box(this, x, y, p.w, p.h, p.kind === 'lift' ? 0x28576b : p.kind === 'crumble' ? 0x866044 : 0x4f7560);
        MINI.line(this, x + 4, y + 2, x + p.w - 4, y + 2, color, 3);
        if (p.kind === 'crumble') for (let offset = 18; offset < p.w; offset += 26) {
          MINI.line(this, x + offset, y + 4, x + offset - 5, y + 12, 0x392f32, 2);
          MINI.line(this, x + offset - 5, y + 12, x + offset + 3, y + p.h, 0x392f32, 2);
        }
      }
      // 무너지기까지 남은 시간은 그림이 있든 없든 발판 위에 붉은 막대로 알립니다.
      if (p.kind === 'crumble' && p.crumbleLeft !== null) MINI.box(this, x, y - 7, p.w * p.crumbleLeft / t.crumbleTime, 3, 0xff6e6e);
    }
    const pop = MINI.spawnScale(this);
    for (const shard of s.shards) {
      const g = this.ballInk;
      g.save(); g.translateCanvas(shard.x - cam, shard.y - camY); g.rotateCanvas(shard.angle);
      g.fillStyle(0xc8ffda, 1 - shard.age / .7).fillTriangle(-shard.size, -shard.size / 2, shard.size, 0, 0, shard.size); g.restore();
    }
    E2_BOUNCE_BALL.drawBall.call(this, s.x - cam, s.y - camY, pop);
    MINI.spawnFx(this, s.x - cam, s.y - camY, t.radius * 2);
    MINI.goal(this, E2_BOUNCE_BALL.tuning.goal - cam, this.platforms[this.platforms.length - 1].y - t.radius - camY);
    MINI.meter(this, s.x / E2_BOUNCE_BALL.tuning.goal);
  },
};
