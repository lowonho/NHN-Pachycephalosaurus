/*
 * 공통 캔버스 규격과 거제 야호 스테이지 배치.
 *
 * 캔버스는 기존 1920 × 1080을 유지하고, 카메라가 따라갈 물리 월드만 가로로 넓힌다.
 * 모든 플랫폼 설정은 비주얼과 정적 충돌체가 함께 참조한다.
 */

const GEOJE_STAGE_EVENTS = Object.freeze({
  FACING: "geoje:facing",
  FISHING_START: "geoje:fishing-start",
  FISHING_PROGRESS: "geoje:fishing-progress",
  FISHING_COMPLETE: "geoje:fishing-complete",
  MOVING_PLATFORM_SYNC: "geoje:moving-platform-sync",
  TILT_START: "geoje:tilt-start",
  NET_HIT: "geoje:net-hit",
  FALL_START: "geoje:fall-start",
  FALL_COMPLETE: "geoje:fall-complete",
  CLEAR_POSE: "geoje:clear-pose",
});

const STAGE_GEOMETRY = (() => {
  const WIDTH = 1920;
  const HEIGHT = 1080;
  const WORLD_WIDTH = 2800;
  const WORLD_HEIGHT = 1240;
  const PLAYER_WIDTH = 81;
  const PLAYER_HEIGHT = 123;
  const LOWER_TOP = 900;
  const UPPER_TOP = 430;

  const lowerPlatforms = [
    { id: "start-deck", kind: "deck", x: 390, y: 990, width: 780, height: 180 },
    { id: "breakwater", kind: "breakwater", x: 1220, y: 990, width: 600, height: 180 },
    { id: "rock-1", kind: "rock", x: 1580, y: 1010, width: 160, height: 180 },
    { id: "rock-2", kind: "rock", x: 1740, y: 1025, width: 180, height: 180 },
    { id: "rock-3", kind: "rock", x: 1915, y: 1040, width: 190, height: 180 },
    { id: "rock-4", kind: "rock", x: 2095, y: 1055, width: 190, height: 180 },
    { id: "stop-dock", kind: "stop", x: 2440, y: 1102.5, width: 560, height: 275 },
  ].map((platform) => Object.freeze(platform));

  const upperPlatforms = [
    { id: "upper-landing", kind: "upper", x: 2450, y: 470, width: 540, height: 80 },
    { id: "tilt-platform", kind: "tilt", x: 1280, y: 470, width: 340, height: 44 },
    { id: "photo-stage", kind: "photo", x: 550, y: 470, width: 1000, height: 80 },
  ].map((platform) => Object.freeze(platform));

  return Object.freeze({
    canvas: Object.freeze({ width: WIDTH, height: HEIGHT }),
    world: Object.freeze({ width: WORLD_WIDTH, height: WORLD_HEIGHT }),
    floorY: LOWER_TOP,
    fallThreshold: Object.freeze({ lower: HEIGHT + 35, upper: 700 }),

    player: Object.freeze({
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      startX: 260,
      startY: LOWER_TOP - PLAYER_HEIGHT / 2,
      glowRadius: 59,
      iconOffsetY: PLAYER_HEIGHT / 2 + 6,
      bubbleOffsetY: -138,
    }),

    checkpoints: Object.freeze({
      lower: Object.freeze({ x: 710, y: LOWER_TOP - PLAYER_HEIGHT / 2 }),
      upper: Object.freeze({ x: 2470, y: UPPER_TOP - PLAYER_HEIGHT / 2 }),
    }),

    lowerPlatforms: Object.freeze(lowerPlatforms),
    upperPlatforms: Object.freeze(upperPlatforms),

    breakwaterGap: Object.freeze({ x: 850, y: 930, width: 140 }),
    slipperyZone: Object.freeze({ x: 1830, y: 970, width: 720, height: 250 }),
    stopZone: Object.freeze({ x: 2435, y: 860, width: 410, height: 250 }),
    safetyNet: Object.freeze({ x: 2758, y: 875, width: 36, height: 380 }),

    fishing: Object.freeze({
      basket: Object.freeze({ width: 150, height: 34, startX: 2450, startY: 940 }),
      control: Object.freeze({ x: 2710, y: 660 }),
      end: Object.freeze({ x: 2470, y: 402 }),
      npc: Object.freeze({ x: 2605, y: 320 }),
      rod: Object.freeze({ x: 2545, y: 350, length: 185 }),
    }),

    movingPlatform: Object.freeze({
      id: "wave-platform",
      kind: "moving",
      x: 1830,
      y: 480,
      width: 300,
      height: 42,
      amplitude: 58,
    }),

    photoZone: Object.freeze({
      frame: Object.freeze([
        Object.freeze({ x: 480, y: 425, width: 510, height: 12 }),
        Object.freeze({ x: 230, y: 315, width: 12, height: 230 }),
        Object.freeze({ x: 730, y: 315, width: 12, height: 230 }),
        Object.freeze({ x: 480, y: 200, width: 510, height: 12 }),
      ]),
      label: Object.freeze({ x: 480, y: 255 }),
      goal: Object.freeze({ x: 480, y: 350, width: 500, height: 160 }),
      pose: Object.freeze({ x: 455, y: UPPER_TOP - PLAYER_HEIGHT / 2 }),
      npcPose: Object.freeze({ x: 565, y: 390 }),
    }),

    camera: Object.freeze({
      lookAhead: 320,
      lerp: 0.075,
      fallbackCenterY: 520,
      minScrollY: -440,
      maxScrollY: 540,
    }),

    hud: Object.freeze({
      stageLabel: Object.freeze({ x: 57, y: 48 }),
      goalLabel: Object.freeze({ x: 57, y: 92 }),
      timer: Object.freeze({ x: 1860, y: 57, originX: 1, originY: 0 }),
    }),

    speechBubble: Object.freeze({ width: 225, height: 72 }),
  });
})();
