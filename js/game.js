/* global Phaser, VoiceController, MicTestController, preloadGameAssets */

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const STAGE_TIME_MS = 20260;
const FLOOR_Y = 945;
const PLAYER_WIDTH = 81;
const PLAYER_HEIGHT = 123;
const PLAYER_START_X = 218;
const PLAYER_START_Y = FLOOR_Y - PLAYER_HEIGHT / 2;

const ui = {
  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),
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

function fitGameToViewport() {
  // 가로폭만 기준으로 16:9 화면을 키우면 넓고 낮은 창에서 조작부가
  // 화면 밖으로 밀린다. 실제 부가 UI 높이를 제외한 공간에 게임을 맞춘다.
  ui.appShell.style.width = "";

  for (let pass = 0; pass < 2; pass += 1) {
    const nonGameHeight = ui.appShell.scrollHeight - ui.gameContainer.offsetHeight;
    const availableGameHeight = Math.max(180, window.innerHeight - nonGameHeight - 4);
    const fittedWidth = Math.min(
      GAME_WIDTH,
      window.innerWidth - 32,
      availableGameHeight * (16 / 9),
    );
    ui.appShell.style.width = `${Math.max(320, fittedWidth)}px`;
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

  init(data = {}) {
    this.autoStart = Boolean(data.autoStart);
    this.autoStartVoiceEnabled = Boolean(data.voiceEnabled);
  }

  preload() {
    preloadGameAssets(this);
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

    if (this.autoStart) {
      this.time.delayedCall(0, () => this.startStage(this.autoStartVoiceEnabled));
    }
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
    voice.resetCommandState();
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
    this.resultTimeout = window.setTimeout(() => showResult(true, elapsed), 500);
  }

  failStage() {
    if (this.state !== "PLAYING") return;
    this.state = "ENDED";
    voice.stopRecognition();
    this.moveDirection = 0;
    this.player.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.shake(240, 0.008);
    setSystemStatus(false, "TIME OVER");
    this.resultTimeout = window.setTimeout(() => showResult(false), 500);
  }

  restartStage() {
    window.clearTimeout(this.resultTimeout);
    voice.stopRecognition();
    const voiceEnabled = this.voiceEnabled;
    ui.modal.classList.add("hidden");
    this.scene.restart({ autoStart: true, voiceEnabled });
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

const micTest = new MicTestController(ui, voice, setSystemStatus);

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
  micTest.runCalibration();
});

ui.secondaryButton.addEventListener("click", () => {
  if (ui.secondaryButton.dataset.action === "keyboard") {
    ui.modal.classList.add("hidden");
    activeScene?.startStage(false);
    return;
  }
  ui.primaryButton.dataset.action = "";
  ui.primaryButton.textContent = "다시 측정";
  micTest.runCalibration();
});

ui.helpToggle.addEventListener("click", () => {
  const expanded = ui.helpToggle.getAttribute("aria-expanded") === "true";
  ui.helpToggle.setAttribute("aria-expanded", String(!expanded));
  ui.helpCopy.hidden = expanded;
  fitGameToViewport();
});

fitGameToViewport();
window.addEventListener("resize", fitGameToViewport);
document.fonts?.ready.then(fitGameToViewport);

window.addEventListener("beforeunload", () => {
  window.removeEventListener("resize", fitGameToViewport);
  voice.destroy();
  game.destroy(true);
});
