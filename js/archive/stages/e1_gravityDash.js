import { MINI } from './minigame-kit.js';

/* 코스 좌표. 플레이어는 점프하지 않고 바닥 벽과 천장 벽 사이를 오갑니다.
   통로 높이는 381 — 필드 세로 중심(320.5)을 기준으로 위아래 대칭이고, 남는 68씩이 벽입니다. */
const FLOOR_TOP = 511;   // 바닥 벽의 윗면
const CEIL_BOTTOM = 130; // 천장 벽의 아랫면
const FLOOR_Y = 494;     // 바닥에 붙었을 때 플레이어 중심
const CEIL_Y = 145;      // 천장에 붙었을 때 플레이어 중심
/*
 * 에셋 제작 전 플레이 감각을 확인하는 대형 밈 세트피스입니다. 화면 뒤에는 멤버를 닮은
 * 단순 대역이 서고, 앞에서는 금관·왕발·집게·불주먹이 통로 대부분을 덮습니다. 반대편
 * 벽에는 미나미 한 명이 지나갈 만큼의 틈을 반드시 남깁니다.
 */
const MEME_CAST = [
  { id: 'jana', name: '제나', weapon: '신라공주 왕관투척', main: 0xffc43d, dark: 0x7d315f },
  { id: 'woni', name: '원이?', weapon: '입에서 불뿜기', main: 0xff8a18, dark: 0x342b38 },
  { id: 'liv', name: '리브', weapon: '발가락 따봉', main: 0xffaa7d, dark: 0x167f86 },
  { id: 'yaho', name: '야호', weapon: '다리 사이 돌파', main: 0xff9cc8, dark: 0x8a4c65 },
];
const CORRIDOR = FLOOR_TOP - CEIL_BOTTOM;
const HAZARD_W = 112;                        // 작은 가시 대신 한눈에 보이는 넓은 공격
const BASIC_W = 58;
const BASIC_H = 92;
const CROWN_SLANT = 72;                      // 왕관 공격의 실제 판정도 이만큼 비스듬히 꺾임
const YAHO_SCREEN_X = 50;                    // 거대 야호는 플레이어를 다리 사이에 두고 화면 중앙에 등장
const YAHO_HOLD = .9;
const MAX_FLIPS = 14;
/* ACT가 올라갈수록 속도·반응 시간·통과 틈만 단계적으로 조입니다. 코스 시간은 약 16.3초로 유지합니다. */
const DIFFICULTIES = [
  { speed: 300, revealSeconds: 1.05, warningSeconds: .70, gap: 120, emergeTime: .38 },
  { speed: 340, revealSeconds: .80, warningSeconds: .55, gap: 102, emergeTime: .32 },
  { speed: 380, revealSeconds: .62, warningSeconds: .42, gap: 86, emergeTime: .26 },
];
const makeDifficulty = act => {
  const picked = DIFFICULTIES[Math.max(0, Math.min(2, act - 1))], pace = picked.speed / 285;
  return {
    ...picked,
    gate: Math.round(390 * pace),
    lead: Math.round(650 * pace),
    distance: Math.round(4650 * pace),
    revealLead: Math.round(picked.speed * picked.revealSeconds),
    warningLead: Math.round(picked.speed * (picked.revealSeconds + picked.warningSeconds)),
  };
};

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
   판이 멈추면 걸음도 멈춥니다. RUN_FPS 는 1단계 속도에서의 초당 장수라, 여기서
   장당 달리는 거리(RUN_STEP)를 뽑습니다. 초당 열네 장이면 발이 미끄러져 보이지 않습니다. */
const RUN_FRAMES = 6;
const RUN_FPS = 14;
const RUN_STEP = DIFFICULTIES[0].speed / RUN_FPS;
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
  tuning: { speed: DIFFICULTIES[0].speed, distance: makeDifficulty(1).distance, gravity: 3200 },
  build() {
    MINI.init(this, 0x67e8f9);
    // leap은 건너뛰는 연출에 남은 시간(초)입니다. 표시 크기에만 쓰이고 판정에는 끼어들지 않습니다.
    // art 는 이번 판에 쓸 밈 에셋 세트입니다. 판이 시작될 때 한 번만 뽑으므로 도중에 그림이
    // 바뀌지 않고, 판정과 코스에는 전혀 끼어들지 않는 겉모습이라 코스 시드(this.random)를
    // 쓰지 않습니다 — 같은 판을 다시 해도 다른 캐릭터가 나옵니다. 뽑는 일은 js/config/qa.js 에
    // 맡깁니다. QA 모드에서 세트를 골라 두었으면 그 세트로 고정되고(개발자에게는 세트마다 다른
    // 스테이지), 평소에는 무작위입니다. 그 파일이 없으면 여기서 그냥 무작위로 뽑습니다.
    const run = globalThis.archiveRun?.snapshot?.(), story = Boolean(run?.active && !run.qaMode);
    const act = story ? run.currentAct : 1, difficulty = makeDifficulty(act);
    const art = globalThis.ARCHIVE_QA?.active
      ? globalThis.archiveStageArtSet?.('e1', ART_SETS) ?? ''
      : story ? (act % 2 ? '' : 'woni-')
        : globalThis.archiveStageArtSet?.('e1', ART_SETS) ?? ART_SETS[Math.floor(Math.random() * ART_SETS.length)];
    // 달리는 캐릭터와 같은 인물은 장애물에서 제외합니다.
    const rival = art === 'woni-' ? 'yaho' : 'fire';
    const courseTypes = ['basic', 'basic', 'basic', 'crown', 'basic', 'foot', 'basic', 'basic', 'basic', rival];
    const memeByType = { crown: MEME_CAST[0], fire: MEME_CAST[1], foot: MEME_CAST[2], yaho: MEME_CAST[3] };
    this.dash = difficulty;
    E1_GRAVITY_DASH.tuning.speed = difficulty.speed;
    E1_GRAVITY_DASH.tuning.distance = difficulty.distance;
    this.hazards = courseTypes.map((type, gate) => ({
      type, gate, x: difficulty.lead + gate * difficulty.gate,
      w: type === 'basic' ? BASIC_W : type === 'crown' ? 156 : type === 'yaho' ? 260 : HAZARD_W,
      // 첫 장애물은 바닥에 서고, 이후 안전 벽을 계속 번갈아 줍니다.
      safe: type === 'yaho' ? 'center' : (this.random() < .5 ? 'floor' : 'ceiling'),
      progress: type === 'basic' ? 1 : 0,
      warned: false, warningAge: 0,
      triggered: type === 'basic', age: 0, resolved: false, gap: difficulty.gap,
      depth: CORRIDOR - difficulty.gap, meme: memeByType[type] ?? null,
    }));
    this.state = { x: 0, y: FLOOR_Y, vy: 0, sign: 1, deaths: 0, immune: 0, failed: false, leap: 0, art, act, obstacles: this.hazards };
    this.instruction.setText(art === 'woni-'
      ? 'SPACE · 중력 반전  |  느낌표를 확인하세요 · 거대 야호는 다리 사이로!'
      : 'SPACE · 중력 반전  |  느낌표가 뜬 쪽에서 공격 · 반대편 빈틈으로!');
    this.warningMarks = this.hazards.map(hazard => hazard.type === 'basic' ? null : this.add.text(0, 0, '!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '44px', fontStyle: 'bold', color: '#fff36b',
      stroke: '#d62727', strokeThickness: 8,
    }).setOrigin(.5).setDepth(6).setMask(this.ink.mask).setVisible(false));
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
    if (o.type === 'basic') return o.safe === 'floor'
      ? { x: screenX, y: CEIL_BOTTOM, w: o.w, h: BASIC_H }
      : { x: screenX, y: FLOOR_TOP - BASIC_H, w: o.w, h: BASIC_H };
    const eased = 1 - (1 - MINI.clamp(o.progress, 0, 1)) ** 3;
    if (o.type === 'yaho') {
      const h = CORRIDOR * eased;
      return { x: YAHO_SCREEN_X, y: FLOOR_TOP - h, w: o.w, h };
    }
    const h = o.depth * eased;
    const rect = o.safe === 'floor'
      ? { x: screenX, y: CEIL_BOTTOM, w: o.w, h }
      : { x: screenX, y: FLOOR_TOP - h, w: o.w, h };
    // 왕관만 오른쪽 위/아래 먼 곳에서 목표 벽으로 비스듬히 날아듭니다.
    if (o.type === 'crown') {
      rect.x += (1 - eased) * 190;
      rect.y += (1 - eased) * (o.safe === 'floor' ? -135 : 135);
    }
    return rect;
  },
  /* 왕관은 하나의 수직 사각형이 아니라, 실제로 비스듬히 이어진 다섯 판정 조각을 씁니다. */
  hazardRects(o, screenX = o.x) {
    if (o.resolved) return [];
    const rect = E1_GRAVITY_DASH.hazardRect(o, screenX);
    if (o.type === 'yaho') {
      const scale = rect.h / CORRIDOR;
      // 작아지는 첫 프레임에는 양발 사이도 함께 좁아지므로, 통로가 플레이어보다 넓어진 뒤에만 판정을 켭니다.
      if (scale < .62) return [];
      const cx = screenX + o.w / 2;
      const scaled = ([x, y, w, h]) => {
        const partCx = screenX + x + w / 2;
        const partCy = y + h / 2;
        return {
          x: cx + (partCx - cx) * scale - w * scale / 2,
          y: FLOOR_TOP - (FLOOR_TOP - partCy) * scale - h * scale / 2,
          w: w * scale,
          h: h * scale,
        };
      };
      // 상체와 V자로 벌어진 양다리를 나눠 가운데 바닥 통로만 비워 둡니다.
      return [
        [40, CEIL_BOTTOM, 180, 190],
        [62, 300, 64, 95], [30, 385, 70, 126],
        [134, 300, 64, 95], [160, 385, 70, 126],
      ].map(scaled);
    }
    if (o.type !== 'crown' || rect.h < 2) return [rect];
    const pieces = 5, pieceH = rect.h / pieces;
    return Array.from({ length: pieces }, (_, i) => {
      const fromWall = (i + .5) / pieces;
      const y = o.safe === 'floor' ? rect.y + i * pieceH : rect.y + rect.h - (i + 1) * pieceH;
      return {
        x: rect.x + (1 - fromWall) * CROWN_SLANT,
        y,
        w: rect.w - CROWN_SLANT,
        h: pieceH + 2,
      };
    });
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
      if (o.type !== 'basic' && !o.warned && o.x - s.x <= this.dash.warningLead) o.warned = true;
      if (o.warned && !o.triggered) o.warningAge += dt;
      if (!o.triggered && o.x - s.x <= this.dash.revealLead) o.triggered = true;
      if (o.triggered && !o.resolved) {
        o.progress = Math.min(1, o.progress + dt / this.dash.emergeTime);
        o.age += dt;
        if (o.type === 'yaho') {
          if (o.age >= YAHO_HOLD) o.resolved = true;
        }
      }
    }
    if (!s.immune && this.hazards.some(o => E1_GRAVITY_DASH.hazardRects(o, o.x - s.x + 180)
      .some(rect => MINI.hit(player, rect)))) crash();
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
  /* 가장자리까지 딱 끊기는 작은 사각형만 써서 픽셀 대역을 그립니다. */
  pixel(g, x, y, w, h, color, outline = 0x081720, alpha = 1) {
    g.fillStyle(outline, alpha).fillRect(Math.round(x) - 2, Math.round(y) - 2, Math.round(w) + 4, Math.round(h) + 4);
    g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },
  /* 공격 뒤에 크게 서 있는 멤버 대역. 장식용이므로 충돌 판정은 전혀 없습니다. */
  drawMemeBackdrop(o, x) {
    const g = this.ink, meme = o.meme, bob = Math.sin(this.elapsed * 4 + o.gate) * 4;
    const bx = x + o.w + 48, by = (CEIL_BOTTOM + FLOOR_TOP) / 2 + 18 + bob, alpha = .6;
    // 머리·몸·팔·다리를 분리한 작은 원근 캐릭터. 직사각 기둥처럼 보이지 않게 실루엣을 꺾습니다.
    g.fillStyle(meme.dark, alpha).fillCircle(bx, by - 45, 27);
    g.fillStyle(0xffd3b6, alpha).fillCircle(bx, by - 41, 20);
    g.lineStyle(11, meme.dark, alpha).lineBetween(bx - 13, by - 3, bx - 34, by + 18)
      .lineBetween(bx + 13, by - 3, bx + 35, by - 20);
    g.lineStyle(8, 0xffd3b6, alpha).lineBetween(bx - 34, by + 18, bx - 40, by + 8)
      .lineBetween(bx + 35, by - 20, bx + 42, by - 29);
    g.fillStyle(0x081720, alpha).fillRect(bx - 10, by - 47, 4, 4).fillRect(bx + 7, by - 47, 4, 4);
    if (meme.id === 'jana') {
      // 넓은 치마와 흩날리는 머리로 멀리 서 있는 공주 포즈를 만듭니다.
      g.fillStyle(meme.dark, alpha).fillTriangle(bx - 18, by - 16, bx + 18, by - 16, bx + 36, by + 53)
        .fillTriangle(bx - 18, by - 16, bx - 36, by + 53, bx + 36, by + 53);
      g.lineStyle(6, 0xffc43d, alpha).lineBetween(bx - 30, by + 43, bx + 30, by + 43);
      g.fillStyle(meme.main, alpha).fillRect(bx - 22, by - 72, 44, 9)
        .fillRect(bx - 15, by - 83, 7, 12).fillRect(bx - 3, by - 89, 7, 18).fillRect(bx + 10, by - 81, 7, 10);
    } else if (meme.id === 'liv') {
      g.fillStyle(meme.dark, alpha).fillRoundedRect(bx - 21, by - 18, 42, 48, 8);
      g.lineStyle(12, 0x167f86, alpha).lineBetween(bx - 10, by + 26, bx - 24, by + 57)
        .lineBetween(bx + 10, by + 26, bx + 27, by + 50);
      g.lineStyle(7, 0xf2f4f7, alpha).lineBetween(bx - 31, by + 59, bx - 14, by + 59)
        .lineBetween(bx + 22, by + 53, bx + 40, by + 53);
    } else {
      g.fillStyle(meme.dark, alpha).fillRoundedRect(bx - 23, by - 18, 46, 47, 7);
      g.lineStyle(12, meme.dark, alpha).lineBetween(bx - 10, by + 26, bx - 27, by + 57)
        .lineBetween(bx + 10, by + 26, bx + 25, by + 57);
      g.fillStyle(0xff8a18, alpha).fillCircle(bx + 43, by - 30, 12);
      g.lineStyle(5, 0xffd43b, alpha).strokeCircle(bx + 43, by - 30, 16);
    }
  },
  drawBasic(o, rect) {
    const g = this.ink, dir = o.safe === 'floor' ? 1 : -1;
    g.fillStyle(0x273d4b).fillRect(rect.x, rect.y, rect.w, rect.h);
    g.lineStyle(3, 0x7aa2b3).strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    // 고정 장애물이라는 뜻의 노랑/검정 안전 띠. 중력 반전에도 움직이지 않습니다.
    for (let y = rect.y + 11; y < rect.y + rect.h - 8; y += 20) {
      g.fillStyle((y / 20 | 0) % 2 ? 0xffcc45 : 0x18242c).fillRect(rect.x + 8, y, rect.w - 16, 9);
    }
    const tip = dir > 0 ? rect.y + rect.h : rect.y;
    g.fillStyle(0xffcc45).fillTriangle(rect.x, tip, rect.x + rect.w / 2, tip + dir * 20, rect.x + rect.w, tip);
  },
  /* 마지막 거대 야호. 두 다리는 V자로 벌리고 하단 중앙만 비워 실제로 그 사이를 달립니다. */
  drawYaho(o, rect) {
    const g = this.ink, scale = rect.h / CORRIDOR, cx = rect.x + o.w / 2;
    if (scale <= 0) return;
    const asset = E1_GRAVITY_DASH.sprite.call(this, `meme${o.gate}`, 'e1:yaho-meme');
    if (asset) {
      const height = CORRIDOR * scale, width = height * asset.width / asset.height;
      asset.setPosition(cx, FLOOR_TOP - height / 2).setDisplaySize(width, height)
        .setDepth(3).setAlpha(Math.min(1, scale * 1.35)).setRotation(0).setFlipX(false).setFlipY(false);
      return;
    }
    const xx = x => cx + (rect.x + x - cx) * scale;
    const yy = y => FLOOR_TOP - (FLOOR_TOP - y) * scale;
    const line = (width, color, x1, y1, x2, y2, alpha = 1) => g.lineStyle(width * scale, color, alpha)
      .lineBetween(xx(x1), yy(y1), xx(x2), yy(y2));
    // 머리카락과 얼굴, 큰 분홍 모자.
    g.fillStyle(0x7a4939).fillCircle(xx(130), yy(190), 55 * scale);
    g.fillStyle(0xffcfb3).fillCircle(xx(130), yy(187), 42 * scale);
    g.fillStyle(0xff9cc8).fillEllipse(xx(130), yy(143), 112 * scale, 46 * scale);
    g.fillStyle(0xffc1dd).fillRect(xx(79), yy(146), 102 * scale, 13 * scale);
    // 웃는 얼굴은 멀리서도 두 점과 입으로 읽히게 단순화합니다.
    g.lineStyle(4 * scale, 0x4b2f36).lineBetween(xx(110), yy(184), xx(119), yy(181))
      .lineBetween(xx(141), yy(181), xx(150), yy(184));
    g.fillStyle(0xe34c71).fillCircle(xx(130), yy(202), 8 * scale);
    // 상체와 앞으로 겹쳐 휘두른 팔.
    g.fillStyle(0xff9cc8).fillRoundedRect(xx(79), yy(222), 102 * scale, 99 * scale, 18 * scale);
    line(30, 0xffd0bd, 92, 239, 153, 273); line(30, 0xffd0bd, 168, 240, 112, 280);
    line(18, 0xffffff, 91, 255, 153, 289, .85);
    // 골반에서 바깥으로 굽힌 기마 자세. 신발 사이가 실제 정답 통로입니다.
    line(48, 0xffa6cf, 113, 315, 76, 405); line(48, 0xffa6cf, 76, 405, 62, 474);
    line(48, 0xffa6cf, 147, 315, 184, 405); line(48, 0xffa6cf, 184, 405, 198, 474);
    g.fillStyle(0xffedf6).fillRoundedRect(xx(28), yy(466), 76 * scale, 35 * scale, 10 * scale)
      .fillRoundedRect(xx(156), yy(466), 76 * scale, 35 * scale, 10 * scale);
    g.lineStyle(5 * scale, 0xdb6b9f).lineBetween(xx(34), yy(489), xx(101), yy(489))
      .lineBetween(xx(159), yy(489), xx(226), yy(489));
  },
  drawMemeMember(o) {
    const texture = o.type === 'crown' ? 'e1:jena-meme' : o.type === 'foot' ? 'e1:liv-meme' : null;
    if (!texture) return;
    const member = E1_GRAVITY_DASH.sprite.call(this, `member${o.gate}`, texture);
    if (!member) return;
    const height = o.type === 'crown' ? 220 : 205;
    member.setPosition(620, FLOOR_TOP - height / 2 - 2)
      .setDisplaySize(height * member.width / member.height, height)
      .setDepth(2).setAlpha(.92).setRotation(0).setFlipX(false).setFlipY(false);
  },
  /* 무기 머리는 빈틈과 맞닿고, 긴 팔·다리·불꽃 꼬리는 시작 벽까지 이어집니다. 따라서 보이는
     큰 실루엣 전체와 실제 직사각 판정이 일치합니다. */
  drawWeapon(o, x, rect) {
    if (rect.h < 2) return;
    const g = this.ink, meme = o.meme;
    if (meme.id === 'yaho') { E1_GRAVITY_DASH.drawYaho.call(this, o, rect); return; }
    const dir = o.safe === 'floor' ? 1 : -1;
    const tip = dir > 0 ? rect.y + rect.h : rect.y;
    const px = (xx, yy, w, h, color, outline = 0x081720, alpha = 1) => E1_GRAVITY_DASH.pixel(g, xx, yy, w, h, color, outline, alpha);
    if (meme.id === 'jana') {
      const wallY = dir > 0 ? rect.y : rect.y + rect.h;
      const innerY = tip;
      const sourceL = rect.x + CROWN_SLANT, sourceR = rect.x + rect.w;
      const innerL = rect.x, innerR = rect.x + rect.w - CROWN_SLANT;
      g.fillStyle(0xffc43d, .16)
        .fillTriangle(sourceL, wallY, sourceR, wallY, innerL, innerY)
        .fillTriangle(sourceR, wallY, innerR, innerY, innerL, innerY);
      g.lineStyle(4, meme.main, .95)
        .lineBetween(sourceL, wallY, innerL, innerY)
        .lineBetween(sourceR, wallY, innerR, innerY);
      // 참고 이미지처럼 왕관 뒤쪽에 금빛 사선 속도선을 여러 겹 남깁니다.
      for (let i = 0; i < 4; i++) {
        const back = 34 + i * 25, inset = 18 + i * 17;
        g.lineStyle(i % 2 ? 2 : 4, 0xffcf35, .9 - i * .12)
          .lineBetween(sourceR + back, wallY + dir * inset, innerR + back, innerY - dir * (34 + inset));
      }
      const crownAsset = E1_GRAVITY_DASH.sprite.call(this, `meme${o.gate}`, 'e1:jena-crown');
      if (crownAsset) {
        const height = 184 * Math.max(.35, o.progress), width = height * crownAsset.width / crownAsset.height;
        crownAsset.setPosition((innerL + innerR) / 2 + 8, innerY - dir * 62)
          .setDisplaySize(width, height).setDepth(3).setAlpha(Math.min(1, o.progress * 2.2))
          .setRotation(dir > 0 ? -.32 : .32).setFlipX(false).setFlipY(dir < 0);
        return;
      }
      const crownX = innerL - 8, crownY = dir > 0 ? innerY - 36 : innerY + 8;
      px(crownX, crownY + 18, 100, 20, meme.main);
      px(crownX + 7, crownY + 2, 15, 18, meme.main);
      px(crownX + 32, crownY - 9, 15, 29, meme.main);
      px(crownX + 57, crownY - 4, 15, 24, meme.main);
      px(crownX + 82, crownY + 4, 14, 16, meme.main);
      g.fillStyle(0xb73168).fillRect(crownX + 24, crownY + 25, 10, 8).fillRect(crownX + 70, crownY + 25, 10, 8);
      g.lineStyle(3, 0xffdf69, .95).lineBetween(crownX + 14, crownY + 36, crownX + 4, crownY + 65)
        .lineBetween(crownX + 87, crownY + 36, crownX + 97, crownY + 65);
      g.fillStyle(0xffc43d).fillCircle(crownX + 4, crownY + 67, 5).fillCircle(crownX + 97, crownY + 67, 5);
      return;
    }
    // 진행 중에도 어디까지가 위험 구역인지 알 수 있는 어두운 몸통과 밝은 가장자리.
    const headY = dir > 0 ? tip - 48 : tip;

    if (meme.id === 'liv') {
      const footAsset = E1_GRAVITY_DASH.sprite.call(this, `meme${o.gate}`, 'e1:liv-foot');
      if (footAsset) {
        const height = rect.h + 64, width = height * footAsset.width / footAsset.height;
        footAsset.setPosition(x + o.w / 2, rect.y + rect.h / 2).setDisplaySize(width, height)
          .setDepth(3).setAlpha(Math.min(1, o.progress * 2.2)).setRotation(0)
          .setFlipX(false).setFlipY(o.safe === 'ceiling');
      } else {
        // 참고 이미지의 청록 바지와 짙은 양말발. 엄지만 손 따봉처럼 수직으로 솟습니다.
        px(x + 22, rect.y, 58, Math.max(8, rect.h - 38), 0x1c666b);
        g.fillStyle(0x2d8588).fillRect(x + 29, rect.y, 12, Math.max(8, rect.h - 42));
        px(x + 7, headY + 16, 98, 32, 0x34394c);
        px(x + 6, headY - 25, 31, 46, 0x3d4359);
        px(x + 41, headY + 3, 18, 17, 0x3a4055); px(x + 63, headY + 7, 16, 13, 0x383e52); px(x + 83, headY + 10, 14, 10, 0x363b4e);
      }
    } else {
      const direction = o.safe === 'ceiling' ? 'up' : 'down';
      const frame = Math.floor(o.age * 12) % 5 + 1;
      const fireAsset = E1_GRAVITY_DASH.sprite.call(this, `meme${o.gate}`, `e1:woni-fire-${direction}${frame}`);
      if (fireAsset) {
        const height = rect.h + 58, width = height * fireAsset.width / fireAsset.height;
        fireAsset.setPosition(x + o.w / 2, rect.y + rect.h / 2).setDisplaySize(width, height)
          .setDepth(3).setAlpha(Math.min(1, o.progress * 2.4)).setRotation(0).setFlipX(false).setFlipY(false);
      } else {
        px(x + 13, headY + 8, 86, 40, 0xf05224);
        px(x + 17, headY - 6, 18, 18, meme.main); px(x + 39, headY - 10, 18, 22, meme.main);
        px(x + 61, headY - 8, 18, 20, meme.main); px(x + 83, headY - 3, 16, 15, meme.main);
        g.fillStyle(0xffd43b).fillRect(x + 22, headY + 21, 58, 11);
      }
    }

    // 안전 벽 쪽 작은 틈을 두 줄 화살표로 강조합니다.
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
    for (let i = 0; i < this.hazards.length; i++) {
      const o = this.hazards[i], x = o.x - s.x + 180;
      MINI.hideActor(this, `meme${o.gate}`);
      MINI.hideActor(this, `member${o.gate}`);
      const warning = this.warningMarks[i];
      warning?.setVisible(false);
      if (x <= -230 || x >= 1010 || o.resolved) continue;
      const rect = E1_GRAVITY_DASH.hazardRect(o, x);
      if (o.type === 'basic') {
        E1_GRAVITY_DASH.drawBasic.call(this, o, rect);
        continue;
      }
      if (o.warned && (o.type === 'crown' || o.type === 'foot')) E1_GRAVITY_DASH.drawMemeMember.call(this, o);
      if (o.warned && !o.triggered && warning) {
        const warningY = o.safe === 'floor' ? CEIL_BOTTOM + 43
          : o.safe === 'ceiling' ? FLOOR_TOP - 43 : (CEIL_BOTTOM + FLOOR_TOP) / 2;
        const pulse = 1 + Math.sin(o.warningAge * 16) * .13;
        warning.setPosition(MINI.clamp(x + o.w / 2, f.x + 45, f.right - 45), warningY)
          .setScale(pulse).setAlpha(.78 + Math.sin(o.warningAge * 16) * .22).setVisible(true);
      }
      if (!o.triggered) continue;
      E1_GRAVITY_DASH.drawWeapon.call(this, o, rect.x, rect);
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
