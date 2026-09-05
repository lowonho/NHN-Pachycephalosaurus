/*
 * 사운드 밸런스의 단일 조정 지점.
 *
 * 게임 코드는 트랙 경로와 음량 수치를 직접 갖지 않는다. BGM 교체, 트랙별 게인,
 * 크로스페이드, 합성 SFX는 모두 여기서 바꾸면 즉시 반영된다. 개발 중에는
 * index.html?audioLab=1 을 열어 같은 값을 귀로 맞추고 브라우저에 저장할 수 있다.
 */

const AUDIO_TUNING_STORAGE_KEY = "archive-2026-audio-lab-v1";

const ARCHIVE_AUDIO_TUNING_DEFAULTS = Object.freeze({
  bgm: {
    fadeMs: 650,
    tracks: {
      main: { label: "메인", path: "sounds/bgm/bgm_main_theme.mp3", gain: 0.72, loopStart: 0, loopEnd: null },
      e1: { label: "E1 중력 대쉬", path: "sounds/bgm/e1 bgm_yaho.mp3", gain: 0.68, loopStart: 0, loopEnd: null },
      e2: { label: "E2 왁뿌볼", path: "sounds/bgm/e2 왁뿌볼 확정해버려.mp3", gain: 0.68, loopStart: 0, loopEnd: null },
      e3: { label: "E3 사람 쌓기", path: "sounds/bgm/e3 메챠!_ 확정직전.mp3", gain: 0.66, loopStart: 0, loopEnd: null },
      e4: { label: "E4 호랑이 추격", path: "sounds/bgm/e4 bgm_tiger.mp3", gain: 0.7, loopStart: 0, loopEnd: null },
      e5: { label: "E5 두쫀쿠 새총", path: "sounds/bgm/e5 bgm_dubai.mp3", gain: 0.66, loopStart: 0, loopEnd: null },
      e6: { label: "E6 중력 비행", path: "sounds/bgm/e6 oiio 유행어2.mp3", gain: 0.64, loopStart: 0, loopEnd: null },
      e7: { label: "E7 월드컵 조추첨", path: "sounds/bgm/e7 월드컵 조추첨 홍명보.mp3", gain: 0.66, loopStart: 0, loopEnd: null },
      e8: { label: "E8 거미줄 질주", path: "sounds/bgm/e8 스파이더맨홈커밍 확정피터.mp3", gain: 0.68, loopStart: 0, loopEnd: null },
      e9: { label: "E9 아이스 컬링", path: "sounds/bgm/e9 우당탕탕 밈축제5.mp3", gain: 0.66, loopStart: 0, loopEnd: null },
      e10: { label: "E10 피겨 암호", path: "sounds/bgm/e10 피겨4등 차준환확정 완.mp3", gain: 0.66, loopStart: 0, loopEnd: null },
    },
  },
  sfx: {
    throttleMs: 55,
    /* WAV가 등록되면 key: { gain, rate, throttleMs }를 넣어 파일별로 조정한다. */
    files: {},
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
