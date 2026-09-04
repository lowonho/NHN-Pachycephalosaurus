/*
 * A(비주얼) 전용 — 화면 상단 피치 게이지(DOM).
 *
 * 이전에는 voice-controller가 DOM을 직접 만졌다. 이제 음성 계층은
 * VOICE_PITCH 이벤트만 발행하고, 바늘을 움직이는 책임은 여기에만 있다.
 */

class PitchMeterView {
  constructor(events, dom) {
    this.needle = dom.pitchNeedle;
    this.label = dom.pitchLabel;
    this.range = 6; // 표시 범위 ±6 반음

    events.on(GAME_EVENTS.VOICE_PITCH, (payload) => this.update(payload));
    events.on(GAME_EVENTS.MIC_CONNECTED, () => this.reset());
  }

  update({ semitones, level }) {
    if (!this.needle) return;
    const clamped = Math.max(-this.range, Math.min(this.range, semitones));
    const position = ((clamped + this.range) / (this.range * 2)) * 100;
    this.needle.style.left = `${position}%`;
    this.label.textContent = level;
  }

  reset() {
    if (!this.needle) return;
    this.needle.style.left = "50%";
    this.label.textContent = "READY";
  }
}

const pitchMeterView = new PitchMeterView(gameEvents, UI);
