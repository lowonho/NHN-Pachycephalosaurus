/* 밈 에셋은 나중에 이 역할별 경로만 채우면 됩니다. null은 게임별 기본 도형 사용.
 * 예: e5: { projectile: 'assets/minigames/e5/projectile.webp' }
 * 판정과 난이도는 이미지의 투명 여백/해상도에 영향을 받지 않습니다.
 * 예외는 e3 하나로, 사람 모형의 충돌체를 그림의 알파에서 뽑아 씁니다(아래 참고).
 */
globalThis.MINIGAME_ASSETS = {
  e1: { player: null, obstacle: null }, e2: { player: null },
  // e3: 자세별 투명 이미지 여덟 장과 성공선 표지. 원점=이미지 중심이고, 표시 비율과
  // 사각형 충돌 조각은 scripts/bake-stack-poses.ps1 이 구운 e3/pose-shapes.js 가 정한다.
  e3: {
    pose1: 'assets/images/minigame/stacks/metcha/pose1.webp',
    pose2: 'assets/images/minigame/stacks/metcha/pose2.webp',
    pose3: 'assets/images/minigame/stacks/metcha/pose3.webp',
    pose4: 'assets/images/minigame/stacks/metcha/pose4.webp',
    pose5: 'assets/images/minigame/stacks/metcha/pose5.webp',
    pose6: 'assets/images/minigame/stacks/metcha/pose6.webp',
    pose7: 'assets/images/minigame/stacks/metcha/pose7.webp',
    pose8: 'assets/images/minigame/stacks/metcha/pose8.webp',
    line: 'assets/images/minigame/stacks/metcha/line.webp',
  }, e4: { player: null },
  e5: { projectile: null, target: null }, e6: { player: null },
  e7: { prize: null }, e8: { player: null, weight: null }, e9: { stone: null },
};
