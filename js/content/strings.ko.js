/*
 * 화면에 출력되는 모든 한국어 문구.
 * JS가 주입하는 문자열만 여기에 둔다. index.html의 정적 마크업 문구는 HTML에 남긴다.
 * (첫 페인트 지연을 피하기 위한 의도적 예외 — 명령어 카드만 command-dict를 단일 출처로 쓴다.)
 */

const STRINGS = Object.freeze({
  intro: Object.freeze({
    step: "STAGE 01",
    title: "목소리로 포토존까지!",
    copy: "먼저 편안한 중간음을 측정합니다. 측정된 목소리를 기준으로 낮은 음·중간 음·높은 음을 나눠 점프 높이에 반영해요.",
  }),

  status: Object.freeze({
    idle: "마이크 연결 전",
    measuring: "마이크 연결됨 · 중간음 측정 중",
    calibrated: (hz) => `중간음 ${hz} Hz 설정 완료`,
    listening: "듣는 중 · 명령어를 말해보세요",
    recognitionUnsupported: "음성 인식 미지원 · 키보드 테스트 중",
    recognitionUnavailable: "음성 인식 미지원 · 키보드 테스트 가능",
    keyboardMode: "키보드 테스트 중",
    recognitionDenied: "음성 인식 권한이 필요해요",
    micDenied: "마이크 권한 확인 필요",
    clear: (elapsed) => `CLEAR · ${elapsed}초`,
    timeOver: "TIME OVER",
  }),

  calibration: Object.freeze({
    step: "VOICE SETUP",
    title: "편하게 ‘아—’ 해보세요",
    copy: "2.4초 동안 평소 말할 때의 편안한 높이로 길게 소리 내주세요.",
    listening: "중간음을 듣고 있어요…",

    failTitle: "목소리가 잘 안 들렸어요",
    failCopy: "마이크 가까이에서 편안하게 ‘아—’ 하고 다시 말해주세요.",
    failResult: "충분한 음높이를 측정하지 못했습니다.",

    doneTitle: "중간음 설정 완료!",
    doneCopyHtml:
      "<b>오이데</b>로 출발 → <b>야호</b>로 점프 → <b>파라파라</b>로 방향 전환<br>포토존 안에서 <b>오이쉬이</b>를 외치세요.",
    doneResult: (hz) => `내 기준음 ${hz} Hz · 야호를 높게 말하면 더 높이 점프!`,

    errorTitle: "마이크를 연결할 수 없어요",
    errorCopy: "브라우저 주소창의 마이크 권한을 허용한 뒤 다시 시도해주세요.",
    errorFallback: "마이크 권한을 확인해주세요.",
  }),

  result: Object.freeze({
    clearStep: "STAGE CLEAR",
    clearTitle: "거제~ 야호! 📸",
    clearCopy: (elapsed) => `${elapsed}초 만에 포토존 골인! 다음에는 더 빠르게 가볼까요?`,
    clearResult: "CLEAR",

    failStep: "TIME OVER",
    failTitle: "포토존이 코앞인데!",
    failCopy: "20.26초가 끝났어요. 오이데로 출발하고 포토존 안에서 오이쉬이를 외쳐보세요.",
    failResult: "다시 하면 감이 올 거예요.",
  }),

  buttons: Object.freeze({
    connect: "마이크 연결하고 시작",
    retryCalibration: "다시 측정",
    reconnect: "다시 연결",
    start: "20.26초 도전 시작",
    main: "메인 화면으로",
    retryStage: "다시 도전",
    keyboard: "마이크 없이 키보드로 테스트",
    continueKeyboard: "키보드 모드로 계속",
    recalibrate: "중간음 다시 측정",
  }),

  stage: Object.freeze({
    label: "STAGE 01  ·  GEOJE",
    goal: "포토존 안에서 오이쉬이를 외쳐!",
    photoZone: "PHOTO\nZONE",
    obstacleTier: Object.freeze({ LOW: "LOW", HIGH: "HIGH" }),
  }),
});
