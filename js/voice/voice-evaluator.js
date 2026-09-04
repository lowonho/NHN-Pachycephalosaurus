/*
 * C2(음성) 전용 — 순수 계산. DOM도 Phaser도 참조하지 않는다.
 * 임계값은 config/balance.js에서 온다.
 */

class VoiceEvaluator {
  constructor(calibration = BALANCE.calibration) {
    this.lowThreshold = calibration.lowThresholdSemitones;
    this.highThreshold = calibration.highThresholdSemitones;
    this.outlierLowRatio = calibration.outlierLowRatio;
    this.outlierHighRatio = calibration.outlierHighRatio;
  }

  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  }

  trimOutliers(values) {
    if (!values.length) return [];
    const center = this.median(values);
    return values.filter(
      (value) => value > center * this.outlierLowRatio && value < center * this.outlierHighRatio,
    );
  }

  getSemitoneDifference(pitch, basePitch) {
    return 12 * Math.log2(pitch / basePitch);
  }

  getLevel(pitch, basePitch) {
    const difference = this.getSemitoneDifference(pitch, basePitch);
    if (difference < this.lowThreshold) return "LOW";
    if (difference > this.highThreshold) return "HIGH";
    return "MID";
  }
}
