/*
 * C2(사운드) 전용 — 오디오 에셋 키↔경로 매핑과 이벤트 연결.
 *
 * 현재 로드되는 오디오 파일이 하나도 없으므로 ACTIVE 목록은 비어 있다.
 * (sounds/bgm/*.mp3 파일이 저장소에 있지만 아직 어느 스테이지에도 붙지 않았다.
 *  쓸 곳이 정해지면 assets/audio/로 옮기고 아래 목록에 등록한다.)
 * 재생 계층은 캐시에 없는 키를 조용히 무시하므로, 일부만 채워도 안전하다.
 *
 * 옛 스테이지의 명령·점프·충돌 효과음은 게임을 새로 정하면서 걷어냈다.
 * 조작이 정해지면 그 이벤트에 맞는 키를 여기에 다시 추가한다.
 */

const AUDIO_KEYS = Object.freeze({
  bgmStage: "bgmStage",
  bgmClear: "bgmClear",
  bgmFail: "bgmFail",

  sfxTimerWarning: "sfxTimerWarning",
  sfxUiClick: "sfxUiClick",
});

// 브라우저 호환을 위해 mp3 + ogg 두 벌을 배열로 준다. Phaser가 지원 포맷을 고른다.
const AUDIO_MANIFEST = Object.freeze([
  // ── 파일을 넣은 뒤 주석을 해제한다 ────────────────────────────────
  // { key: AUDIO_KEYS.bgmStage,        channel: "bgm", paths: ["assets/audio/bgm/stage.mp3",        "assets/audio/bgm/stage.ogg"] },
  // { key: AUDIO_KEYS.bgmClear,        channel: "bgm", paths: ["assets/audio/bgm/result-clear.mp3", "assets/audio/bgm/result-clear.ogg"] },
  // { key: AUDIO_KEYS.bgmFail,         channel: "bgm", paths: ["assets/audio/bgm/result-fail.mp3",  "assets/audio/bgm/result-fail.ogg"] },
  // { key: AUDIO_KEYS.sfxTimerWarning, channel: "sfx", paths: ["assets/audio/sfx/timer-warning.mp3"] },
  // { key: AUDIO_KEYS.sfxUiClick,      channel: "sfx", paths: ["assets/audio/sfx/ui-click.mp3"] },
]);

/*
 * 이벤트 → 효과음 매핑.
 * key가 함수면 payload를 받아 키를 고른다(payload에 따라 소리가 달라지는 경우).
 */
const SFX_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.TIMER_WARNING, key: AUDIO_KEYS.sfxTimerWarning }),
]);

// 이벤트 → BGM 매핑.
const BGM_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.STAGE_START, key: AUDIO_KEYS.bgmStage, loop: true }),
  Object.freeze({ event: GAME_EVENTS.STAGE_CLEAR, key: AUDIO_KEYS.bgmClear, loop: false }),
  Object.freeze({ event: GAME_EVENTS.STAGE_FAIL, key: AUDIO_KEYS.bgmFail, loop: false }),
]);
