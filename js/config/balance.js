/*
 * 기능(B) 전용 — 물리·타이밍 밸런스.
 * 이 값을 바꾸면 클리어 난이도가 변한다. 아트/사운드는 참조만 하고 수정하지 않는다.
 */

const BALANCE = Object.freeze({
  stage: Object.freeze({
    timeMs: 20260,
    warningMs: 5000, // 남은 시간이 이 아래로 내려가면 TIMER_WARNING 1회 발행
    resultDelayMs: 500,
  }),

  physics: Object.freeze({
    gravityY: 2325,
    moveSpeed: 368,
    moveSpeedMin: 260,
    moveSpeedMax: 520,
    maxVelocityX: 560,
    maxVelocityY: 1500,
    dragX: 1875,
    jumpPower: Object.freeze({ LOW: -765, MID: -975, HIGH: -1238 }),
  }),

  voice: Object.freeze({
    commandCooldownMs: 700,
    pitchMinHz: 70,
    pitchMaxHz: 520,
    rmsGate: 0.018,
    correlationThreshold: 0.2,
    fftSize: 2048,
    smoothingTimeConstant: 0.2,
    recentWindowMs: 1200,
    medianWindowMs: 900,
    volumeWindowMs: 1600,
    movementVolumeMinRms: 0.02,
    movementVolumeMaxRms: 0.12,
    restartDelayMs: 160,
    defaultBasePitchHz: 180,
  }),

  calibration: Object.freeze({
    durationMs: 2400,
    minSamples: 12,
    lowThresholdSemitones: -2.2,
    highThresholdSemitones: 2.2,
    outlierLowRatio: 0.72,
    outlierHighRatio: 1.38,
  }),

  // 거제 야호 스테이지 전용. 공통 물리·타이머·음성 값은 위 설정을 그대로 쓴다.
  geoje: Object.freeze({
    slipperyDragX: 260,
    fishingDurationMs: 1500,
    fallRecoveryMs: 340,
    netStunMs: 430,
    netCooldownMs: 1000,
    netKnockbackX: -145,
    netKnockbackY: -230,
    movingPlatformPeriodMs: 2900,
    tiltDelayMs: 520,
    tiltSlideSpeed: 430,
  }),
});
