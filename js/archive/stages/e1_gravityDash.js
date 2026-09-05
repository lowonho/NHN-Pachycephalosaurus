import { MINI } from './minigame-kit.js';

/* 코스 좌표. 플레이어는 점프하지 않고 바닥 벽과 천장 벽 사이를 오갑니다.
   통로 높이는 381 — 필드 세로 중심(320.5)을 기준으로 위아래 대칭이고, 남는 68씩이 벽입니다. */
const FLOOR_TOP = 511;   // 바닥 벽의 윗면
const CEIL_BOTTOM = 130; // 천장 벽의 아랫면
const FLOOR_Y = 494;     // 바닥에 붙었을 때 플레이어 중심
const CEIL_Y = 145;      // 천장에 붙었을 때 플레이어 중심
const GATES = 10;
/* 맵이 흐르는 속도(px/s)입니다. 코스 길이와 장애물 간격을 모두 이 속도에 비례해 잡으므로,
   속도를 올리면 간격도 그만큼 벌어져 묶음 사이 시간(약 1.37초)과 코스 시간(약 16.3초)은 그대로입니다. */
const SPEED = 340;
const PACE = SPEED / 285;                  // 예전 기준 속도 285 대비 배율
const GATE = Math.round(390 * PACE);       // 장애물 묶음 사이 간격
const LEAD = Math.round(650 * PACE);       // 출발선에서 첫 묶음까지
const DISTANCE = Math.round(4650 * PACE);  // 골인 지점
/*
 * 에셋 제작 전 플레이 감각을 확인하는 대형 밈 세트피스입니다. 화면 뒤에는 멤버를 닮은
 * 단순 대역이 서고, 앞에서는 금관·왕발·집게·불주먹이 통로 대부분을 덮습니다. 반대편
 * 벽에는 미나미 한 명이 지나갈 만큼의 틈을 반드시 남깁니다.
 */
const MEME_CAST = [
  { id: 'jana', name: '자나', weapon: '신라공주 행차', main: 0xffc43d, dark: 0x7d315f },
  { id: 'lip', name: '립', weapon: '왕발 투하', main: 0xffaa7d, dark: 0x167f86 },
  { id: 'mee', name: '메에', weapon: '그립갑 집게', main: 0xff4e57, dark: 0x2569a8 },
  { id: 'woni', name: '원이?', weapon: '거제 불주먹', main: 0xff8a18, dark: 0x342b38 },
];
const CORRIDOR = FLOOR_TOP - CEIL_BOTTOM;
const SAFE_GAP = 92;                         // 반대쪽 벽에 남는 실제 통과 틈
const HAZARD_DEPTH = CORRIDOR - SAFE_GAP;     // 통로의 약 3/4을 덮는 무기 깊이
const HAZARD_W = 112;                        // 작은 가시 대신 한눈에 보이는 넓은 공격
const EMERGE_LEAD = Math.round(610 * PACE);  // 플레이어와 만나기 약 1.8초 전 낙하 시작
const EMERGE_TIME = .42;
const MAX_FLIPS = GATES + 4;

const HITBOX = 30;  // 판정 정사각형. 그림을 아무리 키워도 이 크기로만 부딪칩니다.
/* 캐릭터 그림(assets/images/minigame/geomatric dash)의 표시 높이입니다. 가로는 텍스처
   비율에서 뽑으므로 여기 없습니다. 원본이 자세마다 다르게 잘려 있어서, 머리 크기가
   같아 보이도록 자세별로 따로 맞춘 값입니다. 그림을 다시 그렸다면 여기부터 맞춥니다. */
const POSE_HEIGHT = { run: 78, jump: 88, hurt: 71, fall: 61 };
/* 밈 캐릭터 세트. 한 판이 시작될 때 이 중 한 벌을 뽑아 열 장(여섯 장짜리 달리기와
   건너뛰기·피격·주저앉기·골지점)을 통째로 갈아 끼웁니다. 값은 manifest.js 의 e1 역할
   이름 앞에 붙는 딱지이고, 빈 문자열이 기본 세트입니다. 세트를 늘리려면 그림을 굽고
   (bake-geomatric-dash.ps1 과 bake-dash-run.ps1 에 -Variant <이름>) manifest 에 <이름>-
   역할을 더한 뒤 여기에 한 줄 적으면 됩니다. QA 모드에서 세트를 고르는 목록은
   js/config/qa.js 의 STAGE_ART_SETS 라 그쪽에도 한 줄이 필요합니다.
   두 세트의 몸 크기가 비슷해 표시 높이(POSE_HEIGHT)는 함께 씁니다. */
const ART_SETS = ['', 'woni-'];
/* 달리기 걸음. 여섯 장을 코스 좌표로 넘기므로 속도를 올리면 걸음도 같이 빨라지고,
   판이 멈추면 걸음도 멈춥니다. RUN_FPS 는 지금 속도(SPEED)에서의 초당 장수라, 여기서
   장당 달리는 거리(RUN_STEP)를 뽑습니다. 초당 열네 장이면 발이 미끄러져 보이지 않습니다. */
const RUN_FRAMES = 6;
const RUN_FPS = 14;
const RUN_STEP = SPEED / RUN_FPS;
/* 벽을 건너뛰는 순간의 과장. 반전을 누르면 그림이 확 커졌다가, 반대 벽에 닿을 즈음
   원래 크기보다 살짝 작아졌다 돌아옵니다. 달리는 동안에는 손대지 않습니다 — 제자리에서
   계속 들썩이면 화면이 정신없습니다. 발끝을 기준으로 키우니 발은 벽에 붙어 있고,
   판정 사각형(HITBOX)은 기본 크기 그대로라 부딪히는 범위는 전혀 달라지지 않습니다. */
const LEAP_TIME = .45;  // 맥박이 한 바퀴 도는 시간(초). 벽을 건너는 데 걸리는 시간과 같습니다.
const LEAP_POP = .34;   // 꼭대기에서 커지는 비율
const LEAP_RISE = .22;  // 그 시간 중 부푸는 데 쓰는 구간. 짧을수록 튀어오르듯 커집니다.
const LEAP_DIP = .2;    // 돌아오는 길에 원래 크기 아래로 내려가는 정도(커진 양 대비)
const GOAL_HEIGHT = 189;  // 골지점 표지의 표시 높이. 통로(381)의 절반입니다.
const GOAL_HOP = 16;      // 골지점 표지가 제자리에서 튀어오르는 높이.
const GOAL_HOPS = 1.2;    // 초당 튀는 횟수.
const SPAWN_FX = 52;      // 되살아날 때의 빛기둥 굵기. 달리기 그림 가로(약 59)에 맞춥니다.
/* 바람 연출. 프레임마다 새로 뽑지 않고 코스 좌표 s.x에서 위치를 계산하므로, 흐름이
   깜빡이지 않고 달리는 동안에만 흐르고 멈추면 함께 멈춥니다. */
// 연출 세기. 줄기 수와 진하기에 함께 곱해지므로 이 값 하나로 바람 전체를 올리고 내립니다.
const WIND_LEVEL = .7;
const WIND_LINES = Math.round(22 * WIND_LEVEL);  // 통로를 가로질러 흐르는 바람 줄기 수
const WIND_SPAN = 1120;     // 줄기가 한 바퀴 도는 가로 거리. 화면(960)보다 넓어야 이어져 보입니다.
const WIND_FADE = 120;      // 화면 양 끝에서 옅어지는 구간. 줄기가 불쑥 나타나지 않게 합니다.
const TRAIL_LINES = Math.round(7 * WIND_LEVEL);  // 캐릭터 뒤로 끌리는 바람 꼬리 수
const TRAIL_SPAN = 150;     // 꼬리가 뒤로 남는 거리

export const E1_GRAVITY_DASH = {
  // 약 16.3초 코스. 캐릭터는 약 0.45초에 벽을 옮기고 장애물은 더 늦게 따라옵니다.
  // (통로가 381로 넓어져 건너는 거리가 261 → 349가 되었습니다. 중력은 그대로 둡니다.)
  tuning: { speed: SPEED, distance: DISTANCE, gravity: 3200 },
  build() {
    MINI.init(this, 0x67e8f9);
    // leap은 건너뛰는 연출에 남은 시간(초)입니다. 표시 크기에만 쓰이고 판정에는 끼어들지 않습니다.
    // art 는 이번 판에 쓸 밈 에셋 세트입니다. 판이 시작될 때 한 번만 뽑으므로 도중에 그림이
    // 바뀌지 않고, 판정과 코스에는 전혀 끼어들지 않는 겉모습이라 코스 시드(this.random)를
    // 쓰지 않습니다 — 같은 판을 다시 해도 다른 캐릭터가 나옵니다. 뽑는 일은 js/config/qa.js 에
    // 맡깁니다. QA 모드에서 세트를 골라 두었으면 그 세트로 고정되고(개발자에게는 세트마다 다른
    // 스테이지), 평소에는 무작위입니다. 그 파일이 없으면 여기서 그냥 무작위로 뽑습니다.
    const art = globalThis.archiveStageArtSet?.('e1', ART_SETS) ?? ART_SETS[Math.floor(Math.random() * ART_SETS.length)];
    this.hazards = Array.from({ length: GATES }, (_, gate) => ({
      gate, x: LEAD + gate * GATE, w: HAZARD_W,
      // 첫 공격은 바닥에서 솟아 천장으로 피하게 하고, 이후 안전 벽을 계속 번갈아 줍니다.
      safe: gate % 2 ? 'floor' : 'ceiling', progress: 0, triggered: false,
      meme: MEME_CAST[gate % MEME_CAST.length],
    }));
    this.state = { x: 0, y: FLOOR_Y, vy: 0, sign: 1, deaths: 0, immune: 0, failed: false, leap: 0, art, obstacles: this.hazards };
    this.instruction.setText('SPACE · 중력 반전  |  큰 무기 반대편의 작은 틈으로 피하세요');
    this.memeLabels = Array.from({ length: GATES }, (_, gate) => {
      const hazard = this.hazards[gate];
      const arrow = hazard.safe === 'ceiling' ? '↑' : '↓';
      return this.add.text(0, 0, `${hazard.meme.name} · ${hazard.meme.weapon}\n빈틈 ${arrow}`, {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#f8fbff', align: 'center',
        backgroundColor: '#081720', padding: { x: 7, y: 4 }, lineSpacing: 3,
        stroke: '#081720', strokeThickness: 2,
      }).setOrigin(.5).setDepth(4).setMask(this.ink.mask).setVisible(false);
    });
  },
  action() {
    const s = this.state;
    // 누를 때마다 중력이 통째로 뒤집히고 플레이어는 반대쪽 벽으로 떨어져 붙습니다.
    // 대형 무기는 정해진 벽에서 튀어나오므로 입력에 따라 흔들리지 않습니다.
    // 누르는 순간 건너뛰기 연출을 처음부터 다시 시작합니다. 연달아 눌러도 매번 새로 부풉니다.
    this.actions++; s.sign *= -1; s.vy = s.sign * 40; s.leap = LEAP_TIME;
    this.sfx('sfxE1GravityFlip');
  },
  hazardRect(o, screenX = o.x) {
    const eased = 1 - (1 - MINI.clamp(o.progress, 0, 1)) ** 3;
    const h = HAZARD_DEPTH * eased;
    return o.safe === 'floor'
      ? { x: screenX, y: CEIL_BOTTOM, w: o.w, h }
      : { x: screenX, y: FLOOR_TOP - h, w: o.w, h };
  },
  update(dt) {
    const s = this.state, t = E1_GRAVITY_DASH.tuning;
    s.x += t.speed * dt; s.immune = Math.max(0, s.immune - dt); s.leap = Math.max(0, s.leap - dt);
    s.vy += s.sign * t.gravity * dt; s.y = MINI.clamp(s.y + s.vy * dt, CEIL_Y, FLOOR_Y);
    if (s.y === CEIL_Y || s.y === FLOOR_Y) s.vy = 0;
    const player = { x: 165, y: s.y - 15, w: 30, h: 30 };
    const crash = () => {
      // 중력 방향은 그대로 두고 지금 끌리는 쪽 벽에서 다시 시작합니다. 장애물의 낙하 상태도 유지됩니다.
      s.deaths++; s.x = Math.max(0, s.x - 340); s.y = s.sign === 1 ? FLOOR_Y : CEIL_Y; s.vy = 0; s.immune = .8;
      MINI.summon(this); this.bump();
    };
    for (const o of this.hazards) {
      if (!o.triggered && o.x - s.x <= EMERGE_LEAD) o.triggered = true;
      if (o.triggered) o.progress = Math.min(1, o.progress + dt / EMERGE_TIME);
    }
    if (!s.immune && this.hazards.some(o => MINI.hit(player,
      E1_GRAVITY_DASH.hazardRect(o, o.x - s.x + 180)))) crash();
    // QA 모드에서는 지금 도는 그림 세트를 HUD 에 적어 둡니다. 겉으로는 같은 스테이지라
    // 플레이어는 알 수 없지만, 검수하는 쪽은 어느 세트를 보고 있는지 알아야 합니다.
    const qaSet = globalThis.ARCHIVE_QA?.active
      ? globalThis.ARCHIVE_QA.STAGE_ART_SETS?.e1?.find(set => set.id === s.art)?.label : null;
    this.anomaly = `중력 ${s.sign === 1 ? '↓ 바닥' : '↑ 천장'} · 충돌 ${s.deaths}회${qaSet ? ` · 세트 ${qaSet}` : ''}`;
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
  /* 벽을 건너뛰는 동안의 커짐 정도입니다. 앞 LEAP_RISE 구간에서 1까지 단숨에 부풀고,
     남은 구간에서는 원래 크기(0)를 지나 -LEAP_DIP까지 한 번 움츠렸다가 돌아옵니다.
     끝에서 값이 0이라 벽에 닿아 달리기로 돌아갈 때 크기가 튀지 않습니다. */
  leap(left) {
    if (left <= 0) return 0;
    const phase = 1 - left / LEAP_TIME;
    if (phase < LEAP_RISE) return Math.sin(phase / LEAP_RISE * Math.PI / 2);
    // 돌아오는 구간은 코사인 한 바퀴 반. 2/3 지점에서 가장 작아지고 끝에서 원래 크기입니다.
    const wave = Math.cos((phase - LEAP_RISE) / (1 - LEAP_RISE) * Math.PI * 1.5);
    return wave < 0 ? wave * LEAP_DIP : wave;
  },
  /* 자세 하나가 읽어야 할 텍스처 이름입니다. 달리기만 여섯 장짜리 걸음이라, 지금 프레임을
     코스 좌표에서 뽑습니다 — 시간이 아니라 달린 거리라서 판이 멈추면 걸음도 함께 멈추고,
     되살아나며 뒤로 밀리면 걸음도 그만큼 되감깁니다. 시트가 없는 세트는 run 한 장으로 답니다. */
  poseTexture(pose) {
    if (pose !== 'run') return `e1:${this.state.art}${pose}`;
    const frame = Math.floor(Math.max(0, this.state.x) / RUN_STEP) % RUN_FRAMES + 1;
    const key = `e1:${this.state.art}run${frame}`;
    return this.textures.exists(key) ? key : `e1:${this.state.art}run`;
  },
  /* 표시만 그림으로 바꾸고 판정 사각형은 그대로 둡니다. 발끝을 판정 사각형의 중력 쪽
     모서리에 맞추므로, 그림이 판정보다 커도 발은 지금 달리는 벽에 붙어 있습니다.
     천장을 달릴 때는 위아래로 뒤집어 발이 천장을 딛게 합니다(좌우는 그대로). */
  drawPlayer(pose, pop) {
    const s = this.state;
    // 건너뛰는 자세에만 과장을 얹습니다. 달리기·피격·주저앉기는 원래 크기 그대로입니다.
    const scale = pop * (pose === 'jump' ? 1 + LEAP_POP * E1_GRAVITY_DASH.leap(s.leap) : 1);
    const sprite = E1_GRAVITY_DASH.sprite.call(this, 'player', E1_GRAVITY_DASH.poseTexture.call(this, pose));
    if (!sprite) { MINI.actor(this, 'player', 'player', 180, s.y, HITBOX * scale, HITBOX * scale, -s.sign * s.x / 80); return; }
    const height = POSE_HEIGHT[pose] * scale, feet = s.y + s.sign * HITBOX / 2;
    sprite.setPosition(180, feet - s.sign * height / 2).setFlipY(s.sign === -1).setDepth(2)
      .setDisplaySize(height * sprite.width / sprite.height, height);
  },
  /* 통로를 흘러가는 바람. 줄기마다 다른 속도로 흘러 층이 지고, 모두 캐릭터보다 빨라서
     제자리에 달리는 캐릭터를 스쳐 지나가는 것처럼 보입니다. */
  wind() {
    const s = this.state, g = this.ink, span = FLOOR_TOP - CEIL_BOTTOM;
    for (let i = 0; i < WIND_LINES; i++) {
      const rush = 1.4 + (i % 5) * .22;
      // 황금각(137.5)으로 흩어 놓아 줄기가 줄을 맞추지 않습니다.
      const x = ((i * 137.5 - s.x * rush) % WIND_SPAN + WIND_SPAN) % WIND_SPAN - 90;
      const fade = Math.min(1, x / WIND_FADE, (MINI.FIELD.right - x) / WIND_FADE);
      if (fade <= 0) continue;
      const thin = i % 3, y = CEIL_BOTTOM + 12 + (i * 61) % (span - 24);
      g.lineStyle(thin ? 2 : 3, 0x9fe4ff, fade * (thin ? .13 : .22) * WIND_LEVEL);
      g.lineBetween(x, y, x + 62 + thin * 45, y);
    }
  },
  /* 캐릭터 바로 뒤로 끌리는 꼬리. 벽을 건너는 동안에는 떠나온 벽 쪽으로 휘어
     휘날리는 것처럼 보입니다. */
  trail() {
    const s = this.state, g = this.ink;
    const airborne = s.y !== CEIL_Y && s.y !== FLOOR_Y;
    // 판정 사각형이 아니라 그림의 몸통 높이에 맞춰 흩뿌립니다. 발치에만 몰리면 캐릭터에 가립니다.
    const feet = s.y + s.sign * HITBOX / 2, body = feet - s.sign * POSE_HEIGHT.run / 2;
    for (let i = 0; i < TRAIL_LINES; i++) {
      const flow = (s.x * 2.4 + i * TRAIL_SPAN / TRAIL_LINES) % TRAIL_SPAN, x = 162 - flow;
      const length = 30 + (i % 3) * 22;
      if (x + length < MINI.FIELD.x) continue;
      const y = body + ((i % 5) - 2) * POSE_HEIGHT.run * .16;
      // 뒤로 갈수록 옅어지고, 건너는 중에는 꼬리 끝이 지나온 벽 쪽으로 처집니다.
      const drag = airborne ? -s.sign * (TRAIL_SPAN - flow) * .09 : 0;
      g.lineStyle(2, 0xd8f4ff, (1 - flow / TRAIL_SPAN) * .55 * WIND_LEVEL);
      g.lineBetween(x, y + drag, x + length, y);
    }
  },
  /* 가장자리까지 딱 끊기는 작은 사각형만 써서 픽셀 대역을 그립니다. outline까지 한 함수에
     묶어 두었으므로 실제 PNG가 들어오면 이 함수와 drawMeme만 걷어내면 됩니다. */
  pixel(g, x, y, w, h, color, outline = 0x081720, alpha = 1) {
    g.fillStyle(outline, alpha).fillRect(Math.round(x) - 2, Math.round(y) - 2, Math.round(w) + 4, Math.round(h) + 4);
    g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },
  /* 두 가시 칸의 합친 중심에 무기를 놓고 몸은 오른쪽 뒤로 뺍니다. 먼저 닿는 무기 쪽만
     실제 판정과 겹치므로, 몸이나 머리의 장식에 스쳤다고 억울하게 충돌하지 않습니다. */
  drawMeme(o, x, y) {
    const g = this.ink, meme = o.meme, dim = o.loose ? 1 : .58;
    const px = (xx, yy, w, h, color, outline) => E1_GRAVITY_DASH.pixel(g, xx, yy, w, h, color, outline, dim);
    g.save();

    // 공통 몸통: 무기보다 작고 단순한 5색 대역. 오른쪽을 향한 발 두 칸이 달리는 인상을 줍니다.
    px(x + 19, y - 19, 17, 17, 0xffd3b6);
    px(x + 18, y - 1, 20, 23, meme.dark);
    px(x + 20, y + 22, 7, 10, 0xf4f0e8);
    px(x + 32, y + 22, 7, 10, 0xf4f0e8);
    g.fillStyle(0x081720, dim).fillRect(Math.round(x + 23), Math.round(y - 14), 3, 3)
      .fillRect(Math.round(x + 31), Math.round(y - 14), 3, 3);

    if (meme.id === 'jana') {
      // 커다란 금관: 계단식 솟을 장식이 좌우 76px 실루엣을 만듭니다.
      px(x - 38, y - 4, 55, 18, meme.main);
      px(x - 34, y - 18, 8, 14, meme.main);
      px(x - 17, y - 27, 9, 23, meme.main);
      px(x + 1, y - 20, 8, 16, meme.main);
      g.fillStyle(0xfff1a6, dim).fillRect(x - 32, y + 1, 45, 4);
      g.fillStyle(0xb73168, dim).fillRect(x - 20, y + 7, 7, 7).fillRect(x + 1, y + 7, 7, 7);
    } else if (meme.id === 'lip') {
      // 왕발: 넓은 발바닥과 네모난 발가락 네 개. 귀엽게 읽히도록 피부 디테일은 생략합니다.
      px(x - 39, y - 13, 53, 29, meme.main);
      px(x - 38, y - 24, 13, 13, meme.main);
      px(x - 23, y - 29, 13, 17, meme.main);
      px(x - 8, y - 27, 12, 15, meme.main);
      px(x + 6, y - 22, 10, 12, meme.main);
      g.fillStyle(0xffd3b6, dim).fillRect(x - 31, y + 8, 36, 4);
    } else if (meme.id === 'mee') {
      // 그립갑: 좌우 집게가 가운데 위험 칸을 물고 있습니다.
      px(x - 37, y - 8, 42, 16, 0x576273);
      px(x - 42, y - 25, 14, 17, meme.main);
      px(x - 42, y + 8, 14, 17, meme.main);
      px(x - 29, y - 20, 11, 12, meme.main);
      px(x - 29, y + 8, 11, 12, meme.main);
      g.fillStyle(0xffd44a, dim).fillRect(x - 11, y - 5, 9, 10);
      // 안전모 한 칸으로 리트와 매트식 공사 캐릭터 분위기를 암시합니다.
      px(x + 17, y - 25, 21, 7, 0xffcc2f);
    } else {
      // 거제불주먹: 주먹 네 마디와 뒤로 흩날리는 각진 불꽃.
      px(x - 34, y - 14, 38, 29, 0xf05224);
      px(x - 33, y - 22, 10, 11, meme.main);
      px(x - 21, y - 25, 10, 14, meme.main);
      px(x - 9, y - 23, 10, 12, meme.main);
      px(x + 2, y - 18, 9, 13, meme.main);
      g.fillStyle(0xffd43b, dim).fillRect(x - 38, y - 6, 9, 10)
        .fillRect(x - 48, y - 17, 7, 8).fillRect(x - 51, y + 10, 11, 7);
    }
    g.restore();
  },
  render() {
    const s = this.state, t = E1_GRAVITY_DASH.tuning, f = MINI.FIELD;
    MINI.frame(this);
    // 천장 벽과 바닥 벽. 벽 속은 화면 끝까지 채운다 — 통로 밖은 벽이지 빈 자리가 아니다.
    MINI.box(this, f.x, f.y, f.w, CEIL_BOTTOM - f.y, 0x123a4c);
    MINI.box(this, f.x, FLOOR_TOP, f.w, f.bottom - FLOOR_TOP, 0x123a4c);
    // 벽에 스치는 바람결. 빗금 대신 진행 방향으로 길게 누워 흘러갑니다.
    const shift = -(s.x * 1.15 % 240);
    for (let x = shift - 240; x < 960; x += 240) {
      MINI.line(this, x, CEIL_BOTTOM - 13, x + 96, CEIL_BOTTOM - 13, 0x1d5670, 3);
      MINI.line(this, x + 120, FLOOR_TOP + 13, x + 216, FLOOR_TOP + 13, 0x1d5670, 3);
    }
    // 벽면 띠는 통로 안쪽으로 두께 6을 차지합니다. 통로 높이를 바꿔도 따라오도록 좌표에서 뽑습니다.
    MINI.box(this, f.x, CEIL_BOTTOM - 6, f.w, 6, 0x2c6e85);
    MINI.box(this, f.x, FLOOR_TOP, f.w, 6, 0x2c6e85);
    // 지금 끌려가는 쪽 벽면을 강조해 반전 상태를 한눈에 보여 줍니다.
    MINI.box(this, f.x, s.sign === 1 ? FLOOR_TOP : CEIL_BOTTOM - 6, f.w, 6, this.accent, .95);
    // 바람은 장애물 뒤에 깔립니다. 넘어야 할 것이 바람에 묻히면 안 됩니다.
    E1_GRAVITY_DASH.wind.call(this);
    if (!s.failed) E1_GRAVITY_DASH.trail.call(this);
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i], x = o.x - s.x + 180, cx = x + o.w / 2, cy = o.y + o.h / 2;
      if (x <= -60 || x >= 1000) { MINI.hideActor(this, `o${i}`); continue; }
      if (o.spike) {
        // 두 판정 칸을 한 캐릭터로 보이게 하므로 첫 칸에서만 그림과 명찰을 그립니다.
        if (o.part) continue;
        const pairX = x + (SPIKE_GAP + SPIKE_W) / 2;
        E1_GRAVITY_DASH.drawMeme.call(this, o, pairX, cy);
        const label = this.memeLabels[o.gate];
        const inward = cy < (CEIL_BOTTOM + FLOOR_TOP) / 2 ? 47 : -47;
        label.setPosition(pairX, cy + inward).setAlpha(o.loose ? 1 : .7).setVisible(true);
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
    // 화면 밖으로 나간 캐릭터의 DOM 텍스트가 다음 프레임에 남지 않게 정리합니다.
    for (let gate = 0; gate < GATES; gate++) {
      const first = this.hurdles[gate * 2], x = first.x - s.x + 180;
      if (x <= -60 || x >= 1000) this.memeLabels[gate].setVisible(false);
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
      const banner = E1_GRAVITY_DASH.sprite.call(this, 'goal', `e1:${s.art}goal`);
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
