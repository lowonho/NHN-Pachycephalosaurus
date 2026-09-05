/* 게임별 BGM 전환과 파일이 없어도 동작하는 합성 SFX 재생기. */
class ArchiveAudio {
  constructor() {
    this.context = null;
    this.volume = 0.55;
    this.bgmVolume = 0;
    this.bgmKey = "main";
    this.bgmStarted = false;
    this.bgmPaused = false;
    this.fadeFrame = 0;
    this.fadeToken = 0;
    this.sfxTimers = new Set();
    this.lastSfx = new Map();
    this.bgmUnlockEvents = ["pointerdown", "pointerup", "click", "keydown"];
    this.unlockBgm = () => this.startBgm();

    this.bgmSlots = [this.createBgmElement(), this.createBgmElement()];
    this.bgm = this.bgmSlots[0];
    this.loadTrack(this.bgm, this.bgmKey);
  }

  get tuning() {
    return globalThis.ARCHIVE_AUDIO_TUNING ?? { bgm: { fadeMs: 0, tracks: {} }, sfx: { throttleMs: 55, presets: {} } };
  }

  get tracks() {
    return this.tuning.bgm.tracks;
  }

  createBgmElement() {
    const element = new Audio();
    element.loop = true;
    element.preload = "auto";
    element.volume = 0;
    element.addEventListener("timeupdate", () => this.keepCustomLoop(element));
    return element;
  }

  loadTrack(element, key) {
    const track = this.tracks[key] ?? this.tracks.main;
    if (!track) return;
    element.dataset.trackKey = key;
    element.src = track.path;
    element.loop = !this.hasCustomLoop(track);
    element.preload = "auto";
    element.load();
  }

  keepCustomLoop(element) {
    if (element !== this.bgm) return;
    const track = this.tracks[this.bgmKey];
    const loopEnd = Number(track?.loopEnd);
    if (!Number.isFinite(loopEnd) || loopEnd <= 0 || element.currentTime < loopEnd) return;
    element.currentTime = Math.max(0, Number(track.loopStart) || 0);
    if (this.bgmStarted && !this.bgmPaused) element.play().catch(() => {});
  }

  hasCustomLoop(track) {
    return track?.loopEnd !== null && track?.loopEnd !== "" && Number.isFinite(Number(track.loopEnd));
  }

  trackGain(key = this.bgmKey) {
    const gain = Number(this.tracks[key]?.gain);
    return Number.isFinite(gain) ? Math.max(0, Math.min(1.5, gain)) : 1;
  }

  effectiveBgmVolume(key = this.bgmKey) {
    return Math.max(0, Math.min(1, this.bgmVolume * this.trackGain(key)));
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
  }

  setBgmVolume(value) {
    this.bgmVolume = Math.max(0, Math.min(1, Number(value)));
    if (!this.fadeFrame) this.bgm.volume = this.effectiveBgmVolume();
  }

  refreshTuning() {
    const track = this.tracks[this.bgmKey];
    if (track) this.bgm.loop = !this.hasCustomLoop(track);
    this.setBgmVolume(this.bgmVolume);
  }

  selectBgm(key, { restart = false, immediate = false } = {}) {
    if (!this.tracks[key]) key = "main";
    if (this.bgmKey === key) {
      if (restart) this.seekToLoopStart(this.bgm, key);
      if (this.bgmStarted && !this.bgmPaused) this.startBgm();
      return this.bgm;
    }

    const previous = this.bgm;
    const next = this.bgmSlots.find((slot) => slot !== previous);
    this.cancelFade();
    next.pause();
    next.volume = 0;
    this.loadTrack(next, key);
    this.seekToLoopStart(next, key);
    this.bgm = next;
    this.bgmKey = key;

    if (!this.bgmStarted || this.bgmPaused) {
      previous.pause();
      previous.volume = 0;
      next.volume = this.effectiveBgmVolume(key);
      return next;
    }

    const play = next.play();
    if (play?.then) {
      play.then(() => this.crossfade(previous, next, immediate ? 0 : this.tuning.bgm.fadeMs)).catch((error) => {
        previous.pause();
        previous.volume = 0;
        this.armBgmUnlock(error);
      });
    } else {
      this.crossfade(previous, next, immediate ? 0 : this.tuning.bgm.fadeMs);
    }
    return next;
  }

  seekToLoopStart(element = this.bgm, key = this.bgmKey) {
    const start = Math.max(0, Number(this.tracks[key]?.loopStart) || 0);
    try { element.currentTime = start; } catch { /* 메타데이터가 오면 0초부터 정상 재생 */ }
  }

  crossfade(previous, next, durationMs = 650) {
    this.cancelFade();
    const duration = Math.max(0, Number(durationMs) || 0);
    const from = previous.volume;
    const startedAt = performance.now();
    const token = ++this.fadeToken;
    const finish = () => {
      previous.pause();
      previous.volume = 0;
      next.volume = this.effectiveBgmVolume();
      this.fadeFrame = 0;
    };
    if (!duration) { finish(); return; }
    const tick = (now) => {
      if (token !== this.fadeToken) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      previous.volume = Math.max(0, from * (1 - progress));
      next.volume = this.effectiveBgmVolume() * progress;
      if (progress >= 1) finish();
      else this.fadeFrame = requestAnimationFrame(tick);
    };
    this.fadeFrame = requestAnimationFrame(tick);
  }

  cancelFade() {
    this.fadeToken += 1;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
  }

  armBgmUnlock(error) {
    this.bgmUnlockEvents.forEach((event) => document.addEventListener(event, this.unlockBgm));
    if (error && error.name !== "NotAllowedError" && error.name !== "AbortError") {
      console.warn("[audio] BGM playback failed; retrying on the next input.", error);
    }
  }

  startBgm() {
    this.bgmStarted = true;
    this.bgmPaused = false;
    this.armBgmUnlock();
    if (this.bgm.error) this.bgm.load();
    this.bgm.volume = this.effectiveBgmVolume();
    return this.bgm.play().then(() => {
      this.bgmUnlockEvents.forEach((event) => document.removeEventListener(event, this.unlockBgm));
      return true;
    }).catch((error) => {
      this.armBgmUnlock(error);
      return false;
    });
  }

  pauseBgm() {
    this.bgmPaused = true;
    this.bgmSlots.forEach((slot) => slot.pause());
  }

  resumeBgm() {
    if (!this.bgmStarted) return Promise.resolve(false);
    return this.startBgm();
  }

  stopBgm() {
    this.bgmStarted = false;
    this.bgmPaused = false;
    this.cancelFade();
    this.bgmUnlockEvents.forEach((event) => document.removeEventListener(event, this.unlockBgm));
    this.bgmSlots.forEach((slot) => { slot.pause(); slot.volume = 0; });
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
    oscillator.frequency.setValueAtTime(Math.max(30, Number(frequency) || 30), now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, Number(frequency) + Number(slide)), now + duration);
    amplifier.gain.setValueAtTime(Math.max(0.0001, gain * this.volume), now);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amplifier).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  play(name) {
    const preset = this.tuning.sfx.presets[name];
    if (!preset || this.volume <= 0) return;
    const now = performance.now();
    const throttleMs = Math.max(0, Number(this.tuning.sfx.throttleMs) || 0);
    if (now - (this.lastSfx.get(name) || 0) < throttleMs) return;
    this.lastSfx.set(name, now);
    preset.voices.forEach((voice) => {
      const playVoice = () => this.tone(voice.frequency, voice.duration, voice.type, voice.gain, voice.slide);
      if (!voice.delayMs) playVoice();
      else {
        const timer = window.setTimeout(() => { this.sfxTimers.delete(timer); playVoice(); }, voice.delayMs);
        this.sfxTimers.add(timer);
      }
    });
  }

  destroy() {
    this.stopBgm();
    this.sfxTimers.forEach((timer) => window.clearTimeout(timer));
    this.sfxTimers.clear();
    this.context?.close?.().catch(() => {});
  }
}

export const audio = new ArchiveAudio();
