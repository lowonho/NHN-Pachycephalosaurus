/* 밈 에셋은 나중에 이 역할별 경로만 채우면 됩니다. null은 게임별 기본 도형 사용.
 * 예: e3: { person: 'assets/minigames/e3/person.webp' }
 * 판정과 난이도는 이미지의 투명 여백/해상도에 영향을 받지 않습니다.
 */
globalThis.MINIGAME_ASSETS = {
  e1: { player: null, obstacle: null }, e2: { player: null },
  // e3: 포즈별 투명 이미지. 원점=이미지 중심, 권장 비율은 e3의 poses.width/height.
  e3: { person: null, person_crouch: null, person_wide: null, person_reach: null }, e4: { player: null },
  e5: { projectile: null, target: null }, e6: { player: null },
  e7: { prize: null }, e8: { player: null, weight: null }, e9: { stone: null },
  e10: { player: null },
};
