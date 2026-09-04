/*
 * 공통 계약 — 캔버스 규격과 레벨 배치. (동결)
 *
 * 아트(A)와 기능(B)이 함께 참조한다. 이 값을 바꾸면 화면과 물리가 동시에 바뀌므로
 * 단독 수정하지 말고 합의 후 변경한다.
 */

const STAGE_GEOMETRY = (() => {
  const WIDTH = 1920;
  const HEIGHT = 1080;
  const FLOOR_Y = 945;
  const PLAYER_WIDTH = 81;
  const PLAYER_HEIGHT = 123;
  const GROUND_HEIGHT = HEIGHT - FLOOR_Y;

  return Object.freeze({
    canvas: Object.freeze({ width: WIDTH, height: HEIGHT }),
    floorY: FLOOR_Y,

    player: Object.freeze({
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      startX: 218,
      startY: FLOOR_Y - PLAYER_HEIGHT / 2,
      glowRadius: 59,
      iconOffsetY: PLAYER_HEIGHT / 2 + 6,
      bubbleOffsetY: -138,
    }),

    ground: Object.freeze({
      x: WIDTH / 2,
      y: FLOOR_Y + GROUND_HEIGHT / 2,
      width: WIDTH,
      height: GROUND_HEIGHT,
      lineThickness: 6,
    }),

    // tier는 통과에 필요한 점프 높이(LOW/HIGH)이며 사운드·이미지 키 접미사로도 쓰인다.
    obstacles: Object.freeze([
      Object.freeze({ id: "low", tier: "LOW", x: 683, y: 911, width: 126, height: 138 }),
      Object.freeze({ id: "high", tier: "HIGH", x: 1185, y: 848, width: 150, height: 264 }),
    ]),

    photoZone: Object.freeze({
      frame: Object.freeze([
        Object.freeze({ x: 1710, y: 884, width: 248, height: 12 }),
        Object.freeze({ x: 1590, y: 750, width: 12, height: 270 }),
        Object.freeze({ x: 1830, y: 750, width: 12, height: 270 }),
        Object.freeze({ x: 1710, y: 615, width: 252, height: 12 }),
      ]),
      label: Object.freeze({ x: 1710, y: 663 }),
      goal: Object.freeze({ x: 1710, y: 878, width: 248, height: 180 }),
    }),

    hud: Object.freeze({
      stageLabel: Object.freeze({ x: 57, y: 48 }),
      goalLabel: Object.freeze({ x: 57, y: 92 }),
      timer: Object.freeze({ x: 1860, y: 57, originX: 1, originY: 0 }),
    }),

    speechBubble: Object.freeze({ width: 225, height: 72 }),
  });
})();
