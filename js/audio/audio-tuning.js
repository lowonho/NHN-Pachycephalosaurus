/*
 * 사운드 밸런스의 단일 조정 지점.
 *
 * 게임 코드는 트랙 경로와 음량 수치를 직접 갖지 않는다. BGM 교체, 트랙별 게인,
 * 크로스페이드, 합성 SFX는 모두 여기서 바꾸면 즉시 반영된다. 개발 중에는
 * index.html?audioLab=1 을 열어 같은 값을 귀로 맞추고 브라우저에 저장할 수 있다.
 */

const AUDIO_TUNING_STORAGE_KEY = "archive-2026-audio-lab-v2";

const ARCHIVE_AUDIO_TUNING_DEFAULTS = Object.freeze({
  bgm: {
    fadeMs: 425,
    tracks: {
      main: { label: "메인", path: "sounds/bgm/bgm_main_theme.mp3", gain: 0.47, loopStart: 0, loopEnd: null },
      e1: { label: "E1 중력 대쉬", path: "sounds/bgm/e1 bgm_yaho.mp3", gain: 0.53, loopStart: 0, loopEnd: null },
      e2: { label: "E2 왁뿌볼", path: "sounds/bgm/e2 왁뿌볼 확정해버려.mp3", gain: 0.49, loopStart: 0, loopEnd: null },
      e3: { label: "E3 사람 쌓기", path: "sounds/bgm/e3 메챠!_ 확정직전.mp3", gain: 0.56, loopStart: 0, loopEnd: null },
      e4: { label: "E4 호랑이 추격", path: "sounds/bgm/e4 bgm_tiger.mp3", gain: 0.56, loopStart: 0, loopEnd: null },
      e5: { label: "E5 두쫀쿠 새총", path: "sounds/bgm/e5 bgm_dubai.mp3", gain: 0.55, loopStart: 0, loopEnd: null },
      e6: { label: "E6 중력 비행", path: "sounds/bgm/e6 oiio 유행어2.mp3", gain: 0.54, loopStart: 0, loopEnd: null },
      e7: { label: "E7 월드컵 조추첨", path: "sounds/bgm/e7 월드컵 조추첨 홍명보.mp3", gain: 0.4, loopStart: 0, loopEnd: null },
      e8: { label: "E8 거미줄 질주", path: "sounds/bgm/e8 스파이더맨홈커밍 확정피터.mp3", gain: 0.51, loopStart: 0, loopEnd: null },
      e10: { label: "E10 피겨 암호", path: "sounds/bgm/e10 피겨4등 차준환확정 완.mp3", gain: 0.57, loopStart: 0, loopEnd: null },
    },
  },
  sfx: {
    throttleMs: 55,
    /* 파일 게인은 원본 레벨과 반복 밀도까지 감안한 게임 안 체감값이다. */
    files: {
      sfxCharacterRevival: { label: "공통 · 부활", gain: 0.72, rate: 1, throttleMs: 250 },
      sfxClick: { label: "공통 · 클릭", gain: 0.55, rate: 1, throttleMs: 55 },
      sfxPenaltyHit: { label: "공통 · 충돌/페널티", gain: 0.68, rate: 1, throttleMs: 90 },
      sfxStageClear: { label: "공통 · 스테이지 성공", gain: 0.78, rate: 1, throttleMs: 500 },
      sfxStageFail: { label: "공통 · 스테이지 실패", gain: 0.72, rate: 1, throttleMs: 500 },
      sfxTimerWarning: { label: "공통 · 5초 경고", gain: 1.15, rate: 1, throttleMs: 500 },
      sfxDubaiStretch: { label: "E5 · 두바이 쫀득 충돌", gain: 1, rate: 1, throttleMs: 120 },
      sfxE1GravityFlip: { label: "E1 · 중력 반전", gain: 0.62, rate: 1, throttleMs: 80 },
      sfxE2WaxCrack1: { label: "E2 · 껍질 균열 1", gain: 0.95, rate: 1, throttleMs: 120 },
      sfxE2WaxCrack2: { label: "E2 · 껍질 균열 2", gain: 1.05, rate: 1, throttleMs: 120 },
      sfxE2WaxDrop: { label: "E2 · 발판 낙하", gain: 0.38, rate: 1, throttleMs: 180 },
      sfxE2WaxJump: { label: "E2 · 점프", gain: 0.5, rate: 1, throttleMs: 75 },
      sfxE3CountThree: { label: "E3 · 세 명 카운트", gain: 0.62, rate: 1, throttleMs: 2500, maxVoices: 1 },
      sfxE3PersonFall: { label: "E3 · 사람 낙하", gain: 0.48, rate: 1, throttleMs: 100 },
      sfxE4Walk1: { label: "E4 · 인물 발걸음 1", gain: 0.8, rate: 1, throttleMs: 80 },
      sfxE4Walk2: { label: "E4 · 인물 발걸음 2", gain: 0.95, rate: 1, throttleMs: 80 },
      sfxE4Brake: { label: "E4 · 인물 제동", gain: 0.9, rate: 1, throttleMs: 220 },
      sfxE4TigerFast: { label: "E4 · 호랑이 질주", gain: 0.42, rate: 1, throttleMs: 250 },
      sfxE4TigerSlow: { label: "E4 · 호랑이 추격", gain: 0.4, rate: 1, throttleMs: 250 },
      sfxE5RubberStretch: { label: "E5 · 고무줄 당김", gain: 1, rate: 1, throttleMs: 150 },
      sfxE5Release: { label: "E5 · 새총 발사", gain: 0.6, rate: 1, throttleMs: 120 },
      sfxE6Lift1: { label: "E6 · 고양이 상승 1", gain: 0.48, rate: 1, throttleMs: 100 },
      sfxE6Lift2: { label: "E6 · 고양이 상승 2", gain: 0.48, rate: 1, throttleMs: 100 },
      sfxE7Tick: { label: "E7 · 룰렛 틱", gain: 0.85, rate: 1, throttleMs: 45 },
      sfxE7Start: { label: "E7 · 룰렛 시작", gain: 0.55, rate: 1, throttleMs: 180 },
      sfxE8WebAttach: { label: "E8 · 거미줄 부착", gain: 0.75, rate: 1, throttleMs: 80 },
      sfxE10DigitWrong: { label: "E10 · 오답", gain: 0.62, rate: 1, throttleMs: 220 },
      sfxE10SpinJump: { label: "E10 · 회전 점프", gain: 0.7, rate: 1, throttleMs: 100 },
      sfxE10SpinJumpAlt: { label: "E10 · 회전 점프 후보", gain: 0.5, rate: 1, throttleMs: 100 },
    },
    presets: {
      click: { label: "UI / 카운트", voices: [{ frequency: 420, duration: 0.05, type: "square", gain: 0.05, slide: 90 }] },
      action: { label: "기본 액션", voices: [{ frequency: 260, duration: 0.06, type: "triangle", gain: 0.055, slide: 65 }] },
      warning: { label: "경고 / 시간 손실", voices: [{ frequency: 150, duration: 0.11, type: "sawtooth", gain: 0.065, slide: -35 }] },
      hit: { label: "충돌 / 시작", voices: [{ frequency: 620, duration: 0.09, type: "square", gain: 0.055, slide: 250 }] },
      success: {
        label: "성공",
        voices: [
          { frequency: 440, duration: 0.16, type: "sine", gain: 0.07, slide: 220 },
          { delayMs: 90, frequency: 660, duration: 0.22, type: "sine", gain: 0.07, slide: 220 },
        ],
      },
      failure: { label: "실패", voices: [{ frequency: 210, duration: 0.3, type: "sawtooth", gain: 0.06, slide: -100 }] },
    },
  },
});

function cloneAudioTuning(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeAudioTuning(base, saved) {
  const merged = cloneAudioTuning(base);
  if (!saved || typeof saved !== "object") return merged;
  if (Number.isFinite(saved.bgm?.fadeMs)) merged.bgm.fadeMs = saved.bgm.fadeMs;
  Object.entries(saved.bgm?.tracks ?? {}).forEach(([key, values]) => {
    if (merged.bgm.tracks[key]) Object.assign(merged.bgm.tracks[key], values);
  });
  if (Number.isFinite(saved.sfx?.throttleMs)) merged.sfx.throttleMs = saved.sfx.throttleMs;
  Object.entries(saved.sfx?.files ?? {}).forEach(([key, values]) => {
    merged.sfx.files[key] = { ...(merged.sfx.files[key] ?? {}), ...values };
  });
  Object.entries(saved.sfx?.presets ?? {}).forEach(([key, values]) => {
    if (merged.sfx.presets[key]) Object.assign(merged.sfx.presets[key], values);
  });
  return merged;
}

function loadAudioTuning() {
  try {
    return mergeAudioTuning(ARCHIVE_AUDIO_TUNING_DEFAULTS, JSON.parse(localStorage.getItem(AUDIO_TUNING_STORAGE_KEY) || "null"));
  } catch {
    return cloneAudioTuning(ARCHIVE_AUDIO_TUNING_DEFAULTS);
  }
}

globalThis.ARCHIVE_AUDIO_TUNING = loadAudioTuning();
globalThis.archiveAudioTuning = {
  defaults: ARCHIVE_AUDIO_TUNING_DEFAULTS,
  save() {
    try { localStorage.setItem(AUDIO_TUNING_STORAGE_KEY, JSON.stringify(globalThis.ARCHIVE_AUDIO_TUNING)); } catch { /* 현재 탭에서 계속 조정 */ }
  },
  reset() {
    globalThis.ARCHIVE_AUDIO_TUNING = cloneAudioTuning(ARCHIVE_AUDIO_TUNING_DEFAULTS);
    try { localStorage.removeItem(AUDIO_TUNING_STORAGE_KEY); } catch { /* 현재 탭에서 계속 조정 */ }
    return globalThis.ARCHIVE_AUDIO_TUNING;
  },
};
