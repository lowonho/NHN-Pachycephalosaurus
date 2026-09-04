/* global Phaser */

const DUJJONKU_STATE = Object.freeze({
  WAITING: "WAITING",
  LOADED: "LOADED",
  CHARGING: "CHARGING",
  FIRED: "FIRED",
  RESETTING: "RESETTING",
});

class DujjonkuScene extends Phaser.Scene {
  constructor() {
    super({
      key: "DujjonkuScene",
      physics: { default: "matter", matter: { gravity: { y: 1 }, enableSleeping: true, debug: false } },
    });
    this.stageRunning = false;
    this.voiceState = DUJJONKU_STATE.WAITING;

    gameEvents.on(GAME_EVENTS.REQUEST_RESTART, () => {
      if (this.scene?.isActive()) this.restartStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_PAUSE, () => {
      if (this.isActiveStage()) this.pauseStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_RESUME, () => {
      if (this.scene?.isActive() && this.paused) this.resumeStage();
    });
    gameEvents.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => {
      if (this.scene?.isActive()) this.returnToMain();
    });
  }

  init(data = {}) {
    this.autoStart = Boolean(data.autoStart);
    this.voiceRequested = data.voiceEnabled !== false;
  }

  create() {
    createDujjonkuTextures(this);
    document.body.classList.add("dujjonku-active");
    this.matter.world.setBounds(0, 0, 1920, 1080, 72, true, true, false, true);
    this.createBackground();
    this.createLauncher();
    this.createStructure();
    this.createHud();
    this.createCollisionRules();
    this.bindDebugVoice();
    this.resetRuntime();

    this.events.once("shutdown", () => this.cleanup());
    if (this.autoStart) this.time.delayedCall(0, () => this.startStage());
  }

  isActiveStage() {
    return Boolean(this.scene?.isActive() && this.stageRunning && !this.ended);
  }

  resetRuntime() {
    this.voiceState = DUJJONKU_STATE.WAITING;
    this.stageRunning = false;
    this.ended = false;
    this.paused = false;
    this.shotsLeft = DUJJONKU_CONFIG.shots;
    this.chargeMs = 0;
    this.chargePercent = 0;
    this.voiceLevel = 0;
    this.currentAngle = DUJJONKU_CONFIG.launcher.minAngle;
    this.angleDirection = 1;
    this.projectile = null;
    this.projectileSettledAt = 0;
    this.projectileFiredAt = 0;
    this.warningFired = false;
    this.micReady = false;
    this.timerActive = false;
    this.waitingVoiceStartedAt = 0;
    this.lastActionAt = 0;
    this.waveSamples = new Array(36).fill(0);
    this.updateStateHud();
  }

  createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x77c9f5, 0x8ed7fa, 0xffc8dc, 0xffe3c5, 1);
    bg.fillRect(0, 0, 1920, 1080);
    bg.fillStyle(0xffffff, 0.78);
    [[180,180,1.2],[540,125,.85],[1010,190,1],[1510,125,1.15]].forEach(([x,y,s]) => {
      bg.fillCircle(x, y, 48*s).fillCircle(x+52*s, y-12*s, 62*s).fillCircle(x+108*s, y, 45*s);
    });
    bg.fillStyle(0x8bcf72).fillEllipse(310, 925, 860, 260).fillEllipse(1510, 900, 970, 300);
    bg.fillStyle(0x6cb45e).fillRect(0, 885, 1920, 195);
    bg.fillStyle(0x86ce6c).fillEllipse(260, 700, 470, 115).fillEllipse(1425, 650, 620, 145);
    bg.fillStyle(0x8b6b66).fillTriangle(75, 705, 455, 705, 290, 900);
    bg.fillTriangle(1110, 690, 1740, 690, 1450, 1010);
    bg.fillStyle(0xf7e5b4).fillCircle(150, 865, 7).fillCircle(270, 850, 7).fillCircle(1680, 830, 7);

    this.add.text(55, 40, "★ 두쫀쿠", {
      fontFamily: "Black Han Sans, sans-serif", fontSize: "50px", color: "#fff9f1",
      backgroundColor: "#ed7fa5", padding: { x: 28, y: 16 },
      stroke: "#a95378", strokeThickness: 5,
    }).setDepth(20);
  }

  createLauncher() {
    this.launcherGraphics = this.add.graphics().setDepth(8);
    this.trajectoryGraphics = this.add.graphics().setDepth(7);
    this.character = this.add.container(205, 780).setDepth(9);
    const body = this.add.circle(0, 0, 58, 0xfff2d5).setStrokeStyle(6, 0x9c694f);
    const hair = this.add.circle(0, -40, 35, 0xf4a6bd);
    const face = this.add.text(0, -2, "•ᴗ•", { fontSize: "32px", color: "#75485b" }).setOrigin(.5);
    const label = this.add.text(0, 76, "목소리 조련사", { fontSize: "22px", color: "#75485b", backgroundColor: "#fff8e8", padding: { x: 10, y: 5 } }).setOrigin(.5);
    this.character.add([body, hair, face, label]);
    this.drawLauncher();
  }

  createStructure() {
    const ground = this.matter.add.rectangle(1470, 867, 760, 80, { isStatic: true, friction: 0.9 });
    ground.label = "island-ground";
    this.blocks = [];
    this.monsters = [];
    const block = (type, x, y, options) => {
      const item = addDujjonkuBlock(this, type, x, y, options);
      this.blocks.push(item);
      return item;
    };
    const monster = (x, y) => {
      const item = addDujjonkuMonster(this, x, y);
      this.monsters.push(item);
      return item;
    };

    block("stone", 1260, 797); block("stone", 1352, 797);
    block("star", 1440, 790); block("stone", 1530, 797);
    block("stone", 1622, 797); block("stone", 1714, 797);

    block("wood", 1288, 708, { angle: 90 });
    block("wood", 1492, 708, { angle: 90 });
    block("wood", 1390, 628, { scaleX: 1.7 });
    monster(1390, 563);

    block("wood", 1288, 530, { angle: 90 });
    block("wood", 1492, 530, { angle: 90 });
    block("wood", 1390, 450, { scaleX: 1.7 });
    monster(1390, 385);

    block("wood", 1570, 708, { angle: 90 });
    block("wood", 1745, 708, { angle: 90 });
    block("wood", 1658, 628, { scaleX: 1.46 });
    monster(1658, 563);

    // Keep the objective derived from the objects that were actually created so
    // adding more monsters or blocks to later stages needs no clear-rule change.
    this.totalBlocks = this.blocks.length;
    this.totalMonsters = this.monsters.length;
    this.remainingBlocks = this.totalBlocks;
    this.remainingMonsters = this.totalMonsters;
  }

  createHud() {
    this.timerText = this.add.text(960, 62, "20.26", {
      fontFamily: "Black Han Sans, sans-serif", fontSize: "94px", color: "#f56f9d",
      stroke: "#fff8e8", strokeThickness: 18,
    }).setOrigin(.5, 0).setDepth(30);

    this.gaugeBg = this.add.graphics().setDepth(25);
    this.gaugeBg.fillStyle(0xfff9ec, .93).fillRoundedRect(55, 280, 126, 430, 58);
    this.gaugeBg.lineStyle(6, 0xe87fa6).strokeRoundedRect(55, 280, 126, 430, 58);
    this.gaugeBg.fillStyle(0x6f4961).fillCircle(118, 245, 50);
    this.gaugeBg.fillStyle(0xffffff).fillCircle(118, 230, 16).fillRoundedRect(104, 224, 28, 47, 13);
    this.gaugeFill = this.add.graphics().setDepth(26);

    this.statePanel = this.add.graphics().setDepth(23);
    this.statePanel.fillStyle(0xfff8ec, .95).fillRoundedRect(500, 900, 920, 145, 44);
    this.statePanel.lineStyle(5, 0xee9ab4).strokeRoundedRect(500, 900, 920, 145, 44);
    this.stateLabels = ["두", "쫀~", "쿠"].map((label, index) => this.add.text(660 + index * 300, 920, label, {
      fontFamily: "Black Han Sans, sans-serif", fontSize: "49px", color: "#9c7d89",
      backgroundColor: "#eadfe2", padding: { x: 34, y: 12 },
    }).setOrigin(.5, 0).setDepth(26));
    this.add.text(810, 928, "→", { fontSize: "46px", color: "#d89a82" }).setDepth(26);
    this.add.text(1110, 928, "→", { fontSize: "46px", color: "#d89a82" }).setDepth(26);
    this.waveGraphics = this.add.graphics().setDepth(27);

    this.statsPanel = this.add.graphics().setDepth(23);
    this.statsPanel.fillStyle(0xfff8ec, .95).fillRoundedRect(1515, 835, 350, 210, 30);
    this.statsPanel.lineStyle(5, 0xee9ab4).strokeRoundedRect(1515, 835, 350, 210, 30);
    this.statsText = this.add.text(1545, 853, "", {
      fontFamily: "Gowun Dodum, sans-serif", fontStyle: "bold", fontSize: "26px", color: "#85546b", lineSpacing: 8,
    }).setDepth(26);
    this.statusText = this.add.text(960, 175, "마이크 준비 중… 주변 소음을 측정합니다", {
      fontFamily: "Gowun Dodum, sans-serif", fontStyle: "bold", fontSize: "28px", color: "#69485c",
      backgroundColor: "#fff8e8dd", padding: { x: 18, y: 10 },
    }).setOrigin(.5).setDepth(30);
    this.edgeWarning = this.add.graphics().setDepth(40);
  }

  startStage() {
    this.stageRunning = true;
    this.startedAt = performance.now();
    this.pausedDuration = 0;
    this.timerActive = this.debugVoice;
    gameEvents.emit(GAME_EVENTS.STAGE_START, { voiceEnabled: true, stageId: "dujjonku" });
    this.connectVoice();
  }

  async connectVoice() {
    this.voice?.destroy();
    this.statusText.setText("쉿! 주변 소음을 잠깐 측정하고 있어요…").setColor("#69485c");
    this.retryButton?.destroy();
    this.retryButton = null;
    this.voice = new DujjonkuVoiceController({
      onCalibrating: () => this.statusText?.setText("쉿! 주변 소음 측정 중…"),
      onReady: () => {
        this.micReady = true;
        if (!this.timerActive) {
          this.startedAt = performance.now();
          this.pausedDuration = 0;
          this.timerActive = true;
        }
        this.statusText?.setText("‘두’라고 말해 두쫀쿠를 장전하세요!").setColor("#4f7757");
      },
      onLevel: (payload) => this.onVoiceLevel(payload),
      onVoiceStart: () => this.onVoiceStart(),
      onVoiceEnd: () => this.onVoiceEnd(),
      onWord: (word) => this.onVoiceWord(word),
      onError: (message) => this.showMicError(message),
      onRecognitionUnavailable: () => this.statusText?.setText("음성 단어 인식 미지원 · 마이크 발성 감지는 작동합니다"),
    });
    try {
      await this.voice.connect();
    } catch (error) {
      this.showMicError(error.message);
    }
  }

  showMicError(message) {
    if (!this.scene?.isActive()) return;
    this.micReady = false;
    this.statusText.setText(message).setColor("#b53f5f");
    this.retryButton?.destroy();
    this.retryButton = this.add.text(960, 225, "마이크 다시 시도", {
      fontFamily: "Gowun Dodum, sans-serif", fontStyle: "bold", fontSize: "28px", color: "#ffffff",
      backgroundColor: "#e96f9a", padding: { x: 22, y: 12 },
    }).setOrigin(.5).setDepth(35).setInteractive({ useHandCursor: true });
    this.retryButton.on("pointerdown", () => this.connectVoice());
  }

  onVoiceLevel(payload) {
    this.voiceLevel = payload.normalized;
    this.waveSamples.push(payload.normalized);
    if (this.waveSamples.length > 36) this.waveSamples.shift();
  }

  onVoiceWord(word) {
    if (!this.isActiveStage()) return;
    const now = performance.now();
    if (now - this.lastActionAt < 220) return;
    if (word === "DU" && this.voiceState === DUJJONKU_STATE.WAITING) {
      this.lastActionAt = now;
      this.loadProjectile();
    } else if (word === "KU" && (
      this.voiceState === DUJJONKU_STATE.LOADED || this.voiceState === DUJJONKU_STATE.CHARGING
    )) {
      // 음량 시작 판정보다 단어 인식이 먼저 도착하는 짧은 "쿠"도 놓치지 않는다.
      if (this.voiceState === DUJJONKU_STATE.LOADED) {
        this.beginCharge();
        this.chargeMs = DUJJONKU_CONFIG.charge.minMs;
        this.chargePercent = DUJJONKU_CONFIG.charge.minimumPercent;
      }
      this.fireProjectile();
    }
  }

  onVoiceStart() {
    if (!this.isActiveStage()) return;
    if (this.voiceState === DUJJONKU_STATE.WAITING) {
      this.waitingVoiceStartedAt = performance.now();
    } else if (this.voiceState === DUJJONKU_STATE.LOADED) {
      this.beginCharge();
    }
  }

  onVoiceEnd() {
    if (!this.isActiveStage()) return;
    if (this.voiceState === DUJJONKU_STATE.WAITING && this.waitingVoiceStartedAt) {
      const spokenMs = performance.now() - this.waitingVoiceStartedAt;
      this.waitingVoiceStartedAt = 0;
      // 단어 API가 한 음절을 놓쳐도 짧고 분명한 첫 발성은 "두"로 안전하게 보완한다.
      if (spokenMs >= 80 && spokenMs <= 1250) this.loadProjectile();
    } else if (this.voiceState === DUJJONKU_STATE.CHARGING) {
      this.fireProjectile();
    }
  }

  loadProjectile() {
    if (this.voiceState !== DUJJONKU_STATE.WAITING || this.shotsLeft <= 0) return;
    this.voiceState = DUJJONKU_STATE.LOADED;
    this.waitingVoiceStartedAt = 0;
    this.chargeMs = 0;
    this.chargePercent = 0;
    // 장전 중에는 물리 바디가 구조물/월드와 상호작용하지 않는 순수 표시 객체를 쓴다.
    this.projectile = this.add.image(
      DUJJONKU_CONFIG.launcher.x,
      DUJJONKU_CONFIG.launcher.y,
      DUJJONKU_TEXTURES.projectile,
    ).setDepth(12).setDataEnabled();
    this.projectile.setData({ kind: "projectile-preview" });
    this.statusText.setText("다음 목소리로 ‘쫀~’ 충전!");
    this.updateStateHud();
  }

  beginCharge() {
    if (this.voiceState !== DUJJONKU_STATE.LOADED) return;
    this.voiceState = DUJJONKU_STATE.CHARGING;
    this.statusText.setText("쫀——! 소리를 놓으면 발사해요");
    this.updateStateHud();
  }

  fireProjectile() {
    if (this.voiceState !== DUJJONKU_STATE.CHARGING || !this.projectile) return;
    this.voiceState = DUJJONKU_STATE.FIRED;
    const cfg = DUJJONKU_CONFIG;
    const percent = Math.max(cfg.charge.minimumPercent, this.chargePercent);
    const power = Phaser.Math.Linear(cfg.launcher.minPower, cfg.launcher.maxPower, percent / 100);
    const radians = Phaser.Math.DegToRad(this.currentAngle);
    // 정적 바디를 해제하는 대신 발사 순간 새 동적 바디를 만들어 브라우저별 Matter 차이를 없앤다.
    const launchX = this.projectile.x;
    const launchY = this.projectile.y;
    this.projectile.destroy();
    this.projectile = this.matter.add.image(
      launchX,
      launchY,
      DUJJONKU_TEXTURES.projectile,
      null,
      {
        shape: { type: "circle", radius: 27 },
        density: .0038,
        restitution: .52,
        friction: .28,
        frictionAir: .004,
      },
    ).setDepth(12).setDataEnabled();
    this.projectile.setData({ kind: "projectile" });
    this.projectile.setVelocity(Math.cos(radians) * power, -Math.sin(radians) * power);
    this.projectile.setAngularVelocity(.13);
    this.projectileFiredAt = this.time.now;
    this.projectileSettledAt = 0;
    this.flightTimeout?.remove(false);
    this.flightTimeout = this.time.delayedCall(
      DUJJONKU_CONFIG.projectile.maxFlightMs,
      () => {
        if (this.voiceState === DUJJONKU_STATE.FIRED) this.prepareNextShot();
      },
    );
    window.clearTimeout(this.flightWallTimeout);
    this.flightWallTimeout = window.setTimeout(() => {
      if (this.voiceState !== DUJJONKU_STATE.FIRED || this.ended) return;
      if (this.paused) {
        this.flightExpiredWhilePaused = true;
        return;
      }
      this.prepareNextShot();
    }, DUJJONKU_CONFIG.projectile.maxFlightMs + 250);
    // 발사 순간 고무줄과 발사체의 시각적 연결을 끊는다.
    this.slingReleasedAt = this.time.now;
    this.shotsLeft -= 1;
    this.statusText.setText("쿠! 날아간다!");
    this.lastActionAt = performance.now();
    this.updateStateHud();
    if (this.debugVoice) {
      [100, 500, 1000].forEach((delay) => this.time.delayedCall(delay, () => {
        if (!this.projectile?.active) return;
        console.info("[두쫀쿠 발사 진단]", JSON.stringify({
          delay,
          state: this.voiceState,
          isStatic: this.projectile.body?.isStatic,
          x: Math.round(this.projectile.x),
          y: Math.round(this.projectile.y),
          vx: Number(this.projectile.body?.velocity?.x?.toFixed(2)),
          vy: Number(this.projectile.body?.velocity?.y?.toFixed(2)),
        }));
      }));
    }
  }

  createCollisionRules() {
    this.matter.world.on("collisionstart", this.handleCollision, this);
  }

  handleCollision(event) {
    event.pairs.forEach((pair) => {
      const a = pair.bodyA.gameObject;
      const b = pair.bodyB.gameObject;
      if (!a || !b) return;
      const aKind = a.getData?.("kind");
      const bKind = b.getData?.("kind");
      const velocityA = pair.bodyA.velocity || { x: 0, y: 0 };
      const velocityB = pair.bodyB.velocity || { x: 0, y: 0 };
      const impact = Math.hypot(velocityA.x - velocityB.x, velocityA.y - velocityB.y);
      if (aKind === "block") this.damageBlock(a, impact, b);
      if (bKind === "block") this.damageBlock(b, impact, a);
      if (aKind === "monster") this.damageMonster(a, impact, b);
      if (bKind === "monster") this.damageMonster(b, impact, a);
    });
  }

  damageBlock(block, impact, other) {
    if (block.getData("destroyed") || impact < 1.15) return;
    const sourceKind = other?.getData?.("kind");
    this.transferImpact(block, other, impact);
    const resistance = { wood: 1.9, star: 1.25, stone: 0.52 }[block.getData("blockType")] || 1;
    const multiplier = sourceKind === "projectile" ? resistance : resistance * 0.62;
    block.setData("hp", block.getData("hp") - impact * multiplier);
    const flashAlpha = block.getData("blockType") === "stone" ? .72 : .48;
    this.tweens.add({ targets: block, alpha: flashAlpha, duration: 65, yoyo: true });
    if (sourceKind === "projectile" && impact > 5) {
      this.cameras.main.shake(95, Phaser.Math.Clamp(impact / 1800, .003, .014));
      this.spawnImpactSpecks(block.x, block.y, block.getData("blockType"));
    }
    if (block.getData("blockType") === "star" && impact > 4.5) this.starBurst(block, impact);
    if (block.getData("hp") <= 0) this.destroyBlock(block);
  }

  transferImpact(block, source, impact) {
    if (!block?.active || !source?.body) return;
    const sourceVelocity = source.body.velocity || { x: 0, y: 0 };
    const speed = Math.hypot(sourceVelocity.x, sourceVelocity.y) || 1;
    const type = block.getData("blockType");
    const mobility = { wood: 1, star: .82, stone: .24 }[type] || .7;
    const force = Phaser.Math.Clamp((.01 + impact * .00062) * mobility, .003, .028);
    block.applyForce({
      x: sourceVelocity.x / speed * force,
      y: sourceVelocity.y / speed * force - .0015 * mobility,
    });
    const offset = Phaser.Math.Clamp((source.y - block.y) / 90, -1, 1);
    const spin = Phaser.Math.Clamp((sourceVelocity.x / speed) * offset * .11 * mobility, -.13, .13);
    block.setAngularVelocity(Phaser.Math.Clamp((block.body.angularVelocity || 0) + spin, -.18, .18));
  }

  spawnImpactSpecks(x, y, type) {
    const color = { wood: 0xf4bd77, stone: 0xd9e1e9, star: 0xffe16c }[type] || 0xffffff;
    for (let i = 0; i < 5; i += 1) {
      const speck = this.add.circle(x, y, Phaser.Math.Between(3, 6), color).setDepth(19);
      this.tweens.add({
        targets: speck,
        x: x + Phaser.Math.Between(-55, 55),
        y: y + Phaser.Math.Between(-70, 25),
        alpha: 0,
        duration: 260,
        onComplete: () => speck.destroy(),
      });
    }
  }

  starBurst(star, impact) {
    if (star.getData("burstAt") && this.time.now - star.getData("burstAt") < 500) return;
    star.setData("burstAt", this.time.now);
    this.blocks.forEach((block) => {
      if (!block.active || block === star) return;
      const distance = Phaser.Math.Distance.Between(star.x, star.y, block.x, block.y);
      if (distance > 230) return;
      const force = Math.max(.006, (230 - distance) / 10500);
      const angle = Phaser.Math.Angle.Between(star.x, star.y, block.x, block.y);
      block.applyForce({ x: Math.cos(angle) * force, y: Math.sin(angle) * force - .006 });
      block.setAngularVelocity(Phaser.Math.FloatBetween(-.14, .14));
      block.setData("hp", block.getData("hp") - impact * 1.8);
      if (block.getData("hp") <= 0) this.destroyBlock(block);
    });
    this.spawnBurst(star.x, star.y, 0xffe16c, 12);
  }

  destroyBlock(block) {
    if (!block.active || block.getData("destroyed")) return;
    block.setData("destroyed", true);
    this.remainingBlocks = Math.max(0, this.remainingBlocks - 1);
    this.spawnBurst(block.x, block.y, block.getData("blockType") === "stone" ? 0x9ba9ba : 0xd99555, 8);
    block.destroy();
    this.checkClearCondition();
  }

  damageMonster(monster, impact, other) {
    if (monster.getData("destroyed") || impact < 3) return;
    const source = other?.getData?.("kind");
    const damage = impact * (source === "projectile" ? 3 : 1.8);
    monster.setData("hp", monster.getData("hp") - damage);
    this.tweens.add({ targets: monster, scaleX: 1.22, scaleY: .78, duration: 75, yoyo: true });
    if (monster.getData("hp") <= 0 || impact > 18) this.removeMonster(monster);
  }

  removeMonster(monster) {
    if (!monster.active || monster.getData("destroyed")) return;
    monster.setData("destroyed", true);
    this.remainingMonsters = Math.max(0, this.remainingMonsters - 1);
    this.spawnBurst(monster.x, monster.y, 0xb8d96b, 14);
    monster.destroy();
    this.checkClearCondition();
  }

  checkClearCondition() {
    if (this.ended) return;
    if (this.remainingMonsters === 0 && this.remainingBlocks === 0) this.clearStage();
  }

  spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const piece = this.add.circle(x, y, Phaser.Math.Between(4, 10), color).setDepth(18);
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const distance = Phaser.Math.Between(35, 115);
      this.tweens.add({
        targets: piece, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance + 55,
        alpha: 0, angle: Phaser.Math.Between(-180, 180), duration: 520, ease: "Quad.easeOut",
        onComplete: () => piece.destroy(),
      });
    }
  }

  bindDebugVoice() {
    this.debugVoice = new URLSearchParams(window.location.search).get("debugVoice") === "1";
    if (!this.debugVoice) return;
    this.input.keyboard.on("keydown-D", () => this.onVoiceWord("DU"));
    this.input.keyboard.on("keydown-SPACE", () => this.onVoiceStart());
    this.input.keyboard.on("keyup-SPACE", () => this.onVoiceEnd());
    this.input.keyboard.on("keydown-K", () => this.onVoiceWord("KU"));
    this.add.text(25, 1040, "VOICE DEBUG", { fontSize: "16px", color: "#ffffff55" }).setDepth(50);
    const autoVoice = new URLSearchParams(window.location.search).get("autoVoice");
    if (autoVoice === "1") {
      this.time.delayedCall(1100, () => this.onVoiceWord("DU"));
      this.time.delayedCall(1450, () => {
        this.voice && (this.voice.voiceActive = true);
        this.onVoiceStart();
      });
      this.time.delayedCall(2850, () => {
        this.voice && (this.voice.voiceActive = false);
        this.onVoiceEnd();
      });
    } else if (autoVoice === "amplitude") {
      this.time.delayedCall(900, () => this.onVoiceStart());
      this.time.delayedCall(1220, () => this.onVoiceEnd());
      this.time.delayedCall(1600, () => {
        this.voice && (this.voice.voiceActive = true);
        this.onVoiceStart();
      });
      this.time.delayedCall(2850, () => {
        this.voice && (this.voice.voiceActive = false);
        this.onVoiceEnd();
      });
    } else if (autoVoice === "impact") {
      this.time.delayedCall(700, () => this.loadProjectile());
      this.time.delayedCall(1050, () => {
        this.beginCharge();
        this.currentAngle = 22;
        this.chargeMs = DUJJONKU_CONFIG.charge.maxMs;
        this.chargePercent = 100;
        this.fireProjectile();
      });
    } else if (autoVoice === "clear-check") {
      this.time.delayedCall(500, () => this.runClearConditionDebug());
    }
  }

  runClearConditionDebug() {
    const report = (step) => console.info("[두쫀쿠 클리어 조건 진단]", JSON.stringify({
      step,
      ended: this.ended,
      remainingMonsters: this.remainingMonsters,
      remainingBlocks: this.remainingBlocks,
    }));
    report("initial");
    this.removeMonster(this.monsters[0]);
    report("one-monster-destroyed");
    this.monsters.slice(1).forEach((monster) => this.removeMonster(monster));
    report("all-monsters-destroyed");
    this.blocks.slice(0, -1).forEach((block) => this.destroyBlock(block));
    report("one-block-left");
    this.destroyBlock(this.blocks[this.blocks.length - 1]);
    report("all-targets-destroyed");
  }

  update(time, delta) {
    if (!this.stageRunning || this.ended || this.paused) {
      this.drawDynamicHud();
      return;
    }
    if (!this.timerActive) {
      this.timerText.setText("20.26");
      this.drawLauncher();
      this.drawDynamicHud();
      return;
    }
    const cfg = DUJJONKU_CONFIG;
    const elapsed = performance.now() - this.startedAt - this.pausedDuration;
    const remaining = Math.max(0, cfg.timeMs - elapsed);
    this.timerText.setText((remaining / 1000).toFixed(2));
    gameEvents.emit(GAME_EVENTS.TIMER_TICK, { remainingMs: remaining });

    if (remaining <= cfg.warningMs) {
      this.timerText.setColor("#df355e");
      const pulse = .35 + Math.sin(time / 90) * .18;
      this.edgeWarning.clear().lineStyle(22, 0xff537e, pulse).strokeRect(8, 8, 1904, 1064);
      if (!this.warningFired) {
        this.warningFired = true;
        gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {});
      }
    }
    if (remaining <= 0) {
      this.failStage("시간이 끝났어요!");
      return;
    }

    if (this.voiceState === DUJJONKU_STATE.LOADED || this.voiceState === DUJJONKU_STATE.CHARGING) {
      const degreesPerMs = (cfg.launcher.maxAngle - cfg.launcher.minAngle) / (cfg.launcher.angleSweepMs / 2);
      this.currentAngle += degreesPerMs * delta * this.angleDirection;
      if (this.currentAngle >= cfg.launcher.maxAngle || this.currentAngle <= cfg.launcher.minAngle) {
        this.currentAngle = Phaser.Math.Clamp(this.currentAngle, cfg.launcher.minAngle, cfg.launcher.maxAngle);
        this.angleDirection *= -1;
      }
    }
    if (this.voiceState === DUJJONKU_STATE.CHARGING && this.voice?.voiceActive) {
      this.chargeMs = Math.min(cfg.charge.maxMs, this.chargeMs + delta);
      this.chargePercent = Phaser.Math.Clamp(this.chargeMs / cfg.charge.maxMs * 100, 0, 100);
    }
    if (this.projectile && (this.voiceState === DUJJONKU_STATE.LOADED || this.voiceState === DUJJONKU_STATE.CHARGING)) {
      const pull = Phaser.Math.Linear(8, 105, this.chargePercent / 100);
      const radians = Phaser.Math.DegToRad(this.currentAngle);
      this.projectile.setPosition(cfg.launcher.x - Math.cos(radians) * pull, cfg.launcher.y + Math.sin(radians) * pull);
    }
    if (this.voiceState === DUJJONKU_STATE.FIRED) this.monitorProjectile(time);
    this.drawLauncher();
    this.drawDynamicHud();
  }

  monitorProjectile(time) {
    if (!this.projectile?.active) return this.prepareNextShot();
    const config = DUJJONKU_CONFIG.projectile;
    const body = this.projectile.body;
    const outside = this.projectile.x > 1990 || this.projectile.x < -70 ||
      this.projectile.y > 1140 || this.projectile.y < -180;
    const sleeping = Boolean(body?.isSleeping);
    const stopped = sleeping || (body?.speed ?? 0) < config.settleSpeed;

    // 구조물 위, 공중섬, 화면 어느 높이에서 멈춰도 다음 발사를 준비한다.
    if (stopped) {
      if (!this.projectileSettledAt) this.projectileSettledAt = time;
    } else {
      this.projectileSettledAt = 0;
    }
    const settledLongEnough = this.projectileSettledAt &&
      time - this.projectileSettledAt > config.settleMs;
    // 아주 약하게 계속 흔들리는 접촉 상태도 영원히 FIRED에 머물지 않게 제한한다.
    const flightTimedOut = this.projectileFiredAt && time - this.projectileFiredAt > config.maxFlightMs;
    if (outside || settledLongEnough || flightTimedOut) {
      this.prepareNextShot();
    }
  }

  prepareNextShot() {
    if (this.voiceState === DUJJONKU_STATE.RESETTING) return;
    this.voiceState = DUJJONKU_STATE.RESETTING;
    this.statusText.setText("다음 두쫀쿠 준비 중…");
    this.updateStateHud();
    this.projectile?.destroy();
    this.projectile = null;
    this.flightTimeout?.remove(false);
    this.flightTimeout = null;
    window.clearTimeout(this.flightWallTimeout);
    this.flightWallTimeout = 0;
    this.flightExpiredWhilePaused = false;
    this.projectileFiredAt = 0;
    this.projectileSettledAt = 0;
    this.time.delayedCall(DUJJONKU_CONFIG.projectile.resetDelayMs, () => {
      if (this.ended) return;
      if (this.shotsLeft <= 0) return this.failStage("두쫀쿠를 모두 사용했어요!");
      this.voiceState = DUJJONKU_STATE.WAITING;
      this.chargeMs = 0;
      this.chargePercent = 0;
      this.statusText.setText("‘두’라고 말해 다음 두쫀쿠를 장전하세요!");
      this.updateStateHud();
    });
  }

  drawLauncher() {
    if (!this.launcherGraphics) return;
    const cfg = DUJJONKU_CONFIG.launcher;
    const isAttached = Boolean(
      this.projectile?.active && (
        this.voiceState === DUJJONKU_STATE.LOADED ||
        this.voiceState === DUJJONKU_STATE.CHARGING
      )
    );
    // FIRED 이후에는 움직이는 발사체 좌표를 절대 고무줄 끝점으로 사용하지 않는다.
    const projectileX = isAttached ? this.projectile.x : cfg.x;
    const projectileY = isAttached ? this.projectile.y : cfg.y;
    this.launcherGraphics.clear();
    // 뒤쪽 고무줄 → 나무 프레임 → 앞쪽 고무줄 순서로 그려 앵그리버드식 깊이를 만든다.
    this.launcherGraphics.lineStyle(9, 0x56303a, 1)
      .lineBetween(cfg.x + 28, cfg.y - 52, projectileX, projectileY);
    this.launcherGraphics.lineStyle(24, 0x8e5137, 1)
      .lineBetween(cfg.x - 42, cfg.y + 92, cfg.x - 28, cfg.y - 56)
      .lineBetween(cfg.x + 42, cfg.y + 92, cfg.x + 28, cfg.y - 56);
    this.launcherGraphics.lineStyle(9, 0x75404a, 1)
      .lineBetween(cfg.x - 28, cfg.y - 52, projectileX, projectileY);

    if (!isAttached) {
      this.launcherGraphics.fillStyle(0x6b3944, 1).fillEllipse(cfg.x, cfg.y, 25, 14);
    }
    this.drawTrajectory();
  }

  drawTrajectory() {
    this.trajectoryGraphics.clear();
    if (this.voiceState !== DUJJONKU_STATE.LOADED && this.voiceState !== DUJJONKU_STATE.CHARGING) return;
    const cfg = DUJJONKU_CONFIG;
    const percent = Math.max(cfg.charge.minimumPercent, this.chargePercent);
    const power = Phaser.Math.Linear(cfg.launcher.minPower, cfg.launcher.maxPower, percent / 100);
    const radians = Phaser.Math.DegToRad(this.currentAngle);
    const vx = Math.cos(radians) * power;
    const vy = -Math.sin(radians) * power;
    this.trajectoryGraphics.fillStyle(0xffffff, .88).lineStyle(2, 0xbe7792, .5);
    for (let step = 6; step <= 66; step += 4) {
      const x = cfg.launcher.x + vx * step;
      const y = cfg.launcher.y + vy * step + .14 * step * step;
      if (x > 1880 || y > 890) break;
      this.trajectoryGraphics.fillCircle(x, y, 7);
    }
  }

  drawDynamicHud() {
    if (!this.gaugeFill) return;
    const gauge = this.voiceState === DUJJONKU_STATE.CHARGING ? this.chargePercent / 100 : this.voiceLevel;
    const height = 345 * Phaser.Math.Clamp(gauge, 0, 1);
    this.gaugeFill.clear().fillStyle(this.voiceState === DUJJONKU_STATE.CHARGING ? 0xf47fa8 : 0x8a9ff5, .95)
      .fillRoundedRect(88, 665 - height, 60, height, 28);
    if (this.chargePercent >= 100 && this.voiceState === DUJJONKU_STATE.CHARGING) {
      this.gaugeFill.lineStyle(6, 0xffffff, .8).strokeRoundedRect(84 + Math.sin(this.time.now / 35) * 3, 315, 68, 355, 30);
    }
    this.waveGraphics.clear().lineStyle(4, 0xf07ea5, .78).beginPath();
    this.waveSamples.forEach((sample, index) => {
      const x = 560 + index * 23;
      const y = 1015 - sample * 38;
      if (index === 0) this.waveGraphics.moveTo(x, y); else this.waveGraphics.lineTo(x, y);
    });
    this.waveGraphics.strokePath();
    this.statsText.setText(
      `각도   ${Math.round(this.currentAngle)}°\n장력   ${Math.round(this.chargePercent)}%\n` +
      `남은 횟수   ${this.shotsLeft}\n목표   젤리 ${this.remainingMonsters} · 블록 ${this.remainingBlocks}`,
    );
  }

  updateStateHud() {
    if (!this.stateLabels) return;
    const activeIndex = {
      [DUJJONKU_STATE.WAITING]: 0,
      [DUJJONKU_STATE.LOADED]: 1,
      [DUJJONKU_STATE.CHARGING]: 1,
      [DUJJONKU_STATE.FIRED]: 2,
      [DUJJONKU_STATE.RESETTING]: 2,
    }[this.voiceState];
    this.stateLabels.forEach((label, index) => label.setStyle({
      color: index === activeIndex ? "#ffffff" : "#9c7d89",
      backgroundColor: index === activeIndex ? ["#ed6d98", "#f0ae52", "#659bdf"][index] : "#eadfe2",
    }));
  }

  endStage() {
    this.ended = true;
    this.stageRunning = false;
    this.voice?.destroy();
    this.voice = null;
    this.matter.world.pause();
  }

  clearStage() {
    if (this.ended) return;
    const elapsed = ((performance.now() - this.startedAt - this.pausedDuration) / 1000).toFixed(2);
    this.statusText.setText("피스타치오를 되찾았어요!");
    this.endStage();
    this.time.delayedCall(450, () => gameEvents.emit(GAME_EVENTS.STAGE_CLEAR, { elapsed, stageId: "dujjonku" }));
  }

  failStage(message) {
    if (this.ended) return;
    this.statusText.setText(message);
    this.endStage();
    this.time.delayedCall(450, () => gameEvents.emit(GAME_EVENTS.STAGE_FAIL, { stageId: "dujjonku" }));
  }

  pauseStage() {
    if (!this.isActiveStage()) return;
    this.paused = true;
    this.pausedAt = performance.now();
    this.matter.world.pause();
    this.voice?.destroy();
    this.voice = null;
    gameEvents.emit(GAME_EVENTS.STAGE_PAUSE, {});
  }

  resumeStage() {
    if (!this.paused || this.ended) return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.paused = false;
    this.matter.world.resume();
    gameEvents.emit(GAME_EVENTS.STAGE_RESUME, { voiceEnabled: true });
    this.connectVoice();
    if (this.flightExpiredWhilePaused && this.voiceState === DUJJONKU_STATE.FIRED) {
      this.flightExpiredWhilePaused = false;
      this.prepareNextShot();
    }
  }

  restartStage() {
    this.cleanup();
    this.scene.restart({ autoStart: true, voiceEnabled: true });
  }

  returnToMain() {
    this.cleanup();
    this.scene.stop();
  }

  cleanup() {
    this.flightTimeout?.remove(false);
    this.flightTimeout = null;
    window.clearTimeout(this.flightWallTimeout);
    this.flightWallTimeout = 0;
    this.voice?.destroy();
    this.voice = null;
    this.stageRunning = false;
    this.ended = true;
    this.matter?.world?.off("collisionstart", this.handleCollision, this);
    this.input?.keyboard?.removeAllListeners();
    document.body.classList.remove("dujjonku-active");
  }
}
