/* 렌더링/충돌 도구만 공유합니다. 모든 게임 상태는 scene.state에 새로 생성합니다. */
export const MINI = {
  /*
   * 플레이 화면(필드) = 모니터 스크린 전체.
   *
   * 예전에는 캔버스(960×540) 한가운데 920×353짜리 판을 그리고 위아래 빈 띠에
   * 글자를 얹었다. 지금은 그 판이 곧 화면이다 — 설계 좌표(가로 20~940)는 그대로 두고
   * 카메라 한 번으로 필드를 16:9 화면에 꽉 채운다. 게임 좌표·판정은 하나도 바뀌지 않고
   * 같은 배율만큼 위아래로 더 보이게 되어, 각 게임이 가장자리까지 그림을 잇는다.
   *
   * 화면 위 UI(조작 안내 · 진행 막대)는 이 필드 위에 겹쳐 그린다.
   */
  FIELD: (() => {
    const x = 20, w = 920, cy = 320.5;      // 옛 필드의 가로 범위와 세로 중심
    const h = w * 540 / 960;                // 16:9 — 517.5
    return { x, y: cy - h / 2, w, h, right: x + w, bottom: cy + h / 2, cx: x + w / 2, cy };
  })(),
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
  rand: (lo, hi, random = Math.random) => lo + random() * (hi - lo),
  hit: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  init(scene, color) {
    scene.actions = 0; scene.risk = 0; scene.accent = color;
    const f = MINI.FIELD;
    // 필드가 화면을 꽉 채우도록 맞춘다. 가로 f.w가 캔버스 960이 되고 세로도 같은 배율을 쓴다.
    scene.cameras.main.setZoom(960 / f.w).setScroll(f.cx - 480, f.cy - 270);
    scene.ink = scene.add.graphics();
    scene.fieldMask = scene.make.graphics({ x: 0, y: 0, add: false });
    scene.fieldMask.fillStyle(0xffffff).fillRect(f.x, f.y, f.w, f.h);
    scene.ink.setMask(scene.fieldMask.createGeometryMask());
    // 조작 안내는 플레이 화면 위에 겹친다. 배경 위에서도 읽히도록 테두리를 준다.
    scene.instruction = scene.add.text(f.cx, f.bottom - 26, scene.stage.controls, {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#a8c6d2',
      stroke: '#04121b', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(.9);
    scene.assetSprites = new Map();
    scene.spawnAt = -1;
  },
  /* 죽고 다시 시작할 때의 공통 소환 연출. 재생 시간은 MINI.SPAWN초로 0.5초를 넘지 않습니다.
     scene.elapsed(공통 게임 시간)만 사용하므로 게임 쪽에 별도 타이머가 필요 없습니다. */
  SPAWN: .42,
  summon(scene) { scene.spawnAt = scene.elapsed; },
  spawnPhase(scene) {
    const phase = (scene.elapsed - scene.spawnAt) / MINI.SPAWN;
    return scene.spawnAt >= 0 && phase >= 0 && phase < 1 ? phase : null;
  },
  /* 빛기둥이 바닥에 닿기 전에는 캐릭터를 감추고(배율 0), 닿는 순간 부풀었다 제자리로 돌아옵니다.
     도형과 이미지 에셋에 함께 적용합니다. */
  spawnScale(scene) {
    const phase = MINI.spawnPhase(scene);
    if (phase === null) return 1;
    if (phase < .32) return 0;
    const pop = (phase - .32) / .68;
    return pop < .4 ? .3 + pop / .4 * .85 : 1.15 - (pop - .4) / .6 * .15;
  },
  /* 필드 천장에서 캐릭터로 내리꽂히는 빛기둥. 앞 1/3에 바닥까지 닿고 나머지 구간에서 옅어집니다. */
  spawnFx(scene, x, y, size = 30, color = scene.accent) {
    const phase = MINI.spawnPhase(scene);
    if (phase === null) return;
    const g = scene.ink, top = MINI.FIELD.y;
    const drop = Math.min(1, phase / .32), land = Math.max(0, phase - .32) / .68;
    const bottom = top + (y - top) * (1 - (1 - drop) ** 3), fade = 1 - land * land;
    const half = size * (.5 + .45 * fade);
    // 위가 좁고 아래로 퍼지는 사다리꼴을 세 겹 겹쳐 부드러운 기둥을 만듭니다.
    const column = (spread, tint, alpha) => g.fillStyle(tint, alpha * fade).fillPoints([
      { x: x - half * spread * .55, y: top }, { x: x + half * spread * .55, y: top },
      { x: x + half * spread, y: bottom }, { x: x - half * spread, y: bottom },
    ], true);
    column(2.3, color, .09); column(1.4, color, .2); column(.8, 0xfaffec, .55);
    // 기둥을 타고 올라가는 입자와 착지 지점에 퍼지는 빛.
    for (let i = 0; i < 5; i++) {
      const rise = (phase * 2.4 + i / 5) % 1;
      MINI.circle(scene, x + Math.sin((i + phase * 6) * 2.1) * half * .8, bottom - (bottom - top) * rise * .55,
        1.5 + 1.5 * fade, 0xfaffec, fade * (1 - rise) * .9);
    }
    g.fillStyle(0xfaffec, fade * .5).fillEllipse(x, bottom, size * (1.4 + 2.4 * land), size * (.34 + .5 * land));
    g.lineStyle(2, color, fade * .7).strokeEllipse(x, bottom, size * (1.8 + 3.4 * land), size * (.44 + .7 * land));
  },
  /* 필드 바닥칠. 화면을 통째로 덮으므로 둥근 모서리도 바깥 여백도 두지 않는다. */
  frame(scene) {
    const g = scene.ink, f = MINI.FIELD; g.clear();
    g.fillStyle(0x0c202e).fillRect(f.x, f.y, f.w, f.h);
    g.lineStyle(1, scene.accent, 0.13);
    for (let x = f.x + 20; x < f.right; x += 40) g.lineBetween(x, f.y, x, f.bottom);
    for (let y = f.y + 28; y < f.bottom; y += 40) g.lineBetween(f.x, y, f.right, y);
  },
  box(scene, x, y, w, h, color, alpha = 1) {
    scene.ink.fillStyle(color, alpha).fillRoundedRect(x, y, w, h, Math.min(5, w / 3, h / 3));
  },
  circle(scene, x, y, r, color, alpha = 1) { scene.ink.fillStyle(color, alpha).fillCircle(x, y, r); },
  line(scene, x, y, xx, yy, color, width = 2) { scene.ink.lineStyle(width, color).lineBetween(x, y, xx, yy); },
  spike(scene, x, y, w, h, color = 0xff6584) { scene.ink.fillStyle(color).fillTriangle(x, y, x + w, y, x + w / 2, y + h); },
  goal(scene, x, y, r = 22) {
    scene.ink.lineStyle(3, 0xa7ffc6).strokeCircle(x, y, r);
    scene.ink.lineStyle(2, 0xa7ffc6, 0.3).strokeCircle(x, y, r + 7);
    if (scene.assistProtocol && scene.elapsed % 5 < .45) {
      const wave = (scene.elapsed % .45) / .45;
      scene.ink.lineStyle(4, 0x93fca0, 1 - wave).strokeCircle(x, y, r + 12 + wave * 28);
    }
    MINI.circle(scene, x, y, 4, 0xa7ffc6);
  },
  /* 에셋 교체 지점: assets/minigames/manifest.js에 역할별 이미지 경로를 등록합니다.
     표시 크기만 교체하고 물리 판정은 각 게임의 기존 도형을 유지합니다. */
  actor(scene, role, key, x, y, w, h, angle = 0, color = scene.accent) {
    // 소환 시작은 크기 0이다. Canvas에 음수 반지름을 넘기지 않고 완전히 감춘다.
    if (w <= 0 || h <= 0) { MINI.hideActor(scene, key); return; }
    const texture = `${scene.stageId}:${role}`;
    if (scene.textures.exists(texture)) {
      let sprite = scene.assetSprites.get(key);
      if (!sprite) { sprite = scene.add.image(x, y, texture).setMask(scene.ink.mask); scene.assetSprites.set(key, sprite); }
      sprite.setPosition(x, y).setDisplaySize(w, h).setRotation(angle).setVisible(true);
      return;
    }
    const g = scene.ink;
    g.save(); g.translateCanvas(x, y); g.rotateCanvas(angle);
    if (role === 'person' || role === 'player' && scene.stageId === 'e8') {
      g.fillStyle(0xffddb3).fillCircle(0, -h * .33, h * .16);
      g.fillStyle(color).fillRoundedRect(-w * .36, -h * .12, w * .72, h * .34, 5);
      g.lineStyle(6, color).lineBetween(-w * .43, 0, w * .43, 0);
      g.lineBetween(-w * .15, h * .15, -w * .28, h * .43);
      g.lineBetween(w * .15, h * .15, w * .28, h * .43);
    } else if (scene.stageId === 'e2' || role === 'stone' || role === 'projectile') {
      g.fillStyle(color).fillCircle(0, 0, w / 2);
      if (w > 6) g.lineStyle(2, 0xe9ffff, .6).strokeCircle(0, 0, w / 2 - 3);
      g.fillStyle(0x08212b).fillCircle(-w * .16, -h * .12, 2.5).fillCircle(w * .16, -h * .12, 2.5);
    } else {
      g.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(8, h / 3));
      g.fillStyle(0x08212b).fillCircle(-w * .16, -h * .12, 2.8).fillCircle(w * .16, -h * .12, 2.8);
    }
    g.restore();
  },
  hideActor(scene, key) { scene.assetSprites.get(key)?.setVisible(false); },
  /* 진행 막대도 화면 위 오버레이다 — 필드 맨 아래에 얇게 눕힌다. */
  meter(scene, fraction) {
    const f = MINI.FIELD, x = f.x + 12, y = f.bottom - 9, w = f.w - 24;
    MINI.box(scene, x, y, w, 4, 0x204251, .85);
    MINI.box(scene, x, y, w * MINI.clamp(fraction, 0, 1), 4, scene.accent);
  },
};
