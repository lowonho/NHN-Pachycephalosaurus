/* 두쫀쿠 스테이지 전용 설정. 기존 거제 스테이지 밸런스와 물리를 건드리지 않는다. */

const DUJJONKU_CONFIG = Object.freeze({
  timeMs: 20260,
  warningMs: 2260,
  shots: 6,
  charge: Object.freeze({
    minMs: 180,
    maxMs: 3000,
    breakMs: 5000,
    breakResetDelayMs: 850,
    minimumPercent: 12,
  }),
  launcher: Object.freeze({
    x: 390,
    y: 742,
    minAngle: 22,
    maxAngle: 58,
    angleSweepMs: 4400,
    minPower: 13.5,
    maxPower: 30,
  }),
  voice: Object.freeze({
    fftSize: 1024,
    smoothing: 0.72,
    noiseSampleMs: 850,
    startHoldMs: 55,
    silenceHoldMs: 260,
    activeThresholdRatio: 0.7,
    thresholdMultiplier: 2.35,
    thresholdOffset: 0.01,
    minimumThreshold: 0.018,
    cooldownMs: 520,
  }),
  projectile: Object.freeze({
    radius: 29,
    settleSpeed: 0.38,
    settleMs: 900,
    maxFlightMs: 4200,
    resetDelayMs: 520,
  }),
});
