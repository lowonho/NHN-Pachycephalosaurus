/*
 * A(비주얼) 전용 — 캔버스 안쪽의 색·폰트·깊이 팔레트.
 * CSS 쪽 팔레트는 css/tokens.css에 있으며 두 값은 의도적으로 같은 색을 쓴다.
 */

const THEME = Object.freeze({
  color: Object.freeze({
    ink: 0x061537,
    blue: 0x1f5cff,
    cyan: 0x4eefff,
    yellow: 0xffdf50,
    coral: 0xff6678,
    groundFill: 0x07142f,
    white: 0xffffff,
  }),

  css: Object.freeze({
    ink: "#061537",
    blue: "#1f5cff",
    cyan: "#4eefff",
    yellow: "#ffe04b",
    coral: "#ff5f6f",
    white: "#ffffff",
  }),

  alpha: Object.freeze({
    ground: 0.6,
    floorLine: 0.68,
    obstacle: 0.96,
    obstacleStroke: 0.82,
    photoZone: 0.92,
    glow: 0.32,
    bubble: 0.92,
    bubbleStroke: 0.8,
  }),

  font: Object.freeze({
    display: "Arial Black, sans-serif",
    playerIcon: "95px",
  }),

  text: Object.freeze({
    stageLabel: { fontSize: "29px", color: "#4eefff", strokeThickness: 9 },
    goalLabel: { fontSize: "41px", color: "#ffffff", strokeThickness: 11 },
    timer: { fontSize: "78px", color: "#ffe04b", strokeThickness: 14 },
    timerWarning: { color: "#ff5f6f" },
    photoZone: { fontSize: "51px", color: "#ffffff", stroke: "#1f5cff", strokeThickness: 12 },
    obstacleTier: { fontSize: "27px", color: "#ffffff", strokeThickness: 9 },
    bubble: { fontSize: "32px", color: "#ffffff" },
  }),

  // setDepth로 z순서를 명시한다. 뷰들이 서로 다른 시점에 그려져도 순서가 어긋나지 않는다.
  depth: Object.freeze({
    background: 0,
    ground: 10,
    props: 20,
    player: 30,
    playerIcon: 31,
    hud: 50,
    bubble: 60,
  }),

  motion: Object.freeze({
    jumpTiltDegrees: 18,
    jumpTiltDuration: 160,
    bubbleHoldMs: 520,
    bubbleFadeMs: 220,
    commandPulseMs: 430,
    hitShake: { duration: 80, intensity: 0.0025 },
    failShake: { duration: 240, intensity: 0.008 },
    clearFlash: { duration: 220, r: 255, g: 255, b: 255 },
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
