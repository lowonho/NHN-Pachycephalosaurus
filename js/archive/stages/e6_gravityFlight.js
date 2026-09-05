import { MINI } from './minigame-kit.js';

/*
 * 장애물은 세로로 조판된 밈 글자 그림이다. 낱말 한 장이 통로를 막는 기둥 하나가 되고,
 * manifest.js 가 e6:word-… 로 물어 온다(원본에서 굽는 일은 scripts/bake-meme-pillars.ps1).
 * 기둥 높이는 글자 수에서 정하고 가로는 그림 비율에서 뽑으므로 따로 맞출 값이 없다.
 * 그림이 없으면 예전처럼 글꼴(@font-face YeogiOttaeJalnan)로 세운 글자로 돌아간다.
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
  sets: [['여러분', '저됐어요', '뭣됐어요'], ['샤갈'], ['야르'], ['아자스!']],
  // 낱말 → manifest.js 의 그림 이름. 그림이 없는 낱말은 아래 글꼴로 세운다.
  art: {
    '여러분': 'word-yeoreobun', '저됐어요': 'word-jeodwaess', '뭣됐어요': 'word-mwotdwaess',
    '샤갈': 'word-shagal', '야르': 'word-yareu', '아자스!': 'word-ajaseu',
  },
  family: '"YeogiOttaeJalnan", "NeoDunggeunGothicPro", "Galmuri11", sans-serif',
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

/* 통로 안은 흰 바탕이고 위아래 벽만 연한 형광 연두다 — 두 색이 갈려야 천장·바닥이 어디인지 보인다.
   격자는 긋지 않으므로 화면에 남는 것은 이 두 색과 밈 글자, 고양이뿐이다. */
const FIELD_WHITE = 0xffffff;
const WALL_GREEN = 0xd9fb7a;

/* 위아래 벽 사이의 통로. 판정과 그림이 같은 값을 본다.
   필드 세로 중심(320.5)을 기준으로 위아래 대칭이고, 남는 68씩이 벽이다 — e1 중력 대쉬와 같은 통로다.
   고양이 그림 전체가 판정이 된 뒤로 좁은 통로는 너무 빡빡했다. */
const TUNNEL = { top: 130, bottom: 511, height: 381 };
/* 부딪힌 뒤 되돌아가 서는 자리가 벽에서 떨어져 있어야 하는 거리. 고양이 반 키(24)보다 넉넉하다. */
const RESPAWN_MARGIN = 52;

/* 글자 기둥은 처음부터 서 있지 않다. 벽 속에 숨어 오다가 화면 오른쪽 30% 지점에서
   위 기둥은 천장에서 내려오고 아래 기둥은 바닥에서 솟는다.
   고양이는 화면 x=180 에 있고 필드는 20~940 이므로, lead 484 가 곧 화면 70% 자리(664)다.
   더 앞에서 내보내면 앞이 비어 보이고, 더 뒤면 보고 피할 틈이 없다.
   speed 255 기준으로 나오고 나서 부딪히기까지 약 1.9초다.

   기둥의 3분의 2는 옆으로도 미끄러져 들어온다 — 벽에서 곧게만 솟으면 줄이 너무 정직해 보인다.
   slide 는 나오기 시작할 때 제 자리보다 얼마나 앞(오른쪽)에 있는지이고, 다 나오면 0이 된다.
   그래서 위 기둥은 오른쪽 위에서 왼쪽 아래로, 아래 기둥은 오른쪽 아래에서 왼쪽 위로 들어온다. */
const EMERGE = { lead: 484, time: .38, slide: 132, straightOdds: 1 / 3 };

/* 기둥이 벽 밖으로 나온 정도(0~1). 끝에서 부드럽게 멎는 곡선이라 튀어나오는 맛이 산다.
   판정과 그림이 같은 값을 보므로, 아직 덜 나온 기둥은 그만큼만 부딪힌다. */
function gateReach(scene, gate) {
  if (gate.emergedAt === null) return 0;
  const phase = MINI.clamp((scene.elapsed - gate.emergedAt) / EMERGE.time, 0, 1);
  return 1 - (1 - phase) ** 4;
}

/* 지금 이 순간 기둥이 서 있는 x. 다 나온 기둥은 제 자리(gate.x)이고,
   들어오는 중인 기둥은 아직 slide 만큼 앞에 있다. 판정과 그림이 이 값을 함께 본다. */
function gateX(scene, gate) {
  return gate.x + gate.slide * (1 - gateReach(scene, gate));
}

/* 캐릭터는 도는 고양이(oiia)다. 스페이스를 누르고 있는 동안에만 spin1→spin6 을 돌리고,
   손을 떼면 spin1 에 멈춘다 — 상승 중인지 떨어지는 중인지가 그림 하나로 읽힌다.
   그림은 assets/images/minigame/geomatric fly 의 여섯 장이고 manifest.js 가 e6:spin1…6 으로
   물어 온다. 원본 시트에서 굽는 일은 scripts/bake-oiia-cat.ps1 이 한다. */
const SPIN = {
  frames: 6,
  fps: 20,       // 초당 프레임. 여섯 장이라 한 바퀴에 0.3초 — 밈의 속도다.
  height: 53,    // 표시 높이. 가로는 텍스처 비율에서 뽑고, 판정 상자도 이 크기 그대로다.
};

/* 도는 동안 고양이를 감싸는 불. 뒤로 뿜는 분사 꼬리가 아니라 몸을 통째로 두른 불길이다.
   ink(고양이 뒤)에는 넓게 번지는 열기와 긴 불꽃 혀를, blaze(고양이 앞)에는 몸에 걸치는 짧고
   밝은 불길을 그린다. 두 겹 사이에 고양이가 끼고 털에도 주황빛이 돌아 불 속에서 도는 것처럼 보인다. */
const FIRE = {
  rise: .09, fall: .16,  // 불이 다 붙기까지 / 손을 뗀 뒤 꺼지기까지 걸리는 시간(초)
  tongues: 14,           // 몸 둘레를 도는 불꽃 혀의 수. 적으면 불이 아니라 별 모양이 된다.
  spin: 2.6,             // 불꽃 혀가 도는 속도(라디안/초). 고양이보다 느려야 몸이 도는 게 보인다.
  flicker: 13,           // 흔들리는 빠르기
  sparks: 5,             // 위로 떠오르며 꺼지는 불티의 수
  // 몸을 감싸는 열기. 바깥일수록 붉고 옅다 — 순서가 뒤집히면 가운데가 시커먼 덩어리가 된다.
  glow: [
    { swell: 1.95, color: 0xff4d2e, alpha: .13 },
    { swell: 1.45, color: 0xff7a2f, alpha: .22 },
    { swell: 1.14, color: 0xffa33d, alpha: .34 },
  ],
  back: [0xff8a2f, 0xff5f2e, 0xffa33d],  // 뒤로 길게 뻗는 불꽃 혀
  front: [0xffd166, 0xfff1b8],           // 몸에 걸치는 짧고 밝은 불길
};

/* 불꽃 혀 하나. 뿌리 두 점은 몸 안쪽(base)에 두고 꼭짓점만 바깥으로 뻗어, 불이 몸에서
   떨어져 피어오르지 않고 몸을 물고 있는 것처럼 보이게 한다.
   혀마다 기본 길이와 폭이 다르다 — 길이가 고르면 불길이 아니라 별처럼 뻗친다. */
function tongue(g, x, y, rx, ry, index, angle, base, reach, colors, alpha, time) {
  const wave = .5 + .5 * Math.sin(time * FIRE.flicker + index * 2.7);
  const vary = (index * .618034) % 1;                 // 황금비로 흩은 혀마다의 성깔
  const length = reach * (.5 + vary * .9) * (.5 + wave * .7);
  const spread = .13 + .13 * vary;                    // 긴 혀일수록 조금 더 굵다
  g.fillStyle(colors[index % colors.length], alpha * (.5 + wave * .5));
  g.fillTriangle(
    x + Math.cos(angle - spread) * rx * base, y + Math.sin(angle - spread) * ry * base,
    x + Math.cos(angle + spread) * rx * base, y + Math.sin(angle + spread) * ry * base,
    x + Math.cos(angle) * (rx + length), y + Math.sin(angle) * (ry + length),
  );
}

function drawFire(scene, x, y, rx, ry, heat) {
  const front = scene.blaze?.clear();
  if (heat <= 0 || !front) return;
  const back = scene.ink, time = scene.elapsed;
  // 몸 둘레에 퍼지는 열기. 바깥 고리일수록 크고 붉고 옅다.
  for (const ring of FIRE.glow) {
    const swell = ring.swell + Math.sin(time * FIRE.flicker * .5 + ring.swell) * .04;
    back.fillStyle(ring.color, heat * ring.alpha);
    back.fillEllipse(x, y, rx * 2 * swell, ry * 2 * swell);
  }
  // 같은 둘레를 도는 불꽃 혀 두 겹. 앞 겹은 반 칸 어긋나 있어 사이사이로 고양이가 비친다.
  for (let i = 0; i < FIRE.tongues; i++) {
    const step = Math.PI * 2 / FIRE.tongues, turn = time * FIRE.spin;
    tongue(back, x, y, rx, ry, i, i * step + turn, .55, ry * .85, FIRE.back, heat * .7, time);
    tongue(front, x, y, rx, ry, i, (i + .5) * step - turn * .6, .7, ry * .3, FIRE.front, heat * .5, time);
  }
  // 위로 떠오르며 꺼지는 불티.
  for (let i = 0; i < FIRE.sparks; i++) {
    const life = (time * 1.6 + i / FIRE.sparks) % 1;
    front.fillStyle(FIRE.front[i % FIRE.front.length], heat * (1 - life) * .8);
    front.fillCircle(x + Math.sin(i * 2.7 + time * 3) * rx * .9, y - ry * (.4 + life * 1.9), .6 + 2.4 * (1 - life));
  }
}

/* 골지점 표지. e1 중력 대쉬와 같은 연출이다 — 제자리에서 통통 튀고, 꼭대기에서 길쭉해지고
   바닥에서 납작해지도록 가로세로를 반대로 늘여 넓이를 지킨다. */
const GOAL = {
  height: 189,   // 표시 높이. 통로(381)의 절반이다.
  hop: 16,       // 제자리에서 튀어오르는 높이
  hops: 1.2,     // 초당 튀는 횟수
  show: 980,     // 이보다 화면 왼쪽으로 들어와야 그린다(그 전에는 화면 밖이다)
};

/* 키에 묶인 그림 한 장을 만들거나 다시 쓴다. 텍스처가 없으면 그림을 감추고 null 을 돌려주므로,
   부르는 쪽은 그때 예전 도형으로 그리면 된다 — 에셋이 빠져도 게임은 돈다. */
function sprite(scene, key, texture, depth) {
  if (!scene.textures.exists(texture)) { MINI.hideActor(scene, key); return null; }
  let image = scene.assetSprites.get(key);
  if (!image) { image = scene.add.image(0, 0, texture).setMask(scene.ink.mask).setDepth(depth); scene.assetSprites.set(key, image); }
  return image.setTexture(texture).setVisible(true);
}

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

/* 기둥 하나의 그림. 구운 낱말 그림이 있으면 그것을, 없으면 예전처럼 글꼴로 세운 글자를 쓴다.
   둘 다 원본 크기를 width/height 로 알려 주므로 fitGate 가 같은 식으로 잰다. */
function makeLabel(scene, word) {
  const key = `e6:${MEME.art[word] ?? ''}`;
  const label = scene.textures.exists(key)
    ? scene.add.image(0, 0, key)
    : scene.add.text(0, 0, word.split('').join('\n'), {
      fontFamily: MEME.family, fontSize: `${E6_GRAVITY_FLIGHT.tuning.cell}px`, color: MEME.color,
      align: 'center', stroke: MEME.stroke, strokeThickness: 5,
    });
  return label.setOrigin(.5, 0).setMask(scene.ink.mask).setDepth(4);
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
    // 셋 중 하나는 곧게 솟고 나머지는 옆으로도 미끄러져 든다. 미끄러지는 거리도 조금씩 다르다.
    const slide = Math.random() < EMERGE.straightOdds ? 0 : MINI.rand(.55, 1) * EMERGE.slide;
    const gate = { x: scene.nextGate.x, word, side: index % 2 ? 'top' : 'bottom', slide, emergedAt: null };
    gate.label = makeLabel(scene, word);
    fitGate(gate); scene.gates.push(gate);
    scene.nextGate = { x: scene.nextGate.x + t.spacing, index: index + 1 };
  }
  for (let i = scene.gates.length - 1; i >= 0; i--) {
    const gate = scene.gates[i];
    // 앞 lead 안으로 들어온 기둥이 벽에서 튀어나오기 시작한다. 한 번 나온 기둥은 다시 들어가지 않는다.
    // 미끄러져 드는 기둥은 slide 만큼 앞에서 시작하므로, 그 자리를 기준으로 재야
    // 어느 기둥이든 화면 같은 자리(70%)에서 모습을 드러낸다.
    if (gate.emergedAt === null && gate.x + gate.slide - x <= EMERGE.lead) gate.emergedAt = scene.elapsed;
    if (gate.x >= x - t.despawnBehind) continue;
    gate.label.destroy(); scene.gates.splice(i, 1);
  }
}

export const E6_GRAVITY_FLIGHT = {
  words: MEME.words, sets: MEME.sets, tunnel: TUNNEL,
  tuning: {
    speed: 255, distance: 4200, gravity: 640, gravityLoss: 35, minGravity: 240,
    lift: 570, liftGain: 24, maxLift: 850, knockback: 245,
    // spacing 은 기둥 사이 거리다. 예전 355 에서 295 로 좁혀 한 판에 서는 기둥이 11 개에서 14 개가 됐다.
    // cell(글자 한 칸 높이)은 건드리지 않는다 — 키우면 위아래로 오갈 거리가 늘어 통과가 급격히 어려워진다.
    cell: 42, minGap: 152, aimMargin: 52, spacing: 295, firstX: 470,
    spawnAhead: 880, spawnStop: 140, despawnBehind: 420,
  },
  build() {
    MINI.init(this, 0x7cd9ff);
    // 바닥은 흰 바탕에 민무늬다. 벽은 render 에서 연두로 덮어 통로 경계를 낸다.
    this.fieldColor = FIELD_WHITE; this.fieldGrid = false;
    // 조작 안내는 어두운 바닥을 전제로 한 옅은 회청색이라 벽 연두 위에서는 묻힌다.
    // 이 판에서만 짙은 풀색 글씨에 연두 테두리로 바꿔 벽과 같은 계열로 읽히게 한다.
    this.instruction.setColor('#24450a').setStroke('#eaffb4', 5);
    // spin 은 누르고 있는 동안 쌓이는 프레임 수(정수부가 곧 지금 프레임)다. 손을 떼면 0으로 돌아간다.
    // heat 는 불이 붙은 정도(0~1)다. 누르고 떼는 순간 불이 튀지 않도록 시간을 두고 오간다.
    this.state = { x: 0, y: (TUNNEL.top + TUNNEL.bottom) / 2, vy: 0, presses: 0, hits: 0, immune: 0, spin: 0, heat: 0 };
    this.catBox = catBox(this);
    // 고양이 앞에 겹치는 불길. 뒤 겹은 ink 에 그리므로 앞 겹만 따로 둔다(스테이지를 나갈 때 함께 지워진다).
    this.blaze = this.add.graphics().setDepth(3).setMask(this.ink.mask);
    this.gates = []; this.nextGate = { x: E6_GRAVITY_FLIGHT.tuning.firstX, index: 0 };
    this.memeQueue = []; this.memeBag = [];
    loadMemeFont(this); syncGates(this);
  },
  dispose() { for (const gate of this.gates ?? []) gate.label?.destroy(); this.gates = []; this.blaze = null; },
  /* 지금 프레임의 고양이를 그린다. 그림이 없으면 예전 도형으로 돌아가므로 에셋이 빠져도 게임은 돈다.
     표시 크기만 그림에서 뽑고 판정(s.y ± 13)은 그대로다 — 그림을 키워도 부딪히는 범위는 같다. */
  drawCat(pop) {
    const s = this.state;
    const texture = `e6:spin${Math.floor(s.spin) + 1}`;
    // 소환 연출 앞부분(pop 0)에는 MINI.actor 가 스프라이트를 감춰 준다.
    const image = pop > 0 ? sprite(this, 'player', texture, 2) : null;
    if (!image) {
      MINI.actor(this, 'player', 'player', 180, s.y, 36 * pop, 28 * pop, s.vy / 900);
      return;
    }
    const height = SPIN.height * pop;
    // 불이 붙은 만큼 털에도 주황빛이 돈다. 불길이 몸 앞뒤로만 있으면 고양이만 따로 노는 느낌이 든다.
    const tint = 0xff0000 | Math.round(255 - 40 * s.heat) << 8 | Math.round(255 - 95 * s.heat);
    image.setPosition(180, s.y).setRotation(s.vy / 900)
      .setDisplaySize(height * image.width / image.height, height).setTint(tint);
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
    s.heat = MINI.clamp(s.heat + dt / (lifting ? FIRE.rise : -FIRE.fall), 0, 1);
    s.vy = MINI.clamp(s.vy + (lifting ? -lift : gravity) * dt, -340, 320);
    s.y += s.vy * dt;
    syncGates(this);
    // 그림 상자가 글자 기둥에 겹치거나 위아래 벽에 닿으면 실패다.
    // 기둥은 벽 밖으로 나온 만큼만 막는다 — 아직 숨어 있는 기둥 자리는 그냥 지나간다.
    const box = this.catBox;
    const gate = this.gates.find(g => {
      const shown = (g.bottom - g.top) * gateReach(this, g);
      if (shown <= 0 || Math.abs(gateX(this, g) - s.x) >= g.halfWidth + box.halfWidth) return false;
      const top = g.side === 'top' ? g.top : g.bottom - shown;
      return s.y + box.halfHeight > top && s.y - box.halfHeight < top + shown;
    });
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
    // 통로 위아래는 부딪히면 밀려나는 벽이다. 흰 바닥 위에 연두로 덮어 화면 끝까지 채우면
    // 천장과 바닥이 어디서 끝나는지가 색만으로 읽힌다.
    MINI.box(this, f.x, f.y, f.w, TUNNEL.top - f.y, WALL_GREEN);
    MINI.box(this, f.x, TUNNEL.bottom, f.w, f.bottom - TUNNEL.bottom, WALL_GREEN);
    for (const gate of this.gates) {
      const x = gateX(this, gate) - s.x + 180;
      const reach = gateReach(this, gate);
      const onScreen = x > -60 && x < 1000 && reach > 0;
      gate.label.setVisible(onScreen);
      if (!onScreen) continue;
      // 기둥은 벽 안에서 미끄러져 나온다. 글자를 벽 쪽으로 물려 두고, 벽에 아직 묻힌 만큼을
      // 잘라 낸다(setCrop) — 벽 그림은 ink 라 글자(depth 4)보다 아래에 있어 가려 주지 못한다.
      const height = gate.bottom - gate.top, shown = height * reach;
      const texture = gate.label.frame;
      if (gate.side === 'top') {
        gate.label.setPosition(x, TUNNEL.top - height + shown);
        gate.label.setCrop(0, texture.height * (1 - reach), texture.width, texture.height * reach);
      } else {
        gate.label.setPosition(x, TUNNEL.bottom - shown);
        gate.label.setCrop(0, 0, texture.width, texture.height * reach);
      }
      if (reach >= 1) gate.label.setCrop();  // 다 나온 뒤에는 잘라 낼 것이 없다(반 픽셀 이음매 방지).
      // 글자 뒤에는 아무것도 깔지 않는다 — 판정 범위는 글자 그림 자체가 보여 준다.
    }
    const pop = MINI.spawnScale(this);
    const box = this.catBox;
    drawFire(this, 180, s.y, box.halfWidth * pop, box.halfHeight * pop, pop ? s.heat : 0);
    E6_GRAVITY_FLIGHT.drawCat.call(this, pop);
    MINI.spawnFx(this, 180, s.y, 32);
    // 골지점은 그림 한 장이다. 그림이 없으면 예전 고리 표시로 돌아간다.
    const goalX = t.distance - s.x + 180, lane = (TUNNEL.top + TUNNEL.bottom) / 2;
    if (goalX >= GOAL.show) MINI.hideActor(this, 'goal');
    else {
      const banner = sprite(this, 'goal', 'e6:goal', 1);
      if (!banner) MINI.goal(this, goalX, lane);
      else {
        const hop = Math.abs(Math.sin(this.elapsed * Math.PI * GOAL.hops));
        const stretch = 1 + (hop - .5) * .08, ratio = banner.width / banner.height;
        banner.setPosition(goalX, lane - hop * GOAL.hop)
          .setDisplaySize(GOAL.height * ratio / stretch, GOAL.height * stretch);
      }
    }
    MINI.meter(this, s.x / t.distance);
  },
};
