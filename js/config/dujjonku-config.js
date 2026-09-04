/* 두쫀쿠 스테이지 전용 설정. 기존 거제 스테이지 밸런스와 물리를 건드리지 않는다. */

const DUJJONKU_CONFIG = Object.freeze({
  timeMs: 20260,
  warningMs: 2260,
  shots: 6,
  charge: Object.freeze({
    minMs: 180,
    maxMs: 1900,
    minimumPercent: 12,
  }),
  launcher: Object.freeze({
    x: 390,
    y: 742,
    minAngle: 22,
    maxAngle: 58,
    angleSweepMs: 3100,
    minPower: 10.5,
    maxPower: 24,
  }),
  voice: Object.freeze({
    fftSize: 1024,
    smoothing: 0.72,
    noiseSampleMs: 850,
    startHoldMs: 55,
    silenceHoldMs: 180,
    thresholdMultiplier: 2.35,
    thresholdOffset: 0.01,
    minimumThreshold: 0.018,
    cooldownMs: 520,
  }),
  projectile: Object.freeze({
    radius: 29,
    settleSpeed: 0.32,
    settleMs: 850,
    resetDelayMs: 520,
  }),
});
