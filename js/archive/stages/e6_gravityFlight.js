import { MINI } from './minigame-kit.js';

/*
 * 장애물은 그림이 아니라 글자다. 밈 문장을 한 글자씩 세로로 세워 통로를 막는 기둥으로 쓰고,
 * 글꼴은 css/tokens.css의 @font-face(YeogiOttaeJalnan)가 물어 온다. 밈을 바꾸려면 MEME.words만
 * 고치면 되고, 기둥 높이·판정 폭은 실제로 그려진 글자 크기에서 뽑으므로 따로 맞출 값이 없다.
 *
 * 장애물은 처음에 모두 만들어 두지 않는다. 쿠키런처럼 캐릭터가 tuning.spawnAhead 안으로
 * 들어온 것만 그때 태어나고(화면 오른쪽 바깥이라 갑자기 튀어나오지 않는다) 지나간 것은 지운다.
 * scene.gates에는 살아 있는 장애물만 있고, 각 항목의 y는 그 기둥을 비켜 지나가는 지점이다
 * — 충돌 후 되돌아갈 자리이자 조준 목표로 함께 쓴다.
 */
const MEME = {
  family: '"YeogiOttaeJalnan", "NeoDunggeunGothicPro", "Galmuri11", sans-serif',
  words: ['여러분', '저 됐어요', 'X됐어요', '샤갈!', '야르~'],
  color: '#fff3d6', stroke: '#07141d',
};

/* 위아래 벽 사이의 통로. 판정과 그림이 같은 값을 본다. */
const TUNNEL = { top: 168, bottom: 468, height: 300 };

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
    const index = scene.nextGate.index, word = MEME.words[index % MEME.words.length];
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
  words: MEME.words,
  tuning: {
    speed: 255, distance: 4200, gravity: 640, gravityLoss: 35, minGravity: 240,
    lift: 570, liftGain: 24, maxLift: 850, knockback: 245,
    cell: 42, minGap: 152, aimMargin: 52, spacing: 355, firstX: 500,
    spawnAhead: 880, spawnStop: 140, despawnBehind: 420, fadeIn: .3,
  },
  build() {
    MINI.init(this, 0x7cd9ff);
    this.state = { x: 0, y: 323, vy: 0, presses: 0, hits: 0, immune: 0 };
    this.gates = []; this.nextGate = { x: E6_GRAVITY_FLIGHT.tuning.firstX, index: 0 };
    loadMemeFont(this); syncGates(this);
  },
  dispose() { for (const gate of this.gates ?? []) gate.label?.destroy(); this.gates = []; },
  action() { this.state.presses++; this.actions++; this.sfx('jump'); },
  update(dt) {
    const s = this.state, t = E6_GRAVITY_FLIGHT.tuning;
    const gravity = Math.max(t.minGravity, t.gravity - s.presses * this.penalty(t.gravityLoss));
    const lift = Math.min(t.maxLift, t.lift + s.presses * this.penalty(t.liftGain));
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt);
    s.vy = MINI.clamp(s.vy + (this.held('action') ? -lift : gravity) * dt, -340, 320);
    s.y += s.vy * dt;
    syncGates(this);
    const gate = this.gates.find(g => Math.abs(g.x - s.x) < g.halfWidth + 15 && s.y + 13 > g.top && s.y - 13 < g.bottom);
    if (!s.immune && (gate || s.y < 169 || s.y > 467)) {
      s.hits++; s.x = Math.max(0, s.x - t.knockback); s.y = gate?.y ?? MINI.clamp(s.y, 220, 415); s.vy = 0; s.immune = .85; MINI.summon(this); this.bump();
    }
    s.y = MINI.clamp(s.y, 168, 468);
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
    MINI.actor(this, 'player', 'player', 180, s.y, 36 * pop, 28 * pop, s.vy / 900);
    MINI.spawnFx(this, 180, s.y, 32);
    if (pop && this.held('action')) MINI.spike(this, 146, s.y - 8, -MINI.rand(12, 28), 18, 0xffc47e);
    MINI.goal(this, t.distance - s.x + 180, 316);
    MINI.meter(this, s.x / t.distance);
  },
};
