import { MINI } from './minigame-kit.js';

/*
 * 장애물은 그림이 아니라 글자다. 밈 문장을 한 글자씩 세로로 세워 통로를 막는 기둥으로 쓰고,
 * 글꼴은 css/tokens.css의 @font-face(YeogiOttaeJalnan)가 물어 온다. 밈을 바꾸려면 MEME.sets만
 * 고치면 되고, 기둥 높이·판정 폭은 실제로 그려진 글자 크기에서 뽑으므로 따로 맞출 값이 없다.
 *
 * 장애물은 처음에 모두 만들어 두지 않는다. 쿠키런처럼 캐릭터가 tuning.spawnAhead 안으로
 * 들어온 것만 그때 태어나고(화면 오른쪽 바깥이라 갑자기 튀어나오지 않는다) 지나간 것은 지운다.
 * scene.gates에는 살아 있는 장애물만 있고, 각 항목의 y는 그 기둥을 비켜 지나가는 지점이다
 * — 충돌 후 되돌아갈 자리이자 조준 목표로 함께 쓴다.
 */
/* 밈은 낱말이 아니라 세트로 나온다. '여러분 → 저됐어요 → 뭣됐어요'는 한 호흡이라 순서가 붙어 있고,
   '샤갈!'과 '야르~'는 한 마디씩 서는 세트다. 어느 세트가 올지는 무작위지만, 한 번 나온 세트는
   나머지가 다 나오기 전에는 다시 뽑히지 않는다(같은 세트가 연달아 서면 길이 단조로워진다). */
const MEME = {
  family: '"YeogiOttaeJalnan", "NeoDunggeunGothicPro", "Galmuri11", sans-serif',
  sets: [['여러분', '저됐어요', '뭣됐어요'], ['샤갈!'], ['야르~']],
  color: '#fff3d6', stroke: '#07141d',
};
MEME.words = MEME.sets.flat();

/* 다음 기둥에 세울 글자. 뽑아 둔 세트를 순서대로 흘리고, 다 쓰면 남은 세트 중에서 새로 고른다. */
function nextMeme(scene) {
  if (!scene.memeQueue?.length) {
    if (!scene.memeBag?.length) {
      scene.memeBag = MEME.sets.map((_, i) => i);
      for (let i = scene.memeBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scene.memeBag[i], scene.memeBag[j]] = [scene.memeBag[j], scene.memeBag[i]];
      }
    }
    scene.memeQueue = MEME.sets[scene.memeBag.pop()].slice();
  }
  return scene.memeQueue.shift();
}

/* 위아래 벽 사이의 통로. 판정과 그림이 같은 값을 본다.
   필드 세로 중심(320.5)을 기준으로 위아래 대칭이고, 남는 68씩이 벽이다 — e1 중력 대쉬와 같은 통로다.
   고양이 그림 전체가 판정이 된 뒤로 좁은 통로는 너무 빡빡했다. */
const TUNNEL = { top: 130, bottom: 511, height: 381 };
/* 부딪힌 뒤 되돌아가 서는 자리가 벽에서 떨어져 있어야 하는 거리. 고양이 반 키(24)보다 넉넉하다. */
const RESPAWN_MARGIN = 52;

/* 캐릭터는 도는 고양이(oiia)다. 스페이스를 누르고 있는 동안에만 spin1→spin6 을 돌리고,
   손을 떼면 spin1 에 멈춘다 — 상승 중인지 떨어지는 중인지가 그림 하나로 읽힌다.
   그림은 assets/images/minigame/geomatric fly 의 여섯 장이고 manifest.js 가 e6:spin1…6 으로
   물어 온다. 원본 시트에서 굽는 일은 scripts/bake-oiia-cat.ps1 이 한다. */
const SPIN = {
  frames: 6,
  fps: 20,       // 초당 프레임. 여섯 장이라 한 바퀴에 0.3초 — 밈의 속도다.
  height: 48,    // 표시 높이. 가로는 텍스처 비율에서 뽑고, 판정 상자도 이 크기 그대로다.
};

/* 판정 상자는 그려지는 고양이 그림 그대로다 — 그림 끝이 벽이나 글자 기둥에 닿는 순간 실패다.
   예전에는 그림과 상관없는 26×30 사각형이라 고양이가 벽에 절반쯤 파묻혀도 통과했다.
   여섯 장을 같은 사각형으로 잘라 구웠으므로 어느 프레임이든 크기가 같다(bake-oiia-cat.ps1).
   그림이 없을 때만 예전 도형 크기(36×28)로 돌아간다. */
function catBox(scene) {
  const image = scene.textures.exists('e6:spin1') ? scene.textures.get('e6:spin1').getSourceImage() : null;
  const height = image ? SPIN.height : 28;
  const width = image ? SPIN.height * image.width / image.height : 36;
  return { halfWidth: width / 2, halfHeight: height / 2 };
}

/* 밈 글꼴은 웹에서 받아 온다. 아직 오기 전에 만든 글자는 대체 글꼴 크기로 재어 두므로,
   도착하면 살아 있는 장애물을 모두 다시 재서 그림과 판정을 맞춘다. */
function loadMemeFont(scene) {
  const fonts = globalThis.document?.fonts;
  if (!fonts?.load) return;
  const spec = `${E6_GRAVITY_FLIGHT.tuning.cell}px "YeogiOttaeJalnan"`;
  if (fonts.check?.(spec)) return;
  fonts.load(spec).catch(() => {}).then(() => {
    if (scene.stageId !== 'e6') return;
    for (const gate of scene.gates ?? []) fitGate(gate);
  });
}

/* 글자 기둥의 높이·폭·붙는 벽을 정한다. 긴 밈은 통로를 다 막지 않도록 tuning.minGap만큼 비운다. */
function fitGate(gate) {
  const t = E6_GRAVITY_FLIGHT.tuning;
  const height = Math.min(t.cell * gate.word.length, TUNNEL.height - t.minGap);
  const scale = height / (gate.label.height || height);
  gate.label.setScale(scale);
  gate.halfWidth = gate.label.width * scale / 2;
  gate.top = gate.side === 'top' ? TUNNEL.top : TUNNEL.bottom - height;
  gate.bottom = gate.top + height;
  // 조준선은 통로 한가운데 — 기둥에 막히는 만큼만 비켜난다. 벽에 딱 붙는 길보다 사람이 실제로 나는 길이다.
  const centre = (TUNNEL.top + TUNNEL.bottom) / 2;
  gate.y = gate.side === 'top' ? Math.max(centre, gate.bottom + t.aimMargin) : Math.min(centre, gate.top - t.aimMargin);
}

/* 캐릭터가 다가온 만큼만 새 장애물을 만들고, 뒤로 흘려보낸 장애물은 글자까지 지운다. */
function syncGates(scene) {
  const t = E6_GRAVITY_FLIGHT.tuning, x = scene.state.x;
  while (scene.nextGate.x <= x + t.spawnAhead && scene.nextGate.x <= t.distance - t.spawnStop) {
    const index = scene.nextGate.index, word = nextMeme(scene);
    const gate = { x: scene.nextGate.x, word, side: index % 2 ? 'top' : 'bottom', bornAt: scene.elapsed };
    gate.label = scene.add.text(0, 0, word.split('').join('\n'), {
      fontFamily: MEME.family, fontSize: `${t.cell}px`, color: MEME.color,
      align: 'center', stroke: MEME.stroke, strokeThickness: 5,
    }).setOrigin(.5, 0).setMask(scene.ink.mask).setDepth(4);
    fitGate(gate); scene.gates.push(gate);
    scene.nextGate = { x: scene.nextGate.x + t.spacing, index: index + 1 };
  }
  for (let i = scene.gates.length - 1; i >= 0; i--) {
    if (scene.gates[i].x >= x - t.despawnBehind) continue;
    scene.gates[i].label.destroy(); scene.gates.splice(i, 1);
  }
}

export const E6_GRAVITY_FLIGHT = {
  words: MEME.words, sets: MEME.sets, tunnel: TUNNEL,
  tuning: {
    speed: 255, distance: 4200, gravity: 640, gravityLoss: 35, minGravity: 240,
    lift: 570, liftGain: 24, maxLift: 850, knockback: 245,
    cell: 42, minGap: 152, aimMargin: 52, spacing: 355, firstX: 500,
    spawnAhead: 880, spawnStop: 140, despawnBehind: 420, fadeIn: .3,
  },
  build() {
    MINI.init(this, 0x7cd9ff);
    // spin 은 누르고 있는 동안 쌓이는 프레임 수(정수부가 곧 지금 프레임)다. 손을 떼면 0으로 돌아간다.
    this.state = { x: 0, y: (TUNNEL.top + TUNNEL.bottom) / 2, vy: 0, presses: 0, hits: 0, immune: 0, spin: 0 };
    this.catBox = catBox(this);
    this.gates = []; this.nextGate = { x: E6_GRAVITY_FLIGHT.tuning.firstX, index: 0 };
    this.memeQueue = []; this.memeBag = [];
    loadMemeFont(this); syncGates(this);
  },
  dispose() { for (const gate of this.gates ?? []) gate.label?.destroy(); this.gates = []; },
  /* 지금 프레임의 고양이를 그린다. 그림이 없으면 예전 도형으로 돌아가므로 에셋이 빠져도 게임은 돈다.
     표시 크기만 그림에서 뽑고 판정(s.y ± 13)은 그대로다 — 그림을 키워도 부딪히는 범위는 같다. */
  drawCat(pop) {
    const s = this.state;
    const texture = `e6:spin${Math.floor(s.spin) + 1}`;
    // 소환 연출 앞부분(pop 0)에는 MINI.actor 가 스프라이트를 감춰 준다.
    if (!(pop > 0) || !this.textures.exists(texture)) {
      MINI.actor(this, 'player', 'player', 180, s.y, 36 * pop, 28 * pop, s.vy / 900);
      return;
    }
    let sprite = this.assetSprites.get('player');
    if (!sprite) { sprite = this.add.image(0, 0, texture).setMask(this.ink.mask).setDepth(2); this.assetSprites.set('player', sprite); }
    const height = SPIN.height * pop;
    sprite.setTexture(texture).setVisible(true).setPosition(180, s.y).setRotation(s.vy / 900)
      .setDisplaySize(height * sprite.width / sprite.height, height);
  },
  action() { this.state.presses++; this.actions++; this.sfx('jump'); },
  update(dt) {
    const s = this.state, t = E6_GRAVITY_FLIGHT.tuning;
    const gravity = Math.max(t.minGravity, t.gravity - s.presses * this.penalty(t.gravityLoss));
    const lift = Math.min(t.maxLift, t.lift + s.presses * this.penalty(t.liftGain));
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt);
    const lifting = this.held('action');
    // 회전은 프레임 수가 아니라 시간으로 쌓는다 — 화면이 느려져도 도는 속도는 같다.
    s.spin = lifting ? (s.spin + dt * SPIN.fps) % SPIN.frames : 0;
    s.vy = MINI.clamp(s.vy + (lifting ? -lift : gravity) * dt, -340, 320);
    s.y += s.vy * dt;
    syncGates(this);
    // 그림 상자가 글자 기둥에 겹치거나 위아래 벽에 닿으면 실패다.
    const box = this.catBox;
    const gate = this.gates.find(g => Math.abs(g.x - s.x) < g.halfWidth + box.halfWidth
      && s.y + box.halfHeight > g.top && s.y - box.halfHeight < g.bottom);
    if (!s.immune && (gate || s.y - box.halfHeight <= TUNNEL.top || s.y + box.halfHeight >= TUNNEL.bottom)) {
      s.hits++; s.x = Math.max(0, s.x - t.knockback);
      s.y = gate?.y ?? MINI.clamp(s.y, TUNNEL.top + RESPAWN_MARGIN, TUNNEL.bottom - RESPAWN_MARGIN);
      s.vy = 0; s.immune = .85; MINI.summon(this); this.bump();
    }
    // 그림이 벽을 파고들지 않게 세운다 — 닿는 순간이 곧 실패 판정이라 딱 붙는 데까지만 간다.
    s.y = MINI.clamp(s.y, TUNNEL.top + box.halfHeight, TUNNEL.bottom - box.halfHeight);
    this.anomaly = `중력 ${gravity} · 상승 ${lift} · 충돌 ${s.hits}회`;
    this.risk = Math.min(100, s.presses * 6);
    if (s.x >= t.distance) this.finish(true);
  },
  render() {
    const s = this.state, t = E6_GRAVITY_FLIGHT.tuning, f = MINI.FIELD;
    MINI.frame(this);
    // 통로 위아래는 부딪히면 밀려나는 벽이다. 화면 끝까지 채워 통로를 또렷하게 만든다.
    MINI.box(this, f.x, f.y, f.w, TUNNEL.top - f.y, 0x27384a);
    MINI.box(this, f.x, TUNNEL.bottom, f.w, f.bottom - TUNNEL.bottom, 0x27384a);
    for (const gate of this.gates) {
      const x = gate.x - s.x + 180;
      const onScreen = x > -60 && x < 1000;
      gate.label.setVisible(onScreen);
      if (!onScreen) continue;
      // 화면 밖에서 태어나 오른쪽 끝에 닿을 무렵 또렷해진다.
      const fade = MINI.clamp((this.elapsed - gate.bornAt) / t.fadeIn, 0, 1);
      gate.label.setPosition(x, gate.top).setAlpha(fade);
      // 글자가 벽에 붙어 있다는 자국. 판정 끝선은 글자 자체가 보여 주므로 따로 긋지 않는다.
      const wall = gate.side === 'top' ? TUNNEL.top : TUNNEL.bottom;
      const edge = gate.side === 'top' ? gate.bottom : gate.top;
      MINI.box(this, x - gate.halfWidth, Math.min(wall, edge), gate.halfWidth * 2, Math.abs(edge - wall), 0x4c657f, .22 * fade);
    }
    const pop = MINI.spawnScale(this);
    E6_GRAVITY_FLIGHT.drawCat.call(this, pop);
    MINI.spawnFx(this, 180, s.y, 32);
    if (pop && this.held('action')) MINI.spike(this, 146, s.y - 8, -MINI.rand(12, 28), 18, 0xffc47e);
    MINI.goal(this, t.distance - s.x + 180, (TUNNEL.top + TUNNEL.bottom) / 2);
    MINI.meter(this, s.x / t.distance);
  },
};
