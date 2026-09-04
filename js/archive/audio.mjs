class ArchiveAudio {
  constructor() {
    this.context = null;
    this.volume = 0.55;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
  }

  ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.context = new AudioContext();
    }
    if (this.context?.state === "suspended") this.context.resume();
    return this.context;
  }

  tone(frequency, duration = 0.08, type = "sine", gain = 0.12, slide = 0) {
    if (this.volume <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    amplifier.gain.setValueAtTime(Math.max(0.0001, gain * this.volume), now);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amplifier).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  play(name) {
    if (name === "click") this.tone(420, 0.05, "square", 0.05, 90);
    if (name === "action") this.tone(260, 0.06, "triangle", 0.055, 65);
    if (name === "warning") this.tone(150, 0.11, "sawtooth", 0.065, -35);
    if (name === "hit") this.tone(620, 0.09, "square", 0.055, 250);
    if (name === "success") {
      this.tone(440, 0.16, "sine", 0.07, 220);
      window.setTimeout(() => this.tone(660, 0.22, "sine", 0.07, 220), 90);
    }
    if (name === "failure") this.tone(210, 0.3, "sawtooth", 0.06, -100);
  }
}

export const audio = new ArchiveAudio();


