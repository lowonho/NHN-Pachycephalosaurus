/*
 * C2(사운드) 전용 — 오디오 에셋 키↔경로 매핑과 이벤트 연결.
 *
 * 현재 오디오 파일이 하나도 없으므로 ACTIVE 목록은 비어 있다.
 * 파일을 넣고 주석을 해제하면 sfx-player / bgm-player가 자동으로 집어간다.
 * 재생 계층은 캐시에 없는 키를 조용히 무시하므로, 일부만 채워도 안전하다.
 */

const AUDIO_KEYS = Object.freeze({
  bgmStage: "bgmStage",
  bgmClear: "bgmClear",
  bgmFail: "bgmFail",

  sfxCommandOk: "sfxCommandOk",
  sfxCommandFail: "sfxCommandFail",
  sfxJumpLow: "sfxJumpLow",
  sfxJumpMid: "sfxJumpMid",
  sfxJumpHigh: "sfxJumpHigh",
  sfxLand: "sfxLand",
  sfxHit: "sfxHit",
  sfxTimerWarning: "sfxTimerWarning",
  sfxGoal: "sfxGoal",
  sfxMicCalibrated: "sfxMicCalibrated",
  sfxUiClick: "sfxUiClick",
});

// 브라우저 호환을 위해 mp3 + ogg 두 벌을 배열로 준다. Phaser가 지원 포맷을 고른다.
const AUDIO_MANIFEST = Object.freeze([
  // ── 파일을 넣은 뒤 주석을 해제한다 ────────────────────────────────
  // { key: AUDIO_KEYS.bgmStage,  channel: "bgm", paths: ["assets/audio/bgm/stage-geoje.mp3",  "assets/audio/bgm/stage-geoje.ogg"] },
  // { key: AUDIO_KEYS.bgmClear,  channel: "bgm", paths: ["assets/audio/bgm/result-clear.mp3", "assets/audio/bgm/result-clear.ogg"] },
  // { key: AUDIO_KEYS.bgmFail,   channel: "bgm", paths: ["assets/audio/bgm/result-fail.mp3",  "assets/audio/bgm/result-fail.ogg"] },
  //
  // { key: AUDIO_KEYS.sfxCommandOk,     channel: "sfx", paths: ["assets/audio/sfx/command-ok.mp3"] },
  // { key: AUDIO_KEYS.sfxCommandFail,   channel: "sfx", paths: ["assets/audio/sfx/command-fail.mp3"] },
  // { key: AUDIO_KEYS.sfxJumpLow,       channel: "sfx", paths: ["assets/audio/sfx/jump-low.mp3"] },
  // { key: AUDIO_KEYS.sfxJumpMid,       channel: "sfx", paths: ["assets/audio/sfx/jump-mid.mp3"] },
  // { key: AUDIO_KEYS.sfxJumpHigh,      channel: "sfx", paths: ["assets/audio/sfx/jump-high.mp3"] },
  // { key: AUDIO_KEYS.sfxLand,          channel: "sfx", paths: ["assets/audio/sfx/land.mp3"] },
  // { key: AUDIO_KEYS.sfxHit,           channel: "sfx", paths: ["assets/audio/sfx/hit.mp3"] },
  // { key: AUDIO_KEYS.sfxTimerWarning,  channel: "sfx", paths: ["assets/audio/sfx/timer-warning.mp3"] },
  // { key: AUDIO_KEYS.sfxGoal,          channel: "sfx", paths: ["assets/audio/sfx/goal.mp3"] },
  // { key: AUDIO_KEYS.sfxMicCalibrated, channel: "sfx", paths: ["assets/audio/sfx/mic-calibrated.mp3"] },
  // { key: AUDIO_KEYS.sfxUiClick,       channel: "sfx", paths: ["assets/audio/sfx/ui-click.mp3"] },
]);

/*
 * 이벤트 → 효과음 매핑. 기획서 §12 피드백 표에서 도출.
 * key가 함수면 payload를 받아 키를 고른다(점프 3종처럼 payload에 따라 달라지는 경우).
 */
const SFX_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.COMMAND_RECOGNIZED, key: AUDIO_KEYS.sfxCommandOk }),
  Object.freeze({ event: GAME_EVENTS.COMMAND_REJECTED, key: AUDIO_KEYS.sfxCommandFail }),
  Object.freeze({
    event: GAME_EVENTS.PLAYER_JUMP,
    key: (payload) =>
      ({
        LOW: AUDIO_KEYS.sfxJumpLow,
        MID: AUDIO_KEYS.sfxJumpMid,
        HIGH: AUDIO_KEYS.sfxJumpHigh,
      })[payload?.level] || AUDIO_KEYS.sfxJumpMid,
  }),
  Object.freeze({ event: GAME_EVENTS.PLAYER_LAND, key: AUDIO_KEYS.sfxLand }),
  Object.freeze({ event: GAME_EVENTS.PLAYER_HIT_OBSTACLE, key: AUDIO_KEYS.sfxHit }),
  Object.freeze({ event: GAME_EVENTS.TIMER_WARNING, key: AUDIO_KEYS.sfxTimerWarning }),
  Object.freeze({ event: GAME_EVENTS.STAGE_CLEAR, key: AUDIO_KEYS.sfxGoal }),
  Object.freeze({ event: GAME_EVENTS.MIC_CALIBRATED, key: AUDIO_KEYS.sfxMicCalibrated }),
]);

// 이벤트 → BGM 매핑.
const BGM_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.STAGE_START, key: AUDIO_KEYS.bgmStage, loop: true }),
  Object.freeze({ event: GAME_EVENTS.STAGE_CLEAR, key: AUDIO_KEYS.bgmClear, loop: false }),
  Object.freeze({ event: GAME_EVENTS.STAGE_FAIL, key: AUDIO_KEYS.bgmFail, loop: false }),
]);
