/*
 * C2(사운드) 전용 — 오디오 에셋 키↔경로 매핑과 이벤트 연결.
 *
 * 게임별 BGM은 네이티브 Audio 크로스페이드 재생기가 맡고
 * js/audio/audio-tuning.js에서 경로와 밸런스를 관리한다.
 * 이 매니페스트는 SFX의 안정적인 코드 키와 납품 파일명을 한곳에서 연결한다.
 * 아카이브 게임에서는 file:// 호환 네이티브 풀로 재생하고, Phaser 장면에서는
 * 같은 목록을 캐시에 올려 쓸 수 있다.
 */

const AUDIO_KEYS = Object.freeze({
  sfxCharacterRevival: "sfxCharacterRevival",
  sfxClick: "sfxClick",
  sfxPenaltyHit: "sfxPenaltyHit",
  sfxStageClear: "sfxStageClear",
  sfxStageFail: "sfxStageFail",
  sfxTimerWarning: "sfxTimerWarning",
  sfxDubaiStretch: "sfxDubaiStretch",
  sfxE1GravityFlip: "sfxE1GravityFlip",
  sfxE2WaxCrack1: "sfxE2WaxCrack1",
  sfxE2WaxCrack2: "sfxE2WaxCrack2",
  sfxE2WaxDrop: "sfxE2WaxDrop",
  sfxE2WaxJump: "sfxE2WaxJump",
  sfxE3SuccessCount: "sfxE3SuccessCount",
  sfxE3PersonFall: "sfxE3PersonFall",
  sfxE4Walk1: "sfxE4Walk1",
  sfxE4Walk2: "sfxE4Walk2",
  sfxE4Brake: "sfxE4Brake",
  sfxE4TigerFast: "sfxE4TigerFast",
  sfxE4TigerSlow: "sfxE4TigerSlow",
  sfxE5RubberStretch: "sfxE5RubberStretch",
  sfxE5Release: "sfxE5Release",
  sfxE5Broken1: "sfxE5Broken1",
  sfxE5Broken2: "sfxE5Broken2",
  sfxE6Lift1: "sfxE6Lift1",
  sfxE6Lift2: "sfxE6Lift2",
  sfxE7Tick: "sfxE7Tick",
  sfxE7Start: "sfxE7Start",
  sfxE8WebAttach: "sfxE8WebAttach",
  sfxE10DigitWrong: "sfxE10DigitWrong",
  sfxE10Jump: "sfxE10Jump",
  sfxE10TouchNumber: "sfxE10TouchNumber",
});

// 파일명은 전달본 그대로 두고, 코드에서는 안정적인 키만 사용한다.
const AUDIO_MANIFEST = Object.freeze([
  [AUDIO_KEYS.sfxCharacterRevival, "sounds/sfx/sfx_character_revival.MP3"],
  [AUDIO_KEYS.sfxClick, "sounds/sfx/sfx_click.MP3"],
  [AUDIO_KEYS.sfxPenaltyHit, "sounds/sfx/sfx_common_penalty_hit.MP3"],
  [AUDIO_KEYS.sfxStageClear, "sounds/sfx/sfx_common_stage_clear(1).MP3"],
  [AUDIO_KEYS.sfxStageFail, "sounds/sfx/sfx_common_stage_fail.MP3"],
  [AUDIO_KEYS.sfxTimerWarning, "sounds/sfx/sfx_common_timer_warning.MP3"],
  [AUDIO_KEYS.sfxDubaiStretch, "sounds/sfx/sfx_dubaistretch.MP3"],
  [AUDIO_KEYS.sfxE1GravityFlip, "sounds/sfx/sfx_e1_gravity_flip.MP3"],
  [AUDIO_KEYS.sfxE2WaxCrack1, "sounds/sfx/sfx_e2_wax_crack1.MP3"],
  [AUDIO_KEYS.sfxE2WaxCrack2, "sounds/sfx/sfx_e2_wax_crack2.MP3"],
  [AUDIO_KEYS.sfxE2WaxDrop, "sounds/sfx/sfx_e2_wax_drop.MP3"],
  [AUDIO_KEYS.sfxE2WaxJump, "sounds/sfx/sfx_e2_wax_jump.MP3"],
  [AUDIO_KEYS.sfxE3SuccessCount, "sounds/sfx/sfx_e3_success_count.MP3"],
  [AUDIO_KEYS.sfxE3PersonFall, "sounds/sfx/sfx_e3_person_fall.MP3"],
  [AUDIO_KEYS.sfxE4Walk1, "sounds/sfx/sfx_e4man_walk1.MP3"],
  [AUDIO_KEYS.sfxE4Walk2, "sounds/sfx/sfx_e4man_walk2.MP3"],
  [AUDIO_KEYS.sfxE4Brake, "sounds/sfx/sfx_e4manbrake.MP3"],
  [AUDIO_KEYS.sfxE4TigerFast, "sounds/sfx/sfx_tiger fast.MP3"],
  [AUDIO_KEYS.sfxE4TigerSlow, "sounds/sfx/sfx_tiger_slow.MP3"],
  [AUDIO_KEYS.sfxE5RubberStretch, "sounds/sfx/sfx_e5_rubber_stretch.MP3"],
  [AUDIO_KEYS.sfxE5Release, "sounds/sfx/sfx_e5_slingshot_release.MP3"],
  [AUDIO_KEYS.sfxE5Broken1, "sounds/sfx/sfx_e5_broken1.MP3"],
  [AUDIO_KEYS.sfxE5Broken2, "sounds/sfx/sfx_e5_broken2.MP3"],
  [AUDIO_KEYS.sfxE6Lift1, "sounds/sfx/sfx_e6_lift_catsound1.MP3"],
  [AUDIO_KEYS.sfxE6Lift2, "sounds/sfx/sfx_e6_lift_catsound2.MP3"],
  [AUDIO_KEYS.sfxE7Tick, "sounds/sfx/sfx_e7_roulette_tick.MP3"],
  [AUDIO_KEYS.sfxE7Start, "sounds/sfx/sfx_e7_roullette_start.MP3"],
  [AUDIO_KEYS.sfxE8WebAttach, "sounds/sfx/sfx_e8_web_attach.MP3"],
  [AUDIO_KEYS.sfxE10DigitWrong, "sounds/sfx/sfx_e10_digit_wrong.MP3"],
  [AUDIO_KEYS.sfxE10Jump, "sounds/sfx/sfx_e10_spin_jump(1).MP3"],
  [AUDIO_KEYS.sfxE10TouchNumber, "sounds/sfx/sfx_e10_touch_number.MP3"],
].map(([key, path]) => Object.freeze({ key, channel: "sfx", paths: [path] })));
globalThis.ARCHIVE_AUDIO_PATHS = Object.freeze(Object.fromEntries(AUDIO_MANIFEST.map(entry => [entry.key, entry.paths[0]])));

/*
 * 이벤트 → 효과음 매핑.
 * key가 함수면 payload를 받아 키를 고른다(payload에 따라 소리가 달라지는 경우).
 */
const SFX_EVENT_MAP = Object.freeze([
  Object.freeze({ event: GAME_EVENTS.TIMER_WARNING, key: AUDIO_KEYS.sfxTimerWarning }),
  Object.freeze({ event: GAME_EVENTS.STAGE_RESPAWN, key: AUDIO_KEYS.sfxCharacterRevival }),
]);

/* 실제 WAV를 받기 전에도 이벤트와 밸런스를 검증할 수 있는 합성음 폴백. */
const SFX_SYNTH_FALLBACKS = Object.freeze({
  [AUDIO_KEYS.sfxTimerWarning]: "warning",
  [AUDIO_KEYS.sfxClick]: "click",
});

// 게임별 BGM은 ArchiveAudio.selectBgm(stageId)가 맡는다.
const BGM_EVENT_MAP = Object.freeze([]);
