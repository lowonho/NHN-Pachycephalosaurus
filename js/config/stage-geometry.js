/*
 * 공통 계약 — 캔버스 규격. (동결)
 *
 * 아트(A)와 기능(B)이 함께 참조한다. 특히 canvas 값은 js/art/viewport-fit.js가
 * --ui-scale을 계산하는 기준이라, 바꾸면 DOM UI 전체 배율이 같이 움직인다.
 *
 * 옛 스테이지의 레벨 배치(장애물·포토존·플레이어 시작 위치·캔버스 HUD 좌표)는
 * 게임을 새로 정하면서 걷어냈다. 새 스테이지의 배치는 여기에 다시 채운다.
 */

const STAGE_GEOMETRY = (() => {
  const WIDTH = 1920;
  const HEIGHT = 1080;
  const FLOOR_Y = 945;

  return Object.freeze({
    canvas: Object.freeze({ width: WIDTH, height: HEIGHT }),
    floorY: FLOOR_Y,

    ground: Object.freeze({
      x: WIDTH / 2,
      y: FLOOR_Y + (HEIGHT - FLOOR_Y) / 2,
      width: WIDTH,
      height: HEIGHT - FLOOR_Y,
      lineThickness: 6,
    }),
  });
})();
