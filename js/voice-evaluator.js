class VoiceEvaluator {
  constructor(lowThreshold = -2.2, highThreshold = 2.2) {
    this.lowThreshold = lowThreshold;
    this.highThreshold = highThreshold;
  }

  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  }

  trimOutliers(values) {
    if (!values.length) return [];
    const center = this.median(values);
    return values.filter((value) => value > center * 0.72 && value < center * 1.38);
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
