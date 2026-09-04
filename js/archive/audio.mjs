class ArchiveAudio {
  constructor() {
    this.context = null;
    this.volume = 0.55;
    this.bgm = new Audio("sounds/bgm/bgm_intro.mp3");
    this.bgm.loop = true;
    this.bgm.preload = "auto";
    this.bgm.volume = 0;
    this.bgmStarted = false;
    this.bgmUnlockEvents = ["pointerdown", "pointerup", "click", "keydown"];
    this.unlockBgm = () => this.startBgm();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
  }

  setBgmVolume(value) {
    this.bgm.volume = Math.max(0, Math.min(1, Number(value)));
  }

  startBgm() {
    this.bgmStarted = true;
    // Register before play settles so an early click or touch is never missed.
    this.bgmUnlockEvents.forEach((event) => document.addEventListener(event, this.unlockBgm));
    if (this.bgm.error) this.bgm.load();
    return this.bgm.play().then(() => {
      this.bgmUnlockEvents.forEach((event) => document.removeEventListener(event, this.unlockBgm));
      return true;
    }).catch((error) => {
      if (this.bgmStarted && error.name !== "NotAllowedError" && error.name !== "AbortError") {
        console.warn("[audio] BGM playback failed; retrying on the next input.", error);
      }
      return false;
    });
  }

  stopBgm() {
    this.bgmStarted = false;
    this.bgmUnlockEvents.forEach((event) => document.removeEventListener(event, this.unlockBgm));
    this.bgm.pause();
  }

  ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.context = new AudioContext();
    }
    if (this.context?.state === "suspended") this.context.resume().catch(() => {});
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


