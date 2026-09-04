/* global Phaser */
/*
 * 기능(B) 전용 — 거제 야호 스테이지 물리·상태머신·타이머·입력.
 *
 * 공통 음성 이벤트와 20.26초 타이머 계약은 그대로 사용한다. 이 파일은 스테이지의
 * 충돌체와 체크포인트, 낚시 이벤트만 관리하며 화면 표현은 art/stage-view.js가 맡는다.
 */

const STAGE_STATE = Object.freeze({
  WAITING: "WAITING",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
});

const GEOJE_PHASE = Object.freeze({
  LOWER: "LOWER",
  FISHING: "FISHING",
  UPPER: "UPPER",
  CLEAR: "CLEAR",
  TIMEOUT: "TIMEOUT",
});

class StageScene extends Phaser.Scene {
  constructor() {
    super("StageScene");
    this.state = STAGE_STATE.WAITING;
    this.phase = GEOJE_PHASE.LOWER;
    this.moveDirection = 0;
    this.travelDirection = 1;
    this.currentMoveSpeed = BALANCE.physics.moveSpeed;
    this.voiceEnabled = false;

    // 매 프레임 발행하는 payload는 재사용한다.
    this.syncPayload = { x: 0, y: 0, velocityX: 0 };
    this.tickPayload = { remainingMs: BALANCE.stage.timeMs };
    this.fishingPayload = { x: 0, y: 0, progress: 0 };
    this.platformPayload = { y: STAGE_GEOMETRY.movingPlatform.y };

    gameEvents.on(GAME_EVENTS.REQUEST_START, ({ voiceEnabled }) => this.startStage(voiceEnabled));
    gameEvents.on(GAME_EVENTS.REQUEST_RESTART, () => this.restartStage());
    gameEvents.on(GAME_EVENTS.REQUEST_PAUSE, () => this.pauseStage());
    gameEvents.on(GAME_EVENTS.REQUEST_RESUME, () => this.resumeStage());
    gameEvents.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.returnToMain());
    gameEvents.on(GAME_EVENTS.COMMAND_RECOGNIZED, (payload) => this.applyCommand(payload));
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
    this.resetRuntimeState();
    createPhysicsTextures(this);

    this.physics.world.setBounds(0, 0, geo.world.width, geo.world.height);
    this.cameras.main
      .setBounds(
        0,
        geo.camera.minScrollY,
        geo.world.width,
        geo.canvas.height + geo.camera.maxScrollY - geo.camera.minScrollY,
      )
      .setScroll(0, 0);

    // 아트/사운드 트랙이 표시 객체와 재생 계층을 만드는 시점.
    gameEvents.emit(GAME_EVENTS.SCENE_CREATE, { scene: this });

    this.createStaticPlatforms(geo);
    this.createMovingPlatform(geo);
    this.createSafetyNet(geo);
    this.createPlayer(geo);
    this.createTriggerZones(geo);
    this.bindKeyboard();

    // 메인/설정 화면이 떠 있는 동안 캐릭터와 타이머가 먼저 움직이지 않는다.
    this.physics.pause();
    this.publishSync();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownStage());

    if (this.autoStart) {
      this.time.delayedCall(0, () => this.startStage(this.autoStartVoiceEnabled));
    }
  }

  resetRuntimeState() {
    this.phase = GEOJE_PHASE.LOWER;
    this.moveDirection = 0;
    this.travelDirection = 1;
    this.currentMoveSpeed = BALANCE.physics.moveSpeed;
    this.inGoalZone = false;
    this.inFishingZone = false;
    this.jumpLocked = false;
    this.jumpHasLeftGround = false;
    this.warningFired = false;
    this.wasGrounded = true;
    this.pausedAt = 0;
    this.hasFished = false;
    this.fishingElapsed = 0;
    this.movingPlatformElapsed = 0;
    this.isRecovering = false;
    this.recoveryRemaining = 0;
    this.recoveryTarget = null;
    this.netStunRemaining = 0;
    this.netCooldownRemaining = 0;
    this.tiltContactMs = 0;
    this.tiltTriggeredThisVisit = false;
  }

  createStaticPlatforms(geo) {
    this.staticPlatforms = this.physics.add.staticGroup();
    this.platformBodies = new Map();

    [...geo.lowerPlatforms, ...geo.upperPlatforms].forEach((platform) => {
      const body = this.staticPlatforms
        .create(platform.x, platform.y, "physicsPixel")
        .setDisplaySize(platform.width, platform.height)
        .setVisible(false)
        .refreshBody();
      body.setData("platformId", platform.id);
      this.platformBodies.set(platform.id, body);
    });
  }

  createMovingPlatform(geo) {
    const platform = geo.movingPlatform;
    this.movingPlatform = this.physics.add
      .staticImage(platform.x, platform.y, "physicsPixel")
      .setDisplaySize(platform.width, platform.height)
      .setVisible(false)
      .refreshBody();
  }

  createSafetyNet(geo) {
    const net = geo.safetyNet;
    this.safetyNet = this.staticPlatforms
      .create(net.x, net.y, "physicsPixel")
      .setDisplaySize(net.width, net.height)
      .setVisible(false)
      .refreshBody();
    this.safetyNet.setData("platformId", "safety-net");
    this.platformBodies.set("safety-net", this.safetyNet);
  }

  createPlayer(geo) {
    const { physics } = BALANCE;

    this.player = this.physics.add
      .image(geo.player.startX, geo.player.startY, "playerPhysics")
      .setVisible(false);
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(physics.maxVelocityX, physics.maxVelocityY);
    this.player.body.setDragX(physics.dragX);

    this.physics.add.collider(this.player, this.staticPlatforms, (_player, platform) => {
      if (platform.getData("platformId") === "safety-net") this.hitSafetyNet();
    });
    this.physics.add.collider(this.player, this.movingPlatform);
  }

  createTriggerZones(geo) {
    const stop = geo.stopZone;
    this.fishingZone = this.add.zone(stop.x, stop.y, stop.width, stop.height);
    this.physics.add.existing(this.fishingZone, true);

    const { goal } = geo.photoZone;
    this.goalZone = this.add.zone(goal.x, goal.y, goal.width, goal.height);
    this.physics.add.existing(this.goalZone, true);
  }

  bindKeyboard() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey("A");
    this.keyD = this.input.keyboard.addKey("D");

    this.keyboardHandlers = {
      space: (event) => {
        if (!event?.repeat) this.emitKeyCommand("JUMP");
      },
      stop: (event) => {
        if (!event?.repeat) this.emitKeyCommand("STOP");
      },
      reverse: (event) => {
        if (!event?.repeat) this.emitKeyCommand("REVERSE");
      },
      goal: (event) => {
        if (!event?.repeat) this.emitKeyCommand("GOAL");
      },
      restart: (event) => {
        if (!event?.repeat && this.state === STAGE_STATE.ENDED) {
          gameEvents.emit(GAME_EVENTS.REQUEST_RESTART, {});
        }
      },
    };

    this.input.keyboard.on("keydown-SPACE", this.keyboardHandlers.space);
    this.input.keyboard.on("keydown-S", this.keyboardHandlers.stop);
    this.input.keyboard.on("keydown-Q", this.keyboardHandlers.reverse);
    this.input.keyboard.on("keydown-E", this.keyboardHandlers.goal);
    this.input.keyboard.on("keydown-R", this.keyboardHandlers.restart);
  }

  emitKeyCommand(command) {
    if (this.state !== STAGE_STATE.PLAYING) return;
    gameEvents.emit(GAME_EVENTS.COMMAND_RECOGNIZED, {
      command,
      level: command === "JUMP" ? voiceController.getPitchLevel() : "MID",
      volume: BALANCE.voice.movementVolumeMinRms
        + (BALANCE.voice.movementVolumeMaxRms - BALANCE.voice.movementVolumeMinRms) * 0.5,
      source: "keyboard",
    });
  }

  startStage(voiceEnabled = true) {
    const geo = STAGE_GEOMETRY;

    voiceController.resetCommandState();
    this.resetRuntimeState();
    this.state = STAGE_STATE.PLAYING;
    this.voiceEnabled = voiceEnabled && Boolean(voiceController.stream);
    this.startedAt = performance.now();

    this.player.body.enable = true;
    this.player.body.setAllowGravity(true);
    this.player.body.reset(geo.player.startX, geo.player.startY);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.player.body.setDragX(BALANCE.physics.dragX);

    this.movingPlatform.setPosition(geo.movingPlatform.x, geo.movingPlatform.y).refreshBody();
    this.cameras.main.setScroll(0, 0);
    this.updateCamera(true);
    this.events.emit(GEOJE_STAGE_EVENTS.FACING, { direction: 1 });
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
    if (this.state !== STAGE_STATE.PLAYING || this.isInputLocked()) return;

    if (command === "MOVE") {
      this.currentMoveSpeed = BALANCE.physics.moveSpeed;
      this.moveDirection = this.travelDirection;
      return;
    }

    if (command === "STOP") {
      this.moveDirection = 0;
      return;
    }

    if (command === "REVERSE") {
      if (
        this.phase === GEOJE_PHASE.LOWER
        && !this.hasFished
        && this.isInFishingZone()
      ) {
        this.startFishingEvent();
        return;
      }

      const velocityDirection = Math.sign(this.player.body.velocity.x);
      const currentDirection = this.moveDirection || velocityDirection || this.travelDirection || 1;
      this.travelDirection = -currentDirection;
      this.moveDirection = this.travelDirection;
      this.events.emit(GEOJE_STAGE_EVENTS.FACING, { direction: this.travelDirection });
      return;
    }

    if (command === "GOAL") {
      if (this.phase === GEOJE_PHASE.UPPER && this.isInGoalZone()) {
        this.clearStage();
      } else {
        gameEvents.emit(GAME_EVENTS.COMMAND_REJECTED, { command, reason: "outside-goal" });
      }
      return;
    }

    if (command !== "JUMP") return;

    if (this.jumpLocked || !this.isGrounded()) {
      gameEvents.emit(GAME_EVENTS.COMMAND_REJECTED, { command, reason: "airborne" });
      return;
    }

    const jumpPower = BALANCE.physics.jumpPower[level] || BALANCE.physics.jumpPower.MID;
    this.jumpLocked = true;
    this.jumpHasLeftGround = false;
    this.player.setVelocityY(jumpPower);
    gameEvents.emit(GAME_EVENTS.PLAYER_JUMP, { level, direction: this.moveDirection });
  }

  isInputLocked() {
    return this.phase === GEOJE_PHASE.FISHING
      || this.phase === GEOJE_PHASE.CLEAR
      || this.phase === GEOJE_PHASE.TIMEOUT
      || this.isRecovering
      || this.netStunRemaining > 0;
  }

  isInFishingZone() {
    return Boolean(this.fishingZone && this.physics.overlap(this.player, this.fishingZone));
  }

  isInGoalZone() {
    return Boolean(this.goalZone && this.physics.overlap(this.player, this.goalZone));
  }

  isGrounded() {
    const { body } = this.player;
    return body.blocked.down || body.touching.down || body.onFloor();
  }

  isStandingOn(platform) {
    if (!platform?.body || !this.player?.body) return false;
    const playerBody = this.player.body;
    const horizontalOverlap = playerBody.right > platform.body.left
      && playerBody.left < platform.body.right;
    const nearTop = Math.abs(playerBody.bottom - platform.body.top) <= 18;
    return horizontalOverlap && nearTop && this.isGrounded();
  }

  startFishingEvent() {
    const { fishing, player } = STAGE_GEOMETRY;
    this.phase = GEOJE_PHASE.FISHING;
    this.hasFished = true;
    this.fishingElapsed = 0;
    this.moveDirection = 0;
    this.jumpLocked = false;
    this.jumpHasLeftGround = false;
    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);

    const playerY = fishing.basket.startY - fishing.basket.height / 2 - player.height / 2;
    this.player.body.reset(fishing.basket.startX, playerY);
    this.events.emit(GEOJE_STAGE_EVENTS.FISHING_START, {
      x: fishing.basket.startX,
      y: fishing.basket.startY,
    });
    this.publishSync();
  }

  updateFishingEvent(delta) {
    const geo = STAGE_GEOMETRY;
    const { fishing } = geo;
    this.fishingElapsed = Math.min(
      BALANCE.geoje.fishingDurationMs,
      this.fishingElapsed + delta,
    );
    const progress = this.fishingElapsed / BALANCE.geoje.fishingDurationMs;
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    const basketX = this.quadraticBezier(
      fishing.basket.startX,
      fishing.control.x,
      fishing.end.x,
      eased,
    );
    const basketY = this.quadraticBezier(
      fishing.basket.startY,
      fishing.control.y,
      fishing.end.y,
      eased,
    );
    const playerY = basketY - fishing.basket.height / 2 - geo.player.height / 2;

    this.player.body.reset(basketX, playerY);
    this.fishingPayload.x = basketX;
    this.fishingPayload.y = basketY;
    this.fishingPayload.progress = progress;
    this.events.emit(GEOJE_STAGE_EVENTS.FISHING_PROGRESS, this.fishingPayload);

    if (progress >= 1) this.completeFishingEvent();
  }

  quadraticBezier(start, control, end, progress) {
    const inverse = 1 - progress;
    return inverse * inverse * start
      + 2 * inverse * progress * control
      + progress * progress * end;
  }

  completeFishingEvent() {
    const checkpoint = STAGE_GEOMETRY.checkpoints.upper;
    this.phase = GEOJE_PHASE.UPPER;
    this.travelDirection = -1;
    this.moveDirection = 0;
    this.currentMoveSpeed = BALANCE.physics.moveSpeed;
    this.player.body.setAllowGravity(true);
    this.player.body.reset(checkpoint.x, checkpoint.y);
    this.player.body.setVelocity(0, 0);
    this.jumpLocked = false;
    this.jumpHasLeftGround = false;
    this.wasGrounded = true;
    this.events.emit(GEOJE_STAGE_EVENTS.FISHING_COMPLETE, { x: checkpoint.x, y: checkpoint.y });
    this.events.emit(GEOJE_STAGE_EVENTS.FACING, { direction: -1 });
    this.publishSync();
  }

  hitSafetyNet() {
    if (
      this.state !== STAGE_STATE.PLAYING
      || this.phase !== GEOJE_PHASE.LOWER
      || this.netCooldownRemaining > 0
      || this.isRecovering
    ) return;

    this.netCooldownRemaining = BALANCE.geoje.netCooldownMs;
    this.netStunRemaining = BALANCE.geoje.netStunMs;
    this.moveDirection = 0;
    this.player.setVelocity(BALANCE.geoje.netKnockbackX, BALANCE.geoje.netKnockbackY);
    this.events.emit(GEOJE_STAGE_EVENTS.NET_HIT, { x: this.player.x, y: this.player.y });
    gameEvents.emit(GAME_EVENTS.PLAYER_HIT_OBSTACLE, { side: "right" });
  }

  startFallRecovery() {
    if (this.isRecovering || this.phase === GEOJE_PHASE.FISHING) return;
    this.isRecovering = true;
    this.recoveryRemaining = BALANCE.geoje.fallRecoveryMs;
    this.recoveryTarget = this.phase === GEOJE_PHASE.UPPER
      ? STAGE_GEOMETRY.checkpoints.upper
      : STAGE_GEOMETRY.checkpoints.lower;
    this.moveDirection = 0;
    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);
    this.player.body.enable = false;
    this.events.emit(GEOJE_STAGE_EVENTS.FALL_START, { phase: this.phase });
  }

  updateFallRecovery(delta) {
    this.recoveryRemaining -= delta;
    if (this.recoveryRemaining > 0) return;

    const target = this.recoveryTarget;
    this.isRecovering = false;
    this.recoveryTarget = null;
    this.player.body.enable = true;
    this.player.body.setAllowGravity(true);
    this.player.body.reset(target.x, target.y);
    this.player.body.setVelocity(0, 0);
    this.travelDirection = this.phase === GEOJE_PHASE.UPPER ? -1 : 1;
    this.moveDirection = 0;
    this.jumpLocked = false;
    this.jumpHasLeftGround = false;
    this.wasGrounded = true;
    this.events.emit(GEOJE_STAGE_EVENTS.FALL_COMPLETE, { x: target.x, y: target.y });
    this.events.emit(GEOJE_STAGE_EVENTS.FACING, { direction: this.travelDirection });
    this.updateCamera(true);
  }

  updateMovingPlatform(delta) {
    const platform = STAGE_GEOMETRY.movingPlatform;
    const period = BALANCE.geoje.movingPlatformPeriodMs;
    this.movingPlatformElapsed = (this.movingPlatformElapsed + delta) % period;
    const angle = (this.movingPlatformElapsed / period) * Math.PI * 2;
    const y = platform.y + Math.sin(angle) * platform.amplitude;
    this.movingPlatform.setPosition(platform.x, y).refreshBody();
    this.platformPayload.y = y;
    this.events.emit(GEOJE_STAGE_EVENTS.MOVING_PLATFORM_SYNC, this.platformPayload);
  }

  updateTiltPlatform(delta) {
    if (this.phase !== GEOJE_PHASE.UPPER) return;
    const tiltBody = this.platformBodies.get("tilt-platform");
    const standing = this.isStandingOn(tiltBody);

    if (!standing) {
      this.tiltContactMs = 0;
      this.tiltTriggeredThisVisit = false;
      return;
    }

    if (!this.tiltTriggeredThisVisit) {
      this.tiltTriggeredThisVisit = true;
      this.events.emit(GEOJE_STAGE_EVENTS.TILT_START, {});
    }

    this.tiltContactMs += delta;
    if (this.tiltContactMs >= BALANCE.geoje.tiltDelayMs) {
      this.moveDirection = 0;
      if (this.player.body.velocity.x > -BALANCE.geoje.tiltSlideSpeed) {
        this.player.setVelocityX(-BALANCE.geoje.tiltSlideSpeed);
      }
    }
  }

  updateSurfacePhysics() {
    const slippery = STAGE_GEOMETRY.slipperyZone;
    const inSlipperyRange = this.phase === GEOJE_PHASE.LOWER
      && Math.abs(this.player.x - slippery.x) <= slippery.width / 2;
    this.player.body.setDragX(
      inSlipperyRange ? BALANCE.geoje.slipperyDragX : BALANCE.physics.dragX,
    );
  }

  updateMovementInput() {
    if (this.isInputLocked()) return;

    if (this.cursors.left.isDown || this.keyA.isDown) {
      this.travelDirection = -1;
      this.moveDirection = -1;
      this.currentMoveSpeed = BALANCE.physics.moveSpeed;
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      this.travelDirection = 1;
      this.moveDirection = 1;
      this.currentMoveSpeed = BALANCE.physics.moveSpeed;
    }

    if (this.moveDirection) {
      this.player.setVelocityX(this.moveDirection * this.currentMoveSpeed);
    }
  }

  updateJumpState() {
    const grounded = this.isGrounded();
    if (this.jumpLocked && !grounded) this.jumpHasLeftGround = true;
    if (grounded && this.jumpHasLeftGround) {
      this.jumpLocked = false;
      this.jumpHasLeftGround = false;
    }
    if (grounded && !this.wasGrounded) gameEvents.emit(GAME_EVENTS.PLAYER_LAND, {});
    this.wasGrounded = grounded;
  }

  updateCamera(immediate = false) {
    const { camera, canvas, world } = STAGE_GEOMETRY;
    const safeArea = viewportFitter.getCameraSafeArea();
    const direction = this.phase === GEOJE_PHASE.UPPER ? -1 : this.travelDirection;
    const targetCenter = this.player.x + direction * camera.lookAhead;
    const targetScroll = Phaser.Math.Clamp(
      targetCenter - canvas.width / 2,
      0,
      world.width - canvas.width,
    );
    const targetScrollY = Phaser.Math.Clamp(
      this.player.y - safeArea.centerY,
      camera.minScrollY,
      camera.maxScrollY,
    );
    this.cameras.main.scrollX = immediate
      ? targetScroll
      : Phaser.Math.Linear(this.cameras.main.scrollX, targetScroll, camera.lerp);
    this.cameras.main.scrollY = immediate
      ? targetScrollY
      : Phaser.Math.Linear(this.cameras.main.scrollY, targetScrollY, camera.lerp);
  }

  publishSync() {
    this.syncPayload.x = this.player.x;
    this.syncPayload.y = this.player.y;
    this.syncPayload.velocityX = this.player.body.velocity.x;
    gameEvents.emit(GAME_EVENTS.PLAYER_SYNC, this.syncPayload);
  }

  updateStageTimer() {
    const remaining = Math.max(0, BALANCE.stage.timeMs - (performance.now() - this.startedAt));
    this.tickPayload.remainingMs = remaining;
    gameEvents.emit(GAME_EVENTS.TIMER_TICK, this.tickPayload);

    if (!this.warningFired && remaining < BALANCE.stage.warningMs) {
      this.warningFired = true;
      gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {});
    }

    if (remaining <= 0) this.failStage();
  }

  update(_time, delta) {
    if (!this.player) return;

    if (this.state !== STAGE_STATE.PLAYING) {
      this.publishSync();
      return;
    }

    this.updateStageTimer();
    if (this.state !== STAGE_STATE.PLAYING) return;

    this.updateMovingPlatform(delta);
    this.netCooldownRemaining = Math.max(0, this.netCooldownRemaining - delta);
    this.netStunRemaining = Math.max(0, this.netStunRemaining - delta);

    if (this.isRecovering) {
      this.updateFallRecovery(delta);
      this.updateCamera();
      this.publishSync();
      return;
    }

    if (this.phase === GEOJE_PHASE.FISHING) {
      this.updateFishingEvent(delta);
      this.updateCamera();
      this.publishSync();
      return;
    }

    this.updateSurfacePhysics();
    this.updateMovementInput();
    this.updateTiltPlatform(delta);
    this.updateJumpState();

    this.inFishingZone = this.isInFishingZone();
    this.inGoalZone = this.phase === GEOJE_PHASE.UPPER && this.isInGoalZone();

    const fallThreshold = this.phase === GEOJE_PHASE.UPPER
      ? STAGE_GEOMETRY.fallThreshold.upper
      : STAGE_GEOMETRY.fallThreshold.lower;
    if (this.player.y > fallThreshold) this.startFallRecovery();

    this.updateCamera();
    this.publishSync();
  }

  endStage(phase) {
    this.phase = phase;
    this.state = STAGE_STATE.ENDED;
    voiceController.stopRecognition();
    this.moveDirection = 0;
    this.inGoalZone = false;
    this.inFishingZone = false;
    this.jumpLocked = false;
    this.jumpHasLeftGround = false;
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
    this.tweens.pauseAll();
    voiceController.stopRecognition();
    gameEvents.emit(GAME_EVENTS.STAGE_PAUSE, {});
  }

  resumeStage() {
    if (this.state !== STAGE_STATE.PAUSED) return;
    this.startedAt += performance.now() - this.pausedAt;
    this.pausedAt = 0;
    this.state = STAGE_STATE.PLAYING;
    this.physics.resume();
    this.tweens.resumeAll();

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
    if (
      this.state !== STAGE_STATE.PLAYING
      || this.phase !== GEOJE_PHASE.UPPER
      || !this.isInGoalZone()
    ) return;

    const elapsed = ((performance.now() - this.startedAt) / 1000).toFixed(2);
    const { pose, npcPose } = STAGE_GEOMETRY.photoZone;
    this.player.body.reset(pose.x, pose.y);
    this.player.body.setVelocity(0, 0);
    this.events.emit(GEOJE_STAGE_EVENTS.FACING, { direction: 1 });
    this.events.emit(GEOJE_STAGE_EVENTS.CLEAR_POSE, { player: pose, npc: npcPose });
    this.updateCamera(true);
    this.publishSync();
    this.endStage(GEOJE_PHASE.CLEAR);

    this.resultTimeout = window.setTimeout(
      () => gameEvents.emit(GAME_EVENTS.STAGE_CLEAR, { elapsed }),
      BALANCE.stage.resultDelayMs,
    );
  }

  failStage() {
    if (this.state !== STAGE_STATE.PLAYING) return;
    this.endStage(GEOJE_PHASE.TIMEOUT);
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
    this.state = STAGE_STATE.WAITING;
    this.physics.pause();
    this.scene.restart();
  }

  shutdownStage() {
    window.clearTimeout(this.resultTimeout);
    if (this.keyboardHandlers && this.input.keyboard) {
      this.input.keyboard.off("keydown-SPACE", this.keyboardHandlers.space);
      this.input.keyboard.off("keydown-S", this.keyboardHandlers.stop);
      this.input.keyboard.off("keydown-Q", this.keyboardHandlers.reverse);
      this.input.keyboard.off("keydown-E", this.keyboardHandlers.goal);
      this.input.keyboard.off("keydown-R", this.keyboardHandlers.restart);
    }
    this.keyboardHandlers = null;
    gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, { scene: this });
  }
}
