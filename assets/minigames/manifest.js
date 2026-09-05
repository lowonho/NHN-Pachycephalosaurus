/* 밈 에셋은 나중에 이 역할별 경로만 채우면 됩니다. null은 게임별 기본 도형 사용.
 * 예: e5: { projectile: 'assets/minigames/e5/projectile.webp' }
 * 판정과 난이도는 이미지의 투명 여백/해상도에 영향을 받지 않습니다.
 * 예외는 e3 하나로, 사람 모형의 충돌체를 그림의 알파에서 뽑아 씁니다(아래 참고).
 */
globalThis.MINIGAME_ASSETS = {
  // e1: 상태별 캐릭터 네 장과 골지점 표지. 원점=이미지 중심이고, 발끝은 판정 사각형의
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
    obstacle: null,
  }, e2: { player: null },
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
  }, e4: { player: null, tileRoof: 'assets/minigames/e4/tile-roof.png', thatch: null },
  e5: { projectile: null, target: null },
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
globalThis.E4_VILLAGE_BOUNDS = { tileRoof: [151,43,1008,1021] };
