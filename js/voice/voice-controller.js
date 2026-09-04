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
    this.isCalibrated = false;
    this.pitch = 0;
    this.pitchSamples = [];
    this.recentPitches = [];
    this.rms = 0;
    this.recentVolumes = [];
    this.animationFrame = 0;

    this.recognition = null;
    this.shouldRecognize = false;
    this.voiceActive = false;
    this.lastTrigger = new Map();
    this.handledCommandsByResult = new Map();
    this.evaluator = new VoiceEvaluator();

    // 매 프레임 발행되는 이벤트라 payload 객체를 재사용해 GC 부담을 줄인다.
    this.pitchPayload = { hz: 0, semitones: 0, level: "MID" };
    this.inputPayload = { rms: 0, samples: null };
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

    this.inputPayload.rms = this.rms;
    this.inputPayload.samples = this.buffer;
    this.events.emit(GAME_EVENTS.VOICE_INPUT, this.inputPayload);

    if (this.rms >= this.config.rmsGate) {
      this.recentVolumes.push({ value: this.rms, time: now });
      // 인식 결과를 기다리지 않고, 게이트를 넘는 순간 바로 "듣고 있다"는 신호를 보낸다.
      // ASR 지연(수백ms~1s)을 체감상 가리기 위한 즉시 피드백용 이벤트다.
      if (this.shouldRecognize && !this.voiceActive) {
        this.voiceActive = true;
        this.events.emit(GAME_EVENTS.VOICE_ONSET, {});
      }
    } else {
      this.voiceActive = false;
    }

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
    this.recentVolumes = this.recentVolumes.filter(
      (sample) => now - sample.time < this.config.volumeWindowMs,
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
    this.rms = rms;
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
          this.isCalibrated = true;
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

  getRecentVolume() {
    const now = performance.now();
    const values = this.recentVolumes
      .filter((sample) => now - sample.time < this.config.volumeWindowMs)
      .map((sample) => sample.value);
    if (!values.length) return this.config.movementVolumeMinRms;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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

    // 같은 발화의 중간 결과와 최종 결과가 반복 전달돼도 명령은 한 번만 실행한다.
    this.recognition.onstart = () => this.handledCommandsByResult.clear();

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const alternatives = [...event.results[i]];
        let understoodText = alternatives[0]?.transcript || "";

        alternatives.some((candidate) => {
          const transcript = candidate.transcript || "";
          if (!this.parseCommands(transcript, i)) return false;
          understoodText = transcript;
          return true;
        });

        this.events.emit(GAME_EVENTS.VOICE_TRANSCRIPT, {
          text: understoodText.trim(),
          isFinal: Boolean(event.results[i].isFinal),
        });
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

  parseCommands(transcript, resultIndex = null) {
    const text = transcript.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    const hasResultIndex = Number.isInteger(resultIndex);
    let handled = hasResultIndex ? this.handledCommandsByResult.get(resultIndex) : null;
    let matchedAny = false;

    if (hasResultIndex && !handled) {
      handled = new Set();
      this.handledCommandsByResult.set(resultIndex, handled);
    }

    COMMAND_DICT.forEach((entry) => {
      const matchedWord = entry.words.some((word) => text.includes(word));
      const matchedPattern = entry.patterns?.some((pattern) => pattern.test(text)) || false;
      const matched = matchedWord || matchedPattern;
      if (!matched) return;

      matchedAny = true;
      if (handled?.has(entry.command)) return;
      handled?.add(entry.command);
      this.emitCommand(entry.command);
    });

    return matchedAny;
  }

  emitCommand(command) {
    const now = performance.now();
    if (now - (this.lastTrigger.get(command) || 0) < this.config.commandCooldownMs) return;
    this.lastTrigger.set(command, now);
    this.events.emit(GAME_EVENTS.COMMAND_RECOGNIZED, {
      command,
      level: this.getPitchLevel(),
      volume: this.getRecentVolume(),
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
    this.handledCommandsByResult.clear();
    this.voiceActive = false;
  }

  resetCommandState() {
    this.lastTrigger.clear();
    this.handledCommandsByResult.clear();
    this.recentPitches = [];
    this.recentVolumes = [];
    this.rms = 0;
    this.voiceActive = false;
  }

  destroy() {
    this.stopRecognition();
    cancelAnimationFrame(this.animationFrame);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.isCalibrated = false;
    this.audioContext?.close();
    this.audioContext = null;
  }
}

const voiceController = new VoiceController(gameEvents);
