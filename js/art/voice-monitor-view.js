/*
 * A(비주얼) 전용 — 실시간 마이크 파형과 음성 인식 원문 표시.
 * 음성 데이터는 메모리에서 즉시 그리기만 하며 저장하거나 전송하지 않는다.
 */

class VoiceMonitorView {
  constructor(events, dom, config) {
    this.canvas = dom.voiceWaveform;
    this.context = this.canvas?.getContext("2d") || null;
    this.inputState = dom.voiceInputState;
    this.transcriptKind = dom.voiceTranscriptKind;
    this.transcript = dom.voiceTranscript;
    this.rmsGate = config.rmsGate;
    this.smoothedRms = 0;

    events.on(GAME_EVENTS.VOICE_INPUT, (payload) => this.draw(payload));
    events.on(GAME_EVENTS.VOICE_TRANSCRIPT, (payload) => this.showTranscript(payload));
    events.on(GAME_EVENTS.MIC_CONNECTED, () => this.setInputState(false, "마이크 연결됨"));
    events.on(GAME_EVENTS.MIC_FAILED, () => this.setInputState(false, "수음 불가"));
    events.on(GAME_EVENTS.STAGE_START, () => this.resetTranscript());
    events.on(GAME_EVENTS.STAGE_PAUSE, () => {
      this.transcriptKind.textContent = "들은 발음";
      this.setTranscript("일시정지", true);
    });
    events.on(GAME_EVENTS.STAGE_RESUME, () => this.resetTranscript());

    this.drawIdle();
  }

  draw({ samples, rms = 0 }) {
    if (!this.context || !samples?.length) return;

    this.smoothedRms = this.smoothedRms * 0.78 + rms * 0.22;
    const active = this.smoothedRms >= this.rmsGate * 0.7;
    this.setInputState(active, active ? "수음 중" : "마이크 연결됨");

    const { context, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const middle = height / 2;
    const stride = Math.max(1, Math.floor(samples.length / width));

    context.clearRect(0, 0, width, height);
    context.strokeStyle = active ? "#4eefff" : "rgba(158, 182, 232, 0.55)";
    context.lineWidth = active ? 2 : 1;
    context.beginPath();

    for (let x = 0; x < width; x += 1) {
      const sample = samples[Math.min(samples.length - 1, x * stride)] || 0;
      const y = Math.max(1, Math.min(height - 1, middle + sample * height * 5));
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.stroke();
  }

  drawIdle() {
    if (!this.context) return;
    const { context, canvas } = this;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(158, 182, 232, 0.35)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
  }

  showTranscript({ text, isFinal }) {
    if (!text) return;
    this.transcriptKind.textContent = isFinal ? "들은 발음" : "듣는 중";
    this.setTranscript(`“${text}”`, isFinal);
  }

  resetTranscript() {
    this.transcriptKind.textContent = "들은 발음";
    this.setTranscript("말해보세요", true);
  }

  setTranscript(text, isFinal) {
    if (!this.transcript) return;
    this.transcript.textContent = text;
    this.transcript.classList.toggle("listening", !isFinal);
  }

  setInputState(active, text) {
    if (!this.inputState) return;
    this.inputState.textContent = text;
    this.inputState.classList.toggle("active", active);
  }
}

const voiceMonitorView = new VoiceMonitorView(gameEvents, UI, BALANCE.voice);
