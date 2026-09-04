/*
 * 두쫀쿠 전용 음량/발성 분석기.
 * 피치 기반 기존 VoiceController와 스트림을 공유하지 않아 Scene 종료 시 완전히 정리된다.
 */

class DujjonkuVoiceController {
  constructor(callbacks = {}, config = DUJJONKU_CONFIG.voice) {
    this.callbacks = callbacks;
    this.config = config;
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.buffer = null;
    this.frame = 0;
    this.recognition = null;
    this.shouldRecognize = false;
    this.noiseFloor = 0.01;
    this.threshold = config.minimumThreshold;
    this.voiceActive = false;
    this.aboveSince = 0;
    this.belowSince = 0;
    this.lastEndAt = 0;
    this.destroyed = false;
    this.levelPayload = { rms: 0, normalized: 0, threshold: this.threshold, active: false };
  }

  async connect() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
    }

    this.destroyed = false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        video: false,
      });
    } catch (error) {
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      throw new Error(denied
        ? "마이크 권한이 거부되었습니다. 주소창의 마이크 권한을 허용한 뒤 다시 시도해 주세요."
        : `마이크를 열 수 없습니다: ${error?.message || "알 수 없는 오류"}`);
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    await this.context.resume();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothing;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);

    await this.measureNoise();
    this.startRecognition();
    this.monitor();
    return { noiseFloor: this.noiseFloor, threshold: this.threshold };
  }

  readRms() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i += 1) sum += this.buffer[i] * this.buffer[i];
    return Math.sqrt(sum / this.buffer.length);
  }

  measureNoise() {
    const samples = [];
    const startedAt = performance.now();
    this.callbacks.onCalibrating?.();
    return new Promise((resolve) => {
      const sample = () => {
        if (this.destroyed || !this.analyser) return resolve();
        samples.push(this.readRms());
        if (performance.now() - startedAt < this.config.noiseSampleMs) {
          this.frame = requestAnimationFrame(sample);
          return;
        }
        samples.sort((a, b) => a - b);
        const percentile = samples[Math.floor(samples.length * 0.8)] || 0.01;
        this.noiseFloor = Math.max(0.003, percentile);
        this.threshold = Math.max(
          this.config.minimumThreshold,
          this.noiseFloor * this.config.thresholdMultiplier + this.config.thresholdOffset,
        );
        this.levelPayload.threshold = this.threshold;
        this.callbacks.onReady?.({ noiseFloor: this.noiseFloor, threshold: this.threshold });
        resolve();
      };
      sample();
    });
  }

  monitor() {
    if (this.destroyed || !this.analyser) return;
    const now = performance.now();
    const rms = this.readRms();
    const above = rms >= this.threshold;
    const normalized = Phaser.Math.Clamp(
      (rms - this.noiseFloor) / Math.max(0.025, this.threshold * 3 - this.noiseFloor),
      0,
      1,
    );

    if (above) {
      this.belowSince = 0;
      if (!this.aboveSince) this.aboveSince = now;
      if (!this.voiceActive && now - this.aboveSince >= this.config.startHoldMs) {
        this.voiceActive = true;
        this.callbacks.onVoiceStart?.();
      }
    } else {
      this.aboveSince = 0;
      if (!this.belowSince) this.belowSince = now;
      if (this.voiceActive && now - this.belowSince >= this.config.silenceHoldMs) {
        this.voiceActive = false;
        if (now - this.lastEndAt >= this.config.cooldownMs) {
          this.lastEndAt = now;
          this.callbacks.onVoiceEnd?.();
        }
      }
    }

    this.levelPayload.rms = rms;
    this.levelPayload.normalized = normalized;
    this.levelPayload.active = this.voiceActive;
    this.callbacks.onLevel?.(this.levelPayload);
    this.frame = requestAnimationFrame(() => this.monitor());
  }

  startRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.callbacks.onRecognitionUnavailable?.();
      return false;
    }
    this.shouldRecognize = true;
    this.recognition = new Recognition();
    this.recognition.lang = "ko-KR";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = [...event.results[i]].map((result) => result.transcript).join(" ")
          .replace(/\s+/g, "").toLowerCase();
        // 짧은 한 음절은 Speech Recognition이 숫자/받침/유사음으로 반환하기 쉽다.
        if (["두", "둘", "듀", "뚜", "2", "two"].some((word) => text.includes(word))) {
          this.callbacks.onWord?.("DU");
        }
        if (["쿠", "쿡", "구", "큐", "9", "ku", "koo"].some((word) => text.includes(word))) {
          this.callbacks.onWord?.("KU");
        }
      }
    };
    this.recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.shouldRecognize = false;
        this.callbacks.onError?.("음성 인식 권한이 차단되었습니다. 마이크 권한을 확인해 주세요.");
      }
    };
    this.recognition.onend = () => {
      if (!this.shouldRecognize || this.destroyed) return;
      window.setTimeout(() => {
        try { this.recognition?.start(); } catch (_) { /* 이미 실행 중 */ }
      }, 180);
    };
    try {
      this.recognition.start();
      return true;
    } catch (_) {
      this.shouldRecognize = false;
      return false;
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.shouldRecognize = false;
    try { this.recognition?.abort(); } catch (_) { /* no-op */ }
    this.recognition = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    this.buffer = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") context.close().catch(() => {});
  }
}
