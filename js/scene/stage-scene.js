/* global Phaser */
/*
 * 기능(B) 전용 — 물리·상태머신·타이머·입력.
 *
 * 이 파일에는 색·폰트·좌표 리터럴이 없다. 배치는 config/stage-geometry.js,
 * 밸런스는 config/balance.js, 연출과 사운드는 gameEvents 구독자가 담당한다.
 */

const STAGE_STATE = Object.freeze({
  WAITING: "WAITING",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
});

class StageScene extends Phaser.Scene {
  constructor() {
    super("StageScene");
    this.state = STAGE_STATE.WAITING;
    this.moveDirection = 0;
    this.voiceEnabled = false;
    this.warningFired = false;
    this.wasGrounded = true;
    this.pausedAt = 0;

    // 매 프레임 발행하는 이벤트의 payload는 재사용한다.
    this.syncPayload = { x: 0, y: 0, velocityX: 0 };
    this.tickPayload = { remainingMs: BALANCE.stage.timeMs };

    gameEvents.on(GAME_EVENTS.REQUEST_START, ({ voiceEnabled, stageId = "geoje" }) => {
      if (stageId !== "geoje") return;
      if (!this.scene?.isActive()) {
        this.scene.start("StageScene", { autoStart: true, voiceEnabled });
      } else {
        this.startStage(voiceEnabled);
      }
    });
    gameEvents.on(GAME_EVENTS.REQUEST_RESTART, () => {
      if (this.scene?.isActive()) this.restartStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_PAUSE, () => {
      if (this.scene?.isActive()) this.pauseStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_RESUME, () => {
      if (this.scene?.isActive()) this.resumeStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => {
      if (this.scene?.isActive()) this.returnToMain();
    });
    gameEvents.on(GAME_EVENTS.COMMAND_RECOGNIZED, (payload) => {
      if (this.scene?.isActive()) this.applyCommand(payload);
    });
  }

  init(data = {}) {
    this.autoStart = Boolean(data.autoStart);
    this.autoStartVoiceEnabled = Boolean(data.voiceEnabled);
  }

  preload() {
    preloadGameAssets(this);
  }

  create() {
    const geo = STAGE_GEOMETRY;
    createPhysicsTextures(this);

    // 아트/사운드 트랙이 표시 객체와 재생 계층을 만드는 시점.
    gameEvents.emit(GAME_EVENTS.SCENE_CREATE, { scene: this });

    this.createGround(geo);
    this.createObstacleBodies(geo);
    this.createPlayer(geo);
    this.createGoalZone(geo);
    this.bindKeyboard();

    // 설정 화면이 떠 있는 동안 캐릭터가 먼저 떨어지지 않게 고정한다.
    this.physics.pause();
    this.publishSync();

    this.events.once("shutdown", () => gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, { scene: this }));

    if (this.autoStart) {
      this.time.delayedCall(0, () => this.startStage(this.autoStartVoiceEnabled));
    }
  }

  createGround(geo) {
    this.ground = this.physics.add
      .staticImage(geo.ground.x, geo.ground.y, "physicsPixel")
      .setDisplaySize(geo.ground.width, geo.ground.height)
      .setVisible(false)
      .refreshBody();
  }

  createObstacleBodies(geo) {
    this.obstacles = this.physics.add.staticGroup();
    geo.obstacles.forEach((obstacle) => {
      this.obstacles
        .create(obstacle.x, obstacle.y, "physicsPixel")
        .setDisplaySize(obstacle.width, obstacle.height)
        .setVisible(false)
        .refreshBody();
    });
  }

  createPlayer(geo) {
    const { physics } = BALANCE;

    this.player = this.physics.add
      .image(geo.player.startX, geo.player.startY, "playerPhysics")
      .setVisible(false);
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(physics.maxVelocityX, physics.maxVelocityY);
    this.player.body.setDragX(physics.dragX);

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.obstacles, () => {
      const { blocked } = this.player.body;
      if (blocked.left || blocked.right) {
        gameEvents.emit(GAME_EVENTS.PLAYER_HIT_OBSTACLE, { side: blocked.left ? "left" : "right" });
      }
    });
  }

  createGoalZone(geo) {
    const { goal } = geo.photoZone;
    this.goalZone = this.add.zone(goal.x, goal.y, goal.width, goal.height);
    this.physics.add.existing(this.goalZone, true);
    this.physics.add.overlap(this.player, this.goalZone, () => this.clearStage());
  }

  bindKeyboard() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey("A");
    this.keyD = this.input.keyboard.addKey("D");

    this.input.keyboard.on("keydown-SPACE", () => this.emitKeyCommand("JUMP"));
    this.input.keyboard.on("keydown-S", () => this.emitKeyCommand("STOP"));
    this.input.keyboard.on("keydown-R", () => {
      if (this.state === STAGE_STATE.ENDED) gameEvents.emit(GAME_EVENTS.REQUEST_RESTART, {});
    });
  }

  emitKeyCommand(command) {
    if (this.state !== STAGE_STATE.PLAYING) return;
    gameEvents.emit(GAME_EVENTS.COMMAND_RECOGNIZED, {
      command,
      level: command === "JUMP" ? voiceController.getPitchLevel() : "MID",
      source: "keyboard",
    });
  }

  startStage(voiceEnabled = true) {
    const geo = STAGE_GEOMETRY;

    voiceController.resetCommandState();
    this.state = STAGE_STATE.PLAYING;
    this.voiceEnabled = voiceEnabled && Boolean(voiceController.stream);
    this.moveDirection = 0;
    this.warningFired = false;
    this.wasGrounded = true;
    this.pausedAt = 0;
    this.startedAt = performance.now();

    this.player.body.reset(geo.player.startX, geo.player.startY);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.publishSync();
    this.physics.resume();

    gameEvents.emit(GAME_EVENTS.STAGE_START, { voiceEnabled: this.voiceEnabled });

    if (this.voiceEnabled) {
      const started = voiceController.startRecognition();
      hudStatus.set(
        started,
        started ? STRINGS.status.listening : STRINGS.status.recognitionUnsupported,
      );
    } else {
      hudStatus.set(true, STRINGS.status.keyboardMode);
    }
  }

  applyCommand({ command, level = "MID" }) {
    if (this.state !== STAGE_STATE.PLAYING) return;

    if (command === "LEFT") this.moveDirection = -1;
    if (command === "RIGHT") this.moveDirection = 1;
    if (command === "STOP") {
      this.moveDirection = 0;
      this.player.setVelocityX(0);
    }

    if (command !== "JUMP") return;

    if (!this.isGrounded()) {
      gameEvents.emit(GAME_EVENTS.COMMAND_REJECTED, { command, reason: "airborne" });
      return;
    }

    const jumpPower = BALANCE.physics.jumpPower[level] || BALANCE.physics.jumpPower.MID;
    this.player.setVelocityY(jumpPower);
    gameEvents.emit(GAME_EVENTS.PLAYER_JUMP, { level, direction: this.moveDirection });
  }

  isGrounded() {
    const { body } = this.player;
    return body.blocked.down || body.touching.down || body.onFloor();
  }

  publishSync() {
    this.syncPayload.x = this.player.x;
    this.syncPayload.y = this.player.y;
    this.syncPayload.velocityX = this.player.body.velocity.x;
    gameEvents.emit(GAME_EVENTS.PLAYER_SYNC, this.syncPayload);
  }

  update() {
    if (!this.player) return;
    this.publishSync();

    if (this.state !== STAGE_STATE.PLAYING) return;

    if (this.cursors.left.isDown || this.keyA.isDown) this.moveDirection = -1;
    if (this.cursors.right.isDown || this.keyD.isDown) this.moveDirection = 1;
    if (this.moveDirection) this.player.setVelocityX(this.moveDirection * BALANCE.physics.moveSpeed);

    // 공중 → 지면 전환을 착지로 본다.
    const grounded = this.isGrounded();
    if (grounded && !this.wasGrounded) gameEvents.emit(GAME_EVENTS.PLAYER_LAND, {});
    this.wasGrounded = grounded;

    const remaining = Math.max(0, BALANCE.stage.timeMs - (performance.now() - this.startedAt));
    this.tickPayload.remainingMs = remaining;
    gameEvents.emit(GAME_EVENTS.TIMER_TICK, this.tickPayload);

    // 경고는 임계를 넘는 순간 한 번만 발행한다(이전 구조는 매 프레임 호출했다).
    if (!this.warningFired && remaining < BALANCE.stage.warningMs) {
      this.warningFired = true;
      gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {});
    }

    if (remaining <= 0) this.failStage();
  }

  endStage() {
    this.state = STAGE_STATE.ENDED;
    voiceController.stopRecognition();
    this.moveDirection = 0;
    this.player.setVelocity(0, 0);
    this.physics.pause();
  }

  pauseStage() {
    if (this.state !== STAGE_STATE.PLAYING) return;
    this.state = STAGE_STATE.PAUSED;
    this.pausedAt = performance.now();
    this.moveDirection = 0;
    this.player.setVelocityX(0);
    this.physics.pause();
    voiceController.stopRecognition();
    gameEvents.emit(GAME_EVENTS.STAGE_PAUSE, {});
  }

  resumeStage() {
    if (this.state !== STAGE_STATE.PAUSED) return;
    this.startedAt += performance.now() - this.pausedAt;
    this.pausedAt = 0;
    this.state = STAGE_STATE.PLAYING;
    this.physics.resume();

    if (this.voiceEnabled) {
      const started = voiceController.startRecognition();
      hudStatus.set(
        started,
        started ? STRINGS.status.listening : STRINGS.status.recognitionUnsupported,
      );
    }

    gameEvents.emit(GAME_EVENTS.STAGE_RESUME, { voiceEnabled: this.voiceEnabled });
  }

  clearStage() {
    if (this.state !== STAGE_STATE.PLAYING) return;
    const elapsed = ((performance.now() - this.startedAt) / 1000).toFixed(2);
    this.endStage();
    this.resultTimeout = window.setTimeout(
      () => gameEvents.emit(GAME_EVENTS.STAGE_CLEAR, { elapsed }),
      BALANCE.stage.resultDelayMs,
    );
  }

  failStage() {
    if (this.state !== STAGE_STATE.PLAYING) return;
    this.endStage();
    this.resultTimeout = window.setTimeout(
      () => gameEvents.emit(GAME_EVENTS.STAGE_FAIL, {}),
      BALANCE.stage.resultDelayMs,
    );
  }

  restartStage() {
    window.clearTimeout(this.resultTimeout);
    voiceController.stopRecognition();
    this.scene.restart({ autoStart: true, voiceEnabled: this.voiceEnabled });
  }

  returnToMain() {
    window.clearTimeout(this.resultTimeout);
    voiceController.stopRecognition();
    this.moveDirection = 0;
    this.state = STAGE_STATE.WAITING;
    this.physics.pause();
    this.scene.restart();
  }
}
