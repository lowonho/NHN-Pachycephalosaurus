/* 밈 에셋은 나중에 이 역할별 경로만 채우면 됩니다. null은 게임별 기본 도형 사용.
 * 예: e5: { projectile: 'assets/minigames/e5/projectile.webp' }
 * 판정과 난이도는 이미지의 투명 여백/해상도에 영향을 받지 않습니다.
 * 예외는 e3 하나로, 사람 모형의 충돌체를 그림의 알파에서 뽑아 씁니다(아래 참고).
 */
globalThis.MINIGAME_ASSETS = {
  // e1: 상태별 캐릭터 네 장과 골지점 표지. 이 다섯 장이 한 세트고, 기본과 woni 두 벌 중
  // 한 벌이 판마다 무작위로 뽑힌다. 원점=이미지 중심이고, 발끝은 판정 사각형의
  // 중력 쪽 모서리에 맞춘다. 표시 높이는 e1_gravityDash.js 의 POSE_HEIGHT 가 정하고,
  // 원본 png 에서 굽는 일은 scripts/bake-geomatric-dash.ps1 이 한다.
  e1: {
    // backdrop 은 필드를 통째로 덮는 배경 한 장이다(16:9). 벽 안쪽 통로에서만 보이고,
    // 깔리는 순간 MINI.frame 의 격자는 사라지고 어둠막만 남는다. 원본 geoje-sea.png 에서
    // 굽는 일은 scripts/bake-geoje-sea.ps1 이 한다.
    backdrop: 'assets/images/minigame/geomatric%20dash/geoje-sea.webp',
    run: 'assets/images/minigame/geomatric%20dash/run.webp',
    jump: 'assets/images/minigame/geomatric%20dash/jump.webp',
    hurt: 'assets/images/minigame/geomatric%20dash/hurt.webp',
    fall: 'assets/images/minigame/geomatric%20dash/fall.webp',
    goal: 'assets/images/minigame/geomatric%20dash/goal.webp',
    // 밈 캐릭터 세트는 판마다 한 벌만 무작위로 뽑힌다. woni- 가 붙은 것이 두 번째 세트고,
    // 세트 목록은 e1_gravityDash.js 의 ART_SETS 가 들고 있다. 배경 한 장은 두 세트가 같이 쓴다.
    'woni-run': 'assets/images/minigame/geomatric%20dash/woni/run.webp',
    'woni-jump': 'assets/images/minigame/geomatric%20dash/woni/jump.webp',
    'woni-hurt': 'assets/images/minigame/geomatric%20dash/woni/hurt.webp',
    'woni-fall': 'assets/images/minigame/geomatric%20dash/woni/fall.webp',
    'woni-goal': 'assets/images/minigame/geomatric%20dash/woni/goal.webp',
    obstacle: null,
  },
  // e2: 왁뿌볼 넉 장과 발판 그림들. 공은 정사각 그림 한가운데가 곧 공의 중심이라 굴러도
  // 회전축이 흔들리지 않고(한 변 = 판정 지름 x e2_bounceBall.js 의 BALL_ART), 발판은
  // 폭을 발판에 맞추고 윗면을 판정선에 건다. 판정은 예전 그대로 반지름 20과 윗면 한 줄이다.
  // 원본 png 에서 굽는 일은 scripts/bake-wakppu.ps1 이 한다.
  e2: {
    // backdrop 은 필드를 통째로 덮는 배경 한 장이다(16:9). 깔리는 순간 MINI.frame 의
    // 격자는 사라지고 어둠막만 남는다. 원본은 같은 폴더의 12번 키덜트 컬렉터 룸이다.
    backdrop: 'assets/images/minigame/wakppu/room.webp',
    // 껍질이 깨질수록 다음 그림으로 넘어간다. 점프 0~2 / 3~5 / 6~8 / 9회 이상.
    ball1: 'assets/images/minigame/wakppu/ball1.webp',
    ball2: 'assets/images/minigame/wakppu/ball2.webp',
    ball3: 'assets/images/minigame/wakppu/ball3.webp',
    ball4: 'assets/images/minigame/wakppu/ball4.webp',
    // 버터말랑이 = 보통 발판. 폭에 따라 장·중·단을 골라 늘어나 보이지 않게 한다.
    platformLong: 'assets/images/minigame/wakppu/platform-long.webp',
    platformMedium: 'assets/images/minigame/wakppu/platform-medium.webp',
    platformShort: 'assets/images/minigame/wakppu/platform-short.webp',
    // 왁뿌바 = 붕괴 발판. 밟으면 갈라진 그림으로 바뀌었다가 사라진다.
    crumble: 'assets/images/minigame/wakppu/crumble.webp',
    crumbleSplit: 'assets/images/minigame/wakppu/crumble-split.webp',
    // 파란 호빵 말랑이 = 승강 발판. 폭 135 이상은 넓은 쪽을 쓴다.
    liftWide: 'assets/images/minigame/wakppu/lift-wide.webp',
    liftNarrow: 'assets/images/minigame/wakppu/lift-narrow.webp',
  },
  // e3: 자세별 투명 이미지 여덟 장과 성공선 표지. 원점=이미지 중심이고, 표시 비율과
  // 사각형 충돌 조각은 scripts/bake-stack-poses.ps1 이 구운 e3/pose-shapes.js 가 정한다.
  e3: {
    // backdrop 은 필드를 통째로 덮는 배경 한 장이다(16:9). 깔리는 순간 MINI.frame 의
    // 격자는 사라지고 어둠막만 남는다. 원본은 같은 폴더의 backroom.png 다.
    backdrop: 'assets/images/minigame/stacks/metcha/backroom.jpg',
    pose1: 'assets/images/minigame/stacks/metcha/pose1.webp',
    pose2: 'assets/images/minigame/stacks/metcha/pose2.webp',
    pose3: 'assets/images/minigame/stacks/metcha/pose3.webp',
    pose4: 'assets/images/minigame/stacks/metcha/pose4.webp',
    pose5: 'assets/images/minigame/stacks/metcha/pose5.webp',
    pose6: 'assets/images/minigame/stacks/metcha/pose6.webp',
    pose7: 'assets/images/minigame/stacks/metcha/pose7.webp',
    pose8: 'assets/images/minigame/stacks/metcha/pose8.webp',
    line: 'assets/images/minigame/stacks/metcha/line.webp',
  }, e4: {
    player: null, playerRight: null,
    playerUp: 'assets/minigames/e4/왕사남유해진 뒤 (1).png',
    playerDown: 'assets/minigames/e4/왕사남유해진앞 (1).png',
    tiger: 'assets/minigames/e4/호랑이 스프라이트.png',
    goalCharacter: 'assets/minigames/e4/대기중인왕.png',
    tileRoof: 'assets/minigames/e4/기와집.png', tileRoofAlt: 'assets/minigames/e4/기와집2.png',
    thatch: 'assets/minigames/e4/초가집 (1).png', thatchAlt: 'assets/minigames/e4/초가집2.png',
    inn: null, longHouse: null,
  },
  // e5: 두쫀쿠 새총. 원점=이미지 중심이고, 표시 크기는 e5_slingshot.js 의 ART 가 정한다.
  // 판정은 Matter 강체 그대로라 그림을 갈아 끼워도 난이도는 변하지 않는다.
  // 원본 png 에서 굽는 일은 scripts/bake-ddujjonku.ps1 이 한다.
  e5: {
    // backdrop 은 필드를 통째로 덮는 배경 한 장이다(16:9). 깔리는 순간 MINI.frame 의
    // 격자는 사라지고 어둠막만 남는다.
    backdrop: 'assets/images/minigame/ddujjonku/cafe.webp',
    // 발사체 두쫀쿠의 상태별 네 장. 대기 -> 당기는 중 -> 날아가는 중 -> 맞고 갈라진 뒤.
    proud: 'assets/images/minigame/ddujjonku/proud.webp',
    tense: 'assets/images/minigame/ddujjonku/tense.webp',
    launch: 'assets/images/minigame/ddujjonku/launch.webp',
    split: 'assets/images/minigame/ddujjonku/split.webp',
    // 새총 몸통. 고무줄은 당기는 자리를 따라가야 해서 코드가 선으로 그린다.
    slingshot: 'assets/images/minigame/ddujjonku/slingshot.webp',
    // 파괴 대상 두딱깡. 한 번이라도 맞으면 target-hit 으로 바뀐다.
    target: 'assets/images/minigame/ddujjonku/target.webp',
    targetHit: 'assets/images/minigame/ddujjonku/target-hit.webp',
    // 과자집 부재. 아래층 기둥이 길고 위층이 짧으며, 부러진 조각은 pillarShort 로 바뀐다.
    roof: 'assets/images/minigame/ddujjonku/roof.webp',
    floorWide: 'assets/images/minigame/ddujjonku/floor-wide.webp',
    floorSmall: 'assets/images/minigame/ddujjonku/floor-small.webp',
    pillarLong: 'assets/images/minigame/ddujjonku/pillar-long.webp',
    pillarMedium: 'assets/images/minigame/ddujjonku/pillar-medium.webp',
    pillarShort: 'assets/images/minigame/ddujjonku/pillar-short.webp',
    // 움직이지 않는 배경 소품. 조리대 상판과 집이 올라앉은 초콜릿, 장식용 초콜릿이다.
    table: 'assets/images/minigame/ddujjonku/table.webp',
    brick: 'assets/images/minigame/ddujjonku/brick.webp',
    brickStar: 'assets/images/minigame/ddujjonku/brick-star.webp',
  },
  // e6: oiia 고양이 회전 여섯 장. 스페이스를 누르는 동안 spin1→spin6 을 돌리고 놓으면 spin1 에
  // 멈춘다(e6_gravityFlight.js 의 SPIN_FPS). 여섯 장 모두 같은 사각형으로 잘라 회전축이
  // 흔들리지 않고, 원본 시트에서 굽는 일은 scripts/bake-oiia-cat.ps1 이 한다.
  e6: {
    spin1: 'assets/images/minigame/geomatric%20fly/spin1.webp',
    spin2: 'assets/images/minigame/geomatric%20fly/spin2.webp',
    spin3: 'assets/images/minigame/geomatric%20fly/spin3.webp',
    spin4: 'assets/images/minigame/geomatric%20fly/spin4.webp',
    spin5: 'assets/images/minigame/geomatric%20fly/spin5.webp',
    spin6: 'assets/images/minigame/geomatric%20fly/spin6.webp',
    // 통로를 막는 밈 글자 기둥. 세로 조판 그림 한 장이 낱말 하나이고, 기둥 높이는 게임이
    // 정한 뒤 가로는 그림 비율에서 뽑는다(e6_gravityFlight.js 의 MEME.art).
    // 원본 '<낱말>_세로.png' 에서 굽는 일은 scripts/bake-meme-pillars.ps1 이 한다.
    'word-yeoreobun': 'assets/images/minigame/geomatric%20fly/word-yeoreobun.webp',
    'word-jeodwaess': 'assets/images/minigame/geomatric%20fly/word-jeodwaess.webp',
    'word-mwotdwaess': 'assets/images/minigame/geomatric%20fly/word-mwotdwaess.webp',
    'word-shagal': 'assets/images/minigame/geomatric%20fly/word-shagal.webp',
    'word-yareu': 'assets/images/minigame/geomatric%20fly/word-yareu.webp',
    'word-ajaseu': 'assets/images/minigame/geomatric%20fly/word-ajaseu.webp',
    player: null,
  },
  e7: { prize: null, coach: 'assets/minigames/e7/coach-sheet.png', coachBack: 'assets/minigames/e7/coach-back.png' }, e8: { player: null }, e9: { stone: null },
  // e10: 정사각 프레임. 이동 4×1, 점프 4×2 (왼쪽부터 행 우선). 셀 해상도는 자동 감지.
  e10: {
    glide: 'assets/minigames/e10/skater_glide_4frame_sheet.png',
    jump: 'assets/minigames/e10/skater_jump_8frame_sheet.png',
    player: null,
  },
};

// E4 actual artwork bounds [x,y,width,height], measured from PNG alpha.
globalThis.E4_VILLAGE_BOUNDS = {
  tileRoof: [1, 0, 788, 821], tileRoofAlt: [0, 1, 731, 739],
  thatch: [1, 0, 748, 755], thatchAlt: [0, 1, 637, 635],
};
// 실제 알파 연결 영역을 측정한 프레임. pivot은 각 잘린 프레임 안의 몸통 기준점이다.
globalThis.E4_VILLAGE_MOTIONS = {
  playerUp: {
    frames: [[0, 3, 449, 582], [715, 0, 428, 556], [1430, 3, 452, 580]],
    pivots: [[238, 327], [238, 330], [238, 327]],
    referenceSide: 582,
  },
  playerDown: {
    frames: [[0, 1, 466, 553], [693, 0, 436, 526], [1363, 0, 433, 554]],
    pivots: [[253, 329], [225, 330], [224, 330]],
    referenceSide: 582,
  },
  tiger: {
    frames: [[0, 1, 305, 639], [719, 1, 284, 639], [1419, 1, 306, 639]],
    pivots: [[153, 229], [142, 229], [153, 229]],
  },
  goalCharacter: { frames: [[0, 0, 411, 489], [887, 0, 411, 489]], pivots: [[205.5, 317.85], [205.5, 317.85]] },
};
