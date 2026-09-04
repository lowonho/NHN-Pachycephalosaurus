/* global VoiceEvaluator */
/*
 * C2(음성) 전용 — 마이크 입력, 피치 추정, 음성 명령 인식.
 *
 * DOM을 직접 만지지 않는다. 결과는 전부 gameEvents로만 내보낸다.
 * (이전 구조에서는 이 파일이 전역 ui와 setSystemStatus를 직접 호출했다.)
 */

class VoiceController {
  constructor(events, config = BALANCE.voice) {
    this.events = events;
    this.config = config;

    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.buffer = null;

    this.basePitch = config.defaultBasePitchHz;
    this.pitch = 0;
    this.pitchSamples = [];
    this.recentPitches = [];
    this.animationFrame = 0;

    this.recognition = null;
    this.shouldRecognize = false;
    this.lastTrigger = new Map();
    this.evaluator = new VoiceEvaluator();

    // 매 프레임 발행되는 이벤트라 payload 객체를 재사용해 GC 부담을 줄인다.
    this.pitchPayload = { hz: 0, semitones: 0, level: "MID" };
  }

  async connect() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 마이크 입력을 사용할 수 없습니다.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      video: false,
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    await this.audioContext.resume();

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.events.emit(GAME_EVENTS.MIC_CONNECTED, {});
    this.monitorPitch();
  }

  monitorPitch() {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const detected = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
    const now = performance.now();

    if (detected > this.config.pitchMinHz && detected < this.config.pitchMaxHz) {
      this.pitch = detected;
      this.recentPitches.push({ value: detected, time: now });
      this.publishPitch(detected);
    } else {
      this.pitch = 0;
    }

    this.recentPitches = this.recentPitches.filter(
      (sample) => now - sample.time < this.config.recentWindowMs,
    );
    this.animationFrame = requestAnimationFrame(() => this.monitorPitch());
  }

  publishPitch(hz) {
    this.pitchPayload.hz = hz;
    this.pitchPayload.semitones = this.evaluator.getSemitoneDifference(hz, this.basePitch);
    this.pitchPayload.level = this.evaluator.getLevel(hz, this.basePitch);
    this.events.emit(GAME_EVENTS.VOICE_PITCH, this.pitchPayload);
  }

  autoCorrelate(buffer, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / buffer.length);
    if (rms < this.config.rmsGate) return -1;

    let start = 0;
    let end = buffer.length - 1;
    const threshold = this.config.correlationThreshold;
    for (let i = 0; i < buffer.length / 2; i += 1) {
      if (Math.abs(buffer[i]) < threshold) {
        start = i;
        break;
      }
    }
    for (let i = 1; i < buffer.length / 2; i += 1) {
      if (Math.abs(buffer[buffer.length - i]) < threshold) {
        end = buffer.length - i;
        break;
      }
    }

    const trimmed = buffer.slice(start, end);
    const correlations = new Array(trimmed.length).fill(0);
    for (let lag = 0; lag < trimmed.length; lag += 1) {
      for (let i = 0; i < trimmed.length - lag; i += 1) {
        correlations[lag] += trimmed[i] * trimmed[i + lag];
      }
    }

    let dip = 0;
    while (dip + 1 < correlations.length && correlations[dip] > correlations[dip + 1]) dip += 1;
    let peak = -1;
    let peakIndex = -1;
    for (let i = dip; i < correlations.length; i += 1) {
      if (correlations[i] > peak) {
        peak = correlations[i];
        peakIndex = i;
      }
    }
    if (peakIndex <= 0) return -1;

    const before = correlations[peakIndex - 1] || correlations[peakIndex];
    const after = correlations[peakIndex + 1] || correlations[peakIndex];
    const divisor = 2 * (2 * correlations[peakIndex] - before - after);
    const shift = divisor ? (after - before) / divisor : 0;
    return sampleRate / (peakIndex + shift);
  }

  async calibrate(duration = BALANCE.calibration.durationMs) {
    this.pitchSamples = [];
    const started = performance.now();

    return new Promise((resolve) => {
      const collect = () => {
        if (this.pitch) this.pitchSamples.push(this.pitch);
        if (performance.now() - started < duration) {
          requestAnimationFrame(collect);
          return;
        }

        const stable = this.evaluator.trimOutliers(this.pitchSamples);
        if (stable.length >= BALANCE.calibration.minSamples) {
          this.basePitch = this.evaluator.median(stable);
          const result = { ok: true, pitch: this.basePitch, samples: stable.length };
          this.events.emit(GAME_EVENTS.MIC_CALIBRATED, result);
          resolve(result);
        } else {
          this.events.emit(GAME_EVENTS.VOICE_TOO_QUIET, { samples: stable.length });
          resolve({ ok: false, pitch: this.basePitch, samples: stable.length });
        }
      };
      collect();
    });
  }

  getRecentPitch() {
    const now = performance.now();
    const values = this.recentPitches
      .filter((sample) => now - sample.time < this.config.medianWindowMs)
      .map((sample) => sample.value);
    return this.evaluator.median(values) || this.basePitch;
  }

  getPitchLevel() {
    return this.evaluator.getLevel(this.getRecentPitch(), this.basePitch);
  }

  startRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return false;

    this.shouldRecognize = true;
    this.recognition = new Recognition();
    this.recognition.lang = "ko-KR";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const candidates = [...event.results[i]].map((item) => item.transcript).join(" ");
        this.parseCommands(candidates);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.shouldRecognize = false;
        this.events.emit(GAME_EVENTS.MIC_FAILED, { message: STRINGS.status.recognitionDenied });
      }
    };

    this.recognition.onend = () => {
      if (!this.shouldRecognize) return;
      window.setTimeout(() => {
        try {
          this.recognition?.start();
        } catch (_) {
          /* 이미 실행 중 */
        }
      }, this.config.restartDelayMs);
    };

    try {
      this.recognition.start();
      return true;
    } catch (_) {
      this.shouldRecognize = false;
      return false;
    }
  }

  parseCommands(transcript) {
    const text = transcript.replace(/\s+/g, "").toLowerCase();
    COMMAND_DICT.forEach((entry) => {
      if (entry.words.some((word) => text.includes(word))) this.emitCommand(entry.command);
    });
  }

  emitCommand(command) {
    const now = performance.now();
    if (now - (this.lastTrigger.get(command) || 0) < this.config.commandCooldownMs) return;
    this.lastTrigger.set(command, now);
    this.events.emit(GAME_EVENTS.COMMAND_RECOGNIZED, {
      command,
      level: this.getPitchLevel(),
      source: "voice",
    });
  }

  stopRecognition() {
    this.shouldRecognize = false;
    try {
      this.recognition?.stop();
    } catch (_) {
      /* no-op */
    }
    this.recognition = null;
  }

  resetCommandState() {
    this.lastTrigger.clear();
    this.recentPitches = [];
  }

  destroy() {
    this.stopRecognition();
    cancelAnimationFrame(this.animationFrame);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audioContext?.close();
    this.audioContext = null;
  }
}

const voiceController = new VoiceController(gameEvents);
