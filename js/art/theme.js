/*
 * A(비주얼) 전용 — 캔버스 안쪽의 색·폰트·깊이 팔레트.
 * CSS 쪽 팔레트는 css/tokens.css에 있으며 두 값은 의도적으로 같은 색을 쓴다.
 *
 * 이전 스테이지 전용 값(장애물 투명도·포토존 텍스트·점프 기울기 등)은
 * 게임을 새로 정하면서 걷어냈다. 새 씬이 필요로 하는 값을 여기에 다시 채운다.
 */

const THEME = Object.freeze({
  color: Object.freeze({
    ink: 0x061537,
    blue: 0x1f5cff,
    cyan: 0x4eefff,
    yellow: 0xffdf50,
    coral: 0xff6678,
    white: 0xffffff,
  }),

  css: Object.freeze({
    ink: "#061537",
    blue: "#1f5cff",
    cyan: "#4eefff",
    yellow: "#ffe04b",
    coral: "#ff5f6f",
    white: "#ffffff",
    textDim: "#b4c3e4",
  }),

  font: Object.freeze({
    display: "Arial Black, sans-serif",
  }),

  // setDepth로 z순서를 명시한다. 뷰들이 서로 다른 시점에 그려져도 순서가 어긋나지 않는다.
  depth: Object.freeze({
    background: 0,
    ground: 10,
    props: 20,
    player: 30,
    hud: 50,
  }),

  // 캔버스 안 라벨의 공통 텍스트 스타일을 만든다.
  label(spec) {
    return {
      fontFamily: THEME.font.display,
      fontSize: spec.fontSize,
      color: spec.color,
      stroke: spec.stroke || THEME.css.ink,
      strokeThickness: spec.strokeThickness,
    };
  },
});
