/*
 * C2(사운드) 전용 — 오디오 에셋 키↔경로 매핑과 이벤트 연결.
 *
 * 게임별 BGM은 네이티브 Audio 크로스페이드 재생기가 맡고
 * js/audio/audio-tuning.js에서 경로와 밸런스를 관리한다.
 * 이 매니페스트는 납품되는 파일형 SFX를 Phaser 캐시에 올리는 용도다.
 * 재생 계층은 캐시에 없는 키를 조용히 무시하므로, 일부만 채워도 안전하다.
 *
 * 옛 스테이지의 명령·점프·충돌 효과음은 게임을 새로 정하면서 걷어냈다.
 * 조작이 정해지면 그 이벤트에 맞는 키를 여기에 다시 추가한다.
 */

const AUDIO_KEYS = Object.freeze({
  sfxTimerWarning: "sfxTimerWarning",
  sfxUiClick: "sfxUiClick",
});

// 브라우저 호환을 위해 mp3 + ogg 두 벌을 배열로 준다. Phaser가 지원 포맷을 고른다.
const AUDIO_MANIFEST = Object.freeze([
  // 예: { key: AUDIO_KEYS.sfxTimerWarning, channel: "sfx", paths: [납품된 WAV 경로] },
]);

/*
 * 이벤트 → 효과음 매핑.
 * key가 함수면 payload를 받아 키를 고른다(payload에 따라 소리가 달라지는 경우).
 */
const SFX_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.TIMER_WARNING, key: AUDIO_KEYS.sfxTimerWarning }),
]);

/* 실제 WAV를 받기 전에도 이벤트와 밸런스를 검증할 수 있는 합성음 폴백. */
const SFX_SYNTH_FALLBACKS = Object.freeze({
  [AUDIO_KEYS.sfxTimerWarning]: "warning",
  [AUDIO_KEYS.sfxUiClick]: "click",
});

// 게임별 BGM은 ArchiveAudio.selectBgm(stageId)가 맡는다.
const BGM_EVENT_MAP = Object.freeze([]);
