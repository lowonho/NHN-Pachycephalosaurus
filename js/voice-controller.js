/* global VoiceEvaluator, ui, setSystemStatus */

class VoiceController {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.buffer = null;
    this.basePitch = 180;
    this.pitch = 0;
    this.pitchSamples = [];
    this.recentPitches = [];
    this.animationFrame = 0;
    this.recognition = null;
    this.shouldRecognize = false;
    this.commandHandler = null;
    this.lastTrigger = new Map();
    this.evaluator = new VoiceEvaluator();
  }

  async connect() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 마이크 입력을 사용할 수 없습니다.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
      video: false,
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    await this.audioContext.resume();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.2;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.monitorPitch();
  }

  monitorPitch() {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const detected = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
    const now = performance.now();

    if (detected > 70 && detected < 520) {
      this.pitch = detected;
      this.recentPitches.push({ value: detected, time: now });
    } else {
      this.pitch = 0;
    }

    this.recentPitches = this.recentPitches.filter((sample) => now - sample.time < 1200);
    this.updatePitchUI();
    this.animationFrame = requestAnimationFrame(() => this.monitorPitch());
  }

  autoCorrelate(buffer, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / buffer.length);
    if (rms < 0.018) return -1;

    let start = 0;
    let end = buffer.length - 1;
    const threshold = 0.2;
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

  async calibrate(duration = 2400) {
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
        if (stable.length >= 12) {
          this.basePitch = this.evaluator.median(stable);
          resolve({ ok: true, pitch: this.basePitch, samples: stable.length });
        } else {
          resolve({ ok: false, pitch: this.basePitch, samples: stable.length });
        }
      };
      collect();
    });
  }

  getRecentPitch() {
    const now = performance.now();
    const values = this.recentPitches
      .filter((sample) => now - sample.time < 900)
      .map((sample) => sample.value);
    return this.evaluator.median(values) || this.basePitch;
  }

  getSemitoneDifference(pitch = this.getRecentPitch()) {
    return this.evaluator.getSemitoneDifference(pitch, this.basePitch);
  }

  getPitchLevel() {
    return this.evaluator.getLevel(this.getRecentPitch(), this.basePitch);
  }

  updatePitchUI() {
    if (!this.analyser || !this.pitch) return;
    const semitones = Math.max(-6, Math.min(6, this.getSemitoneDifference(this.pitch)));
    const position = ((semitones + 6) / 12) * 100;
    const level = this.evaluator.getLevel(this.pitch, this.basePitch);
    ui.pitchNeedle.style.left = `${position}%`;
    ui.pitchLabel.textContent = level;
  }

  startRecognition(handler) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSystemStatus(false, "음성 인식 미지원 · 키보드 테스트 가능");
      return false;
    }

    this.commandHandler = handler;
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
        setSystemStatus(false, "음성 인식 권한이 필요해요");
      }
    };
    this.recognition.onend = () => {
      if (this.shouldRecognize) {
        window.setTimeout(() => {
          try { this.recognition?.start(); } catch (_) { /* already running */ }
        }, 160);
      }
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
    const patterns = [
      { command: "LEFT", words: ["오이데", "오이대", "오이대요", "오이돼"] },
      { command: "JUMP", words: ["야호", "야오", "야호오"] },
      { command: "STOP", words: ["마떼루요", "마테루요", "맛대로요", "마때루요", "기다려요"] },
      { command: "RIGHT", words: ["파라파라", "파라파라요", "팔아팔아", "바라바라"] },
    ];

    patterns.forEach(({ command, words }) => {
      if (words.some((word) => text.includes(word))) this.emitCommand(command);
    });
  }

  emitCommand(command) {
    const now = performance.now();
    if (now - (this.lastTrigger.get(command) || 0) < 700) return;
    this.lastTrigger.set(command, now);
    this.commandHandler?.(command, this.getPitchLevel());
  }

  stopRecognition() {
    this.shouldRecognize = false;
    try { this.recognition?.stop(); } catch (_) { /* no-op */ }
    this.recognition = null;
    this.commandHandler = null;
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
