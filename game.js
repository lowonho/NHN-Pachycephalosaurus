/* global Phaser */

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const STAGE_TIME_MS = 20260;
const FLOOR_Y = 945;
const PLAYER_WIDTH = 81;
const PLAYER_HEIGHT = 123;
const PLAYER_START_X = 218;
const PLAYER_START_Y = FLOOR_Y - PLAYER_HEIGHT / 2;

const ui = {
  modal: document.querySelector("#setup-modal"),
  modalStep: document.querySelector("#modal-step"),
  modalTitle: document.querySelector("#modal-title"),
  modalCopy: document.querySelector("#modal-copy"),
  primaryButton: document.querySelector("#primary-button"),
  secondaryButton: document.querySelector("#secondary-button"),
  calibrationVisual: document.querySelector("#calibration-visual"),
  calibrationResult: document.querySelector("#calibration-result"),
  statusDot: document.querySelector("#status-dot"),
  statusLabel: document.querySelector("#status-label"),
  pitchNeedle: document.querySelector("#pitch-needle"),
  pitchLabel: document.querySelector("#pitch-label"),
  helpToggle: document.querySelector("#help-toggle"),
  helpCopy: document.querySelector("#help-copy"),
};

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

        const stable = this.trimOutliers(this.pitchSamples);
        if (stable.length >= 12) {
          this.basePitch = this.median(stable);
          resolve({ ok: true, pitch: this.basePitch, samples: stable.length });
        } else {
          resolve({ ok: false, pitch: this.basePitch, samples: stable.length });
        }
      };
      collect();
    });
  }

  trimOutliers(values) {
    if (!values.length) return [];
    const center = this.median(values);
    return values.filter((value) => value > center * 0.72 && value < center * 1.38);
  }

  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  }

  getRecentPitch() {
    const now = performance.now();
    const values = this.recentPitches
      .filter((sample) => now - sample.time < 900)
      .map((sample) => sample.value);
    return this.median(values) || this.basePitch;
  }

  getSemitoneDifference(pitch = this.getRecentPitch()) {
    return 12 * Math.log2(pitch / this.basePitch);
  }

  getPitchLevel() {
    const difference = this.getSemitoneDifference();
    if (difference < -2.2) return "LOW";
    if (difference > 2.2) return "HIGH";
    return "MID";
  }

  updatePitchUI() {
    if (!this.analyser || !this.pitch) return;
    const semitones = Math.max(-6, Math.min(6, this.getSemitoneDifference(this.pitch)));
    const position = ((semitones + 6) / 12) * 100;
    const level = semitones < -2.2 ? "LOW" : semitones > 2.2 ? "HIGH" : "MID";
    ui.pitchNeedle.style.left = `${position}%`;
    ui.pitchLabel.textContent = level;
  }

  startRecognition(handler) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      ui.statusLabel.textContent = "음성 인식 미지원 · 키보드 테스트 가능";
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
        ui.statusLabel.textContent = "음성 인식 권한이 필요해요";
      }
    };
    this.recognition.onend = () => {
      if (this.shouldRecognize) {
        window.setTimeout(() => {
          try { this.recognition.start(); } catch (_) { /* already running */ }
        }, 160);
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch (_) {
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
  }
}

const voice = new VoiceController();
let activeScene = null;

class GeojeStage extends Phaser.Scene {
  constructor() {
    super("GeojeStage");
    this.state = "WAITING";
    this.moveDirection = 0;
  }

  preload() {
    this.load.image("geojeSea", "assets/geoje-sea.png");
  }

  create() {
    activeScene = this;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "geojeSea")
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    if (!this.textures.exists("physicsPixel")) {
      const pixel = this.make.graphics({ x: 0, y: 0, add: false });
      pixel.fillStyle(0xffffff, 1);
      pixel.fillRect(0, 0, 2, 2);
      pixel.generateTexture("physicsPixel", 2, 2);
      pixel.destroy();
    }

    if (!this.textures.exists("playerPhysics")) {
      const playerBodyTexture = this.make.graphics({ x: 0, y: 0, add: false });
      playerBodyTexture.fillStyle(0xffffff, 1);
      playerBodyTexture.fillRect(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
      playerBodyTexture.generateTexture("playerPhysics", PLAYER_WIDTH, PLAYER_HEIGHT);
      playerBodyTexture.destroy();
    }

    const groundHeight = GAME_HEIGHT - FLOOR_Y;
    const groundCenterY = FLOOR_Y + groundHeight / 2;
    this.add.rectangle(GAME_WIDTH / 2, groundCenterY, GAME_WIDTH, groundHeight, 0x07142f, 0.6);
    this.add.rectangle(GAME_WIDTH / 2, FLOOR_Y, GAME_WIDTH, 6, 0x4eefff, 0.68);
    this.ground = this.physics.add.staticImage(GAME_WIDTH / 2, groundCenterY, "physicsPixel")
      .setDisplaySize(GAME_WIDTH, groundHeight)
      .setVisible(false)
      .refreshBody();

    this.obstacles = this.physics.add.staticGroup();
    this.createObstacle(683, 911, 126, 138, 0xffdf50, "LOW");
    this.createObstacle(1185, 848, 150, 264, 0xff6678, "HIGH");

    this.add.rectangle(1710, 884, 248, 12, 0x4eefff, 0.92);
    this.add.rectangle(1590, 750, 12, 270, 0x4eefff, 0.92);
    this.add.rectangle(1830, 750, 12, 270, 0x4eefff, 0.92);
    this.add.rectangle(1710, 615, 252, 12, 0x4eefff, 0.92);
    this.add.text(1710, 663, "PHOTO\nZONE", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "51px",
      align: "center",
      color: "#ffffff",
      stroke: "#1f5cff",
      strokeThickness: 12,
    }).setOrigin(0.5);

    this.player = this.physics.add.image(PLAYER_START_X, PLAYER_START_Y, "playerPhysics")
      .setVisible(false);
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(495, 1500);
    this.player.body.setDragX(1875);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.obstacles, () => {
      if (this.player.body.blocked.left || this.player.body.blocked.right) {
        this.cameras.main.shake(80, 0.0025);
      }
    });

    this.playerGlow = this.add.circle(this.player.x, this.player.y, 59, 0x4eefff, 0.32);
    this.playerIcon = this.add.text(this.player.x, FLOOR_Y + 6, "🕺", {
      fontSize: "95px",
    }).setOrigin(0.5, 1);

    this.goalZone = this.add.zone(1710, 878, 248, 180);
    this.physics.add.existing(this.goalZone, true);
    this.physics.add.overlap(this.player, this.goalZone, () => this.clearStage());

    this.stageLabel = this.add.text(57, 48, "STAGE 01  ·  GEOJE", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "29px",
      color: "#4eefff",
      stroke: "#061537",
      strokeThickness: 9,
    });
    this.goalLabel = this.add.text(57, 92, "20.26초 안에 포토존까지 가!", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "41px",
      color: "#ffffff",
      stroke: "#061537",
      strokeThickness: 11,
    });
    this.timerText = this.add.text(1860, 57, "20.26", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "78px",
      color: "#ffe04b",
      stroke: "#061537",
      strokeThickness: 14,
    }).setOrigin(1, 0);

    this.speechBubble = this.add.container(218, 708).setAlpha(0);
    const bubble = this.add.rectangle(0, 0, 225, 72, 0x061537, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.8);
    this.bubbleText = this.add.text(0, 0, "", {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "32px",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.speechBubble.add([bubble, this.bubbleText]);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey("A");
    this.keyD = this.input.keyboard.addKey("D");
    this.keyS = this.input.keyboard.addKey("S");
    this.input.keyboard.on("keydown-SPACE", () => this.handleCommand("JUMP", voice.getPitchLevel()));
    this.input.keyboard.on("keydown-S", () => this.handleCommand("STOP", "MID"));
    this.input.keyboard.on("keydown-R", () => {
      if (this.state === "ENDED") this.restartStage();
    });

    // 설정 화면이 떠 있는 동안 캐릭터가 먼저 떨어지지 않게 고정한다.
    this.physics.pause();
    this.syncPlayerVisuals();
  }

  createObstacle(x, y, width, height, color, label) {
    this.add.rectangle(x, y, width, height, color, 0.96)
      .setStrokeStyle(5, 0x061537, 0.82);
    this.obstacles.create(x, y, "physicsPixel")
      .setDisplaySize(width, height)
      .setVisible(false)
      .refreshBody();
    this.add.text(x, y - height / 2 - 30, label, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "27px",
      color: "#ffffff",
      stroke: "#061537",
      strokeThickness: 9,
    }).setOrigin(0.5);
  }

  startStage(voiceEnabled = true) {
    this.state = "PLAYING";
    this.voiceEnabled = voiceEnabled && Boolean(voice.stream);
    this.moveDirection = 0;
    this.startedAt = performance.now();
    this.player.body.reset(PLAYER_START_X, PLAYER_START_Y);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.syncPlayerVisuals();
    this.physics.resume();
    this.timerText.setText("20.26").setColor("#ffe04b");
    if (this.voiceEnabled) {
      const recognitionStarted = voice.startRecognition(
        (command, level) => this.handleCommand(command, level),
      );
      setSystemStatus(
        recognitionStarted,
        recognitionStarted
          ? "듣는 중 · 명령어를 말해보세요"
          : "음성 인식 미지원 · 키보드 테스트 중",
      );
    } else {
      setSystemStatus(true, "키보드 테스트 중");
    }
  }

  handleCommand(command, pitchLevel = "MID") {
    if (this.state !== "PLAYING") return;
    const labels = {
      LEFT: "오이데!",
      JUMP: `야호! ${pitchLevel}`,
      STOP: "마떼루요!",
      RIGHT: "파라파라!",
    };
    this.showCommand(labels[command]);
    pulseCommand(command);

    if (command === "LEFT") this.moveDirection = -1;
    if (command === "RIGHT") this.moveDirection = 1;
    if (command === "STOP") {
      this.moveDirection = 0;
      this.player.setVelocityX(0);
    }
    const isGrounded = this.player.body.blocked.down
      || this.player.body.touching.down
      || this.player.body.onFloor();
    if (command === "JUMP" && isGrounded) {
      const jumpPower = { LOW: -765, MID: -975, HIGH: -1238 }[pitchLevel] || -975;
      this.player.setVelocityY(jumpPower);
      this.tweens.add({
        targets: this.playerIcon,
        angle: this.moveDirection >= 0 ? 18 : -18,
        duration: 160,
        yoyo: true,
      });
    }
  }

  showCommand(label) {
    this.bubbleText.setText(label);
    this.speechBubble.setPosition(this.player.x, this.player.y - 138).setAlpha(1);
    this.tweens.killTweensOf(this.speechBubble);
    this.tweens.add({
      targets: this.speechBubble,
      alpha: 0,
      delay: 520,
      duration: 220,
    });
  }

  syncPlayerVisuals() {
    if (!this.player) return;
    this.playerGlow.setPosition(this.player.x, this.player.y);
    this.playerIcon.setPosition(
      this.player.x,
      this.player.y + PLAYER_HEIGHT / 2 + 6,
    );
    if (this.speechBubble?.alpha > 0) {
      this.speechBubble.setPosition(this.player.x, this.player.y - 138);
    }
  }

  update() {
    if (!this.player) return;
    this.syncPlayerVisuals();

    if (this.state !== "PLAYING") return;

    if (this.cursors.left.isDown || this.keyA.isDown) this.moveDirection = -1;
    if (this.cursors.right.isDown || this.keyD.isDown) this.moveDirection = 1;
    if (this.moveDirection) this.player.setVelocityX(this.moveDirection * 368);

    const remaining = Math.max(0, STAGE_TIME_MS - (performance.now() - this.startedAt));
    this.timerText.setText((remaining / 1000).toFixed(2));
    if (remaining < 5000) this.timerText.setColor("#ff5f6f");
    if (remaining <= 0) this.failStage();
  }

  clearStage() {
    if (this.state !== "PLAYING") return;
    this.state = "ENDED";
    voice.stopRecognition();
    this.player.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.flash(220, 255, 255, 255);
    const elapsed = ((performance.now() - this.startedAt) / 1000).toFixed(2);
    setSystemStatus(true, `CLEAR · ${elapsed}초`);
    window.setTimeout(() => showResult(true, elapsed), 500);
  }

  failStage() {
    if (this.state !== "PLAYING") return;
    this.state = "ENDED";
    voice.stopRecognition();
    this.moveDirection = 0;
    this.player.setVelocity(0, 0);
    this.cameras.main.shake(240, 0.008);
    setSystemStatus(false, "TIME OVER");
    window.setTimeout(() => showResult(false), 500);
  }

  restartStage() {
    voice.stopRecognition();
    const voiceEnabled = this.voiceEnabled;
    this.scene.restart();
    window.setTimeout(() => activeScene?.startStage(voiceEnabled), 120);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  transparent: false,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 2325 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GeojeStage],
});

function setSystemStatus(active, label) {
  ui.statusDot.classList.toggle("active", active);
  ui.statusLabel.textContent = label;
}

function pulseCommand(command) {
  const selector = {
    LEFT: ".command-left",
    JUMP: ".command-jump",
    STOP: ".command-stop",
    RIGHT: ".command-right",
  }[command];
  const element = document.querySelector(selector);
  if (!element) return;
  element.classList.add("active");
  window.setTimeout(() => element.classList.remove("active"), 430);
}

async function runCalibration() {
  ui.primaryButton.disabled = true;
  ui.secondaryButton.hidden = true;
  ui.modalStep.textContent = "VOICE SETUP";
  ui.modalTitle.textContent = "편하게 ‘아—’ 해보세요";
  ui.modalCopy.textContent = "2.4초 동안 평소 말할 때의 편안한 높이로 길게 소리 내주세요.";
  ui.calibrationResult.textContent = "중간음을 듣고 있어요…";
  ui.calibrationVisual.classList.add("listening");

  try {
    if (!voice.stream) await voice.connect();
    setSystemStatus(true, "마이크 연결됨 · 중간음 측정 중");
    const result = await voice.calibrate();
    ui.calibrationVisual.classList.remove("listening");

    if (!result.ok) {
      ui.modalTitle.textContent = "목소리가 잘 안 들렸어요";
      ui.modalCopy.textContent = "마이크 가까이에서 편안하게 ‘아—’ 하고 다시 말해주세요.";
      ui.calibrationResult.textContent = "충분한 음높이를 측정하지 못했습니다.";
      ui.primaryButton.textContent = "다시 측정";
      ui.primaryButton.disabled = false;
      ui.secondaryButton.hidden = false;
      ui.secondaryButton.textContent = "마이크 없이 키보드로 테스트";
      ui.secondaryButton.dataset.action = "keyboard";
      return;
    }

    ui.modalTitle.textContent = "중간음 설정 완료!";
    ui.modalCopy.innerHTML = "<b>파라파라</b>로 오른쪽 이동 → <b>야호</b>로 장애물을 넘고<br><b>마떼루요</b>로 포토존에 멈추세요.";
    ui.calibrationResult.textContent = `내 기준음 ${Math.round(result.pitch)} Hz · 야호를 높게 말하면 더 높이 점프!`;
    ui.primaryButton.textContent = "20.26초 도전 시작";
    ui.primaryButton.disabled = false;
    ui.primaryButton.dataset.action = "start";
    ui.secondaryButton.dataset.action = "recalibrate";
    setSystemStatus(true, `중간음 ${Math.round(result.pitch)} Hz 설정 완료`);
  } catch (error) {
    ui.calibrationVisual.classList.remove("listening");
    ui.modalTitle.textContent = "마이크를 연결할 수 없어요";
    ui.modalCopy.textContent = "브라우저 주소창의 마이크 권한을 허용한 뒤 다시 시도해주세요.";
    ui.calibrationResult.textContent = error.message || "마이크 권한을 확인해주세요.";
    ui.primaryButton.textContent = "다시 연결";
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = "마이크 없이 키보드로 테스트";
    ui.secondaryButton.dataset.action = "keyboard";
    setSystemStatus(false, "마이크 권한 확인 필요");
  }
}

function showResult(success, elapsed) {
  ui.modal.classList.remove("hidden");
  ui.modalStep.textContent = success ? "STAGE CLEAR" : "TIME OVER";
  ui.modalTitle.textContent = success ? "거제~ 야호! 📸" : "포토존이 코앞인데!";
  ui.modalCopy.textContent = success
    ? `${elapsed}초 만에 포토존 도착! 다음에는 더 빠르게 가볼까요?`
    : "20.26초가 끝났어요. 파라파라로 달리고, 장애물 앞에서 야호를 외쳐보세요.";
  ui.calibrationResult.textContent = success ? "CLEAR" : "다시 하면 감이 올 거예요.";
  ui.primaryButton.textContent = "다시 도전";
  ui.primaryButton.disabled = false;
  ui.primaryButton.dataset.action = "retry";
  ui.secondaryButton.hidden = false;
  ui.secondaryButton.textContent = "중간음 다시 측정";
  ui.secondaryButton.dataset.action = "recalibrate";
}

ui.primaryButton.addEventListener("click", () => {
  const action = ui.primaryButton.dataset.action;
  if (action === "start") {
    ui.modal.classList.add("hidden");
    activeScene?.startStage();
    return;
  }
  if (action === "retry") {
    ui.modal.classList.add("hidden");
    activeScene?.restartStage();
    return;
  }
  runCalibration();
});

ui.secondaryButton.addEventListener("click", () => {
  if (ui.secondaryButton.dataset.action === "keyboard") {
    ui.modal.classList.add("hidden");
    activeScene?.startStage(false);
    return;
  }
  ui.primaryButton.dataset.action = "";
  ui.primaryButton.textContent = "다시 측정";
  runCalibration();
});

ui.helpToggle.addEventListener("click", () => {
  const expanded = ui.helpToggle.getAttribute("aria-expanded") === "true";
  ui.helpToggle.setAttribute("aria-expanded", String(!expanded));
  ui.helpCopy.hidden = expanded;
});

window.addEventListener("beforeunload", () => {
  voice.stopRecognition();
  cancelAnimationFrame(voice.animationFrame);
  voice.stream?.getTracks().forEach((track) => track.stop());
  game.destroy(true);
});
