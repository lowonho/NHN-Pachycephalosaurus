import "../content/scenario-data.js";

export const GAME_TITLE = "2026 ARCHIVE";
export const SCENARIO = globalThis.SCENARIO_DATA;

// 이전 코드가 참조하던 export는 유지하되, 실제 문장은 시나리오 단일 원본에서 가져온다.
export const PROLOGUE = SCENARIO.opening.script;

const mechanics = Object.freeze({
  maze: {
    recordSymbol: "↗", code: "VELOCITY_INDEX",
    controls: "WASD / 방향키 · 반대 방향으로 제동", actionLabel: "방향 입력",
    anomaly: "마음이 앞서고 있습니다", logTitle: "설렘의 증언",
  },
  gravity: {
    recordSymbol: "↓", code: "GRAVITY_STACK",
    controls: "A/D 또는 ←/→ 이동 · Space 점프", actionLabel: "점프",
    anomaly: "기대가 쌓이고 있습니다", logTitle: "기대의 증언",
  },
  bounce: {
    recordSymbol: "◉", code: "RESTITUTION_LOOP",
    controls: "A/D 또는 ←/→ 이동 · 자동 바운스", actionLabel: "착지",
    anomaly: "긴장이 커지고 있습니다", logTitle: "긴장의 증언",
  },
  recoil: {
    recordSymbol: "⌖", code: "RECOIL_ARRAY",
    controls: "마우스 / 터치로 조준 · 클릭하여 발사", actionLabel: "발사",
    anomaly: "감정이 되돌아옵니다", logTitle: "분노의 증언",
  },
  friction: {
    recordSymbol: "≈", code: "FRICTION_DROP",
    controls: "WASD / 방향키 · 반대 방향으로 제동", actionLabel: "이동 입력",
    anomaly: "멈출 순간을 놓치고 있습니다", logTitle: "후회의 증언",
  },
  darkness: {
    recordSymbol: "☼", code: "LIGHT_DECAY",
    controls: "WASD / 방향키", actionLabel: "방향 입력",
    anomaly: "기억이 흐려지고 있습니다", logTitle: "그리움의 증언",
  },
  rotation: {
    recordSymbol: "↻", code: "ANGULAR_LOCK",
    controls: "A/D 또는 ←/→ 회전 · 입력을 멈춰 안정", actionLabel: "회전 입력",
    anomaly: "마음을 놓아야 합니다", logTitle: "애정의 증언",
  },
});

export const STAGES = SCENARIO.stages.map((story) => Object.freeze({
  ...story,
  ...mechanics[story.id],
  objective: "20.26초 안에 증언 지점에 도달하십시오.",
  log: story.memory,
}));

// 레거시 참조 호환. 실제 엔딩 분기는 SCENARIO.endings와 run-state.mjs가 담당한다.
export const ENDING = SCENARIO.endings;

export const STORAGE_KEY = "archive-2026-progress-v1";
export const SETTINGS_KEY = "archive-2026-settings-v1";
