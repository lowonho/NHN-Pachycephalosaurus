/* global Phaser */
/*
 * A(비주얼) 전용 — 거제 야호 왕복형 스테이지 외형과 연출.
 *
 * 실제 충돌면은 scene/stage-scene.js가 만들고 이 파일은 같은 geometry를 이용해
 * 데크·갯바위·낚싯대·발판·포토존을 그린다. 이미지가 추가되기 전까지 모두 교체하기
 * 쉬운 이름을 가진 Phaser 프리미티브로 표시한다.
 */

class StageView {
  constructor(events, geometry, theme) {
    this.events = events;
    this.geo = geometry;
    this.theme = theme;
    this.scene = null;
    this.localHandlers = [];
    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => this.build(scene));
  }

  build(scene) {
    this.scene = scene;
    this.localHandlers = [];
    registerSpriteAnimations(scene);
    this.drawBackground();
    this.drawRouteGuide();
    this.geo.lowerPlatforms.forEach((platform) => this.drawPlatform(platform));
    this.drawBreakwaterGap();
    this.drawSlipperyRocks();
    this.drawStopZone();
    this.drawSafetyNet();
    this.geo.upperPlatforms.forEach((platform) => this.drawPlatform(platform));
    this.drawMovingPlatform();
    this.drawFishingRig();
    this.drawPhotoZone();
    this.bindStageEvents();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbindStageEvents());
  }

  drawBackground() {
    const { canvas } = this.geo;
    this.scene.add
      .image(canvas.width / 2, canvas.height / 2, TEXTURE_KEYS.background)
      .setDisplaySize(canvas.width, canvas.height)
      .setScrollFactor(0)
      .setDepth(this.theme.depth.background);

    this.scene.add
      .rectangle(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height, 0x061537, 0.16)
      .setScrollFactor(0)
      .setDepth(this.theme.depth.background + 1);
  }

  drawRouteGuide() {
    const guideStyle = this.theme.label({
      fontSize: "22px",
      color: this.theme.css.cyan,
      strokeThickness: 7,
    });

    this.scene.add
      .text(265, 790, "START  →", guideStyle)
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
    this.scene.add
      .text(2450, 535, "←  UPPER RETURN", guideStyle)
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }

  platformColor(kind) {
    if (kind === "deck") return 0x99633b;
    if (kind === "breakwater") return 0x697895;
    if (kind === "rock") return 0x40566c;
    if (kind === "stop") return 0x23587b;
    if (kind === "tilt") return this.theme.color.coral;
    if (kind === "photo") return 0x7a3b82;
    return 0x305a72;
  }

  drawPlatform(platform) {
    const fill = this.platformColor(platform.kind);
    const body = this.scene.add
      .rectangle(platform.x, platform.y, platform.width, platform.height, fill, 0.96)
      .setStrokeStyle(5, this.theme.color.ink, 0.85)
      .setDepth(this.theme.depth.ground);

    this.scene.add
      .rectangle(
        platform.x,
        platform.y - platform.height / 2 + 5,
        platform.width,
        10,
        platform.kind === "rock" ? this.theme.color.cyan : this.theme.color.yellow,
        0.72,
      )
      .setDepth(this.theme.depth.ground + 1);

    if (platform.id === "tilt-platform") this.tiltPlatformVisual = body;
  }

  drawBreakwaterGap() {
    const gap = this.geo.breakwaterGap;
    this.scene.add
      .text(gap.x, gap.y, "🌊", { fontSize: "62px" })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
    this.scene.add
      .text(
        gap.x,
        gap.y - 105,
        "LOW 야호도 OK",
        this.theme.label({ fontSize: "22px", color: this.theme.css.white, strokeThickness: 7 }),
      )
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }

  drawSlipperyRocks() {
    const zone = this.geo.slipperyZone;
    for (let i = 0; i < 6; i += 1) {
      this.scene.add
        .ellipse(zone.x - 270 + i * 105, 914 + i * 9, 92, 18, this.theme.color.cyan, 0.32)
        .setDepth(this.theme.depth.props);
    }
    this.scene.add
      .text(
        zone.x,
        820,
        "미끄러운 갯바위",
        this.theme.label({ fontSize: "25px", color: this.theme.css.cyan, strokeThickness: 8 }),
      )
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }

  drawStopZone() {
    const zone = this.geo.stopZone;
    this.scene.add
      .rectangle(zone.x, 905, zone.width - 24, 104, this.theme.color.yellow, 0.18)
      .setStrokeStyle(7, this.theme.color.yellow, 0.95)
      .setDepth(this.theme.depth.props);
    this.scene.add
      .text(
        zone.x,
        875,
        "맛떼루용  STOP",
        this.theme.label({ fontSize: "29px", color: this.theme.css.yellow, strokeThickness: 9 }),
      )
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props + 1);
    this.scene.add
      .text(
        zone.x,
        916,
        "여기서 파라파라!",
        this.theme.label({ fontSize: "22px", color: this.theme.css.white, strokeThickness: 7 }),
      )
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props + 1);
  }

  drawSafetyNet() {
    const net = this.geo.safetyNet;
    this.scene.add
      .rectangle(net.x, net.y, net.width, net.height, this.theme.color.coral, 0.28)
      .setStrokeStyle(6, this.theme.color.coral, 0.95)
      .setDepth(this.theme.depth.props);
    for (let y = net.y - net.height / 2 + 24; y < net.y + net.height / 2; y += 34) {
      this.scene.add
        .line(net.x, y, -net.width / 2, 0, net.width / 2, 0, this.theme.color.white, 0.6)
        .setLineWidth(2)
        .setDepth(this.theme.depth.props + 1);
    }
    this.scene.add
      .text(net.x - 15, net.y - net.height / 2 - 35, "SAFETY NET", {
        fontFamily: this.theme.font.display,
        fontSize: "18px",
        color: this.theme.css.coral,
        stroke: this.theme.css.ink,
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5)
      .setDepth(this.theme.depth.props);
  }

  drawMovingPlatform() {
    const platform = this.geo.movingPlatform;
    this.movingPlatformVisual = this.scene.add
      .rectangle(
        platform.x,
        platform.y,
        platform.width,
        platform.height,
        this.theme.color.cyan,
        0.92,
      )
      .setStrokeStyle(5, this.theme.color.ink, 0.9)
      .setDepth(this.theme.depth.props);
    this.movingPlatformLabel = this.scene.add
      .text(platform.x, platform.y - 43, "WAVE  ↕", {
        fontFamily: this.theme.font.display,
        fontSize: "20px",
        color: this.theme.css.white,
        stroke: this.theme.css.ink,
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }

  drawFishingRig() {
    const { fishing } = this.geo;
    this.npc = this.scene.add.container(fishing.npc.x, fishing.npc.y).setDepth(this.theme.depth.props + 3);
    const npcBody = this.scene.add.circle(0, 0, 52, this.theme.color.coral, 0.96)
      .setStrokeStyle(5, this.theme.color.white, 0.9);
    const npcFace = this.scene.add.text(0, -4, "원이", {
      fontFamily: this.theme.font.display,
      fontSize: "25px",
      color: this.theme.css.white,
      stroke: this.theme.css.ink,
      strokeThickness: 7,
    }).setOrigin(0.5);
    this.npc.add([npcBody, npcFace]);

    this.rod = this.scene.add
      .rectangle(fishing.rod.x, fishing.rod.y, fishing.rod.length, 12, this.theme.color.yellow, 1)
      .setStrokeStyle(3, this.theme.color.ink, 0.9)
      .setOrigin(0, 0.5)
      .setAngle(154)
      .setDepth(this.theme.depth.props + 2);

    this.fishingLine = this.scene.add.graphics().setDepth(this.theme.depth.props + 1);
    this.basket = this.scene.add.container(
      fishing.basket.startX,
      fishing.basket.startY,
    ).setDepth(this.theme.depth.props + 2);
    const basketRim = this.scene.add
      .ellipse(0, 0, fishing.basket.width, fishing.basket.height, this.theme.color.yellow, 0.94)
      .setStrokeStyle(5, this.theme.color.ink, 0.9);
    const basketNet = this.scene.add
      .ellipse(0, 14, fishing.basket.width - 20, fishing.basket.height + 34, 0x8a6338, 0.45)
      .setStrokeStyle(3, this.theme.color.yellow, 0.8);
    this.basket.add([basketNet, basketRim]);
    this.redrawFishingLine();
  }

  getRodTip() {
    const radians = Phaser.Math.DegToRad(this.rod.angle);
    return {
      x: this.rod.x + Math.cos(radians) * this.rod.width,
      y: this.rod.y + Math.sin(radians) * this.rod.width,
    };
  }

  redrawFishingLine() {
    if (!this.fishingLine || !this.basket || !this.rod) return;
    const tip = this.getRodTip();
    this.fishingLine.clear();
    this.fishingLine.lineStyle(5, 0xf4f4ff, 0.9);
    this.fishingLine.beginPath();
    this.fishingLine.moveTo(tip.x, tip.y);
    this.fishingLine.lineTo(this.basket.x, this.basket.y);
    this.fishingLine.strokePath();
  }

  drawPhotoZone() {
    const { photoZone } = this.geo;

    photoZone.frame.forEach((bar) => {
      this.scene.add
        .rectangle(bar.x, bar.y, bar.width, bar.height, this.theme.color.cyan, 0.92)
        .setDepth(this.theme.depth.props);
    });

    this.scene.add
      .text(photoZone.label.x, photoZone.label.y, "GEOJE\nPHOTO ZONE", {
        ...this.theme.label(this.theme.text.photoZone),
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
    this.scene.add
      .text(285, 255, "💖", { fontSize: "60px" })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props + 1);
    this.scene.add
      .text(675, 255, "💖", { fontSize: "60px" })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props + 1);
    this.scene.add
      .text(480, 370, "📸", { fontSize: "70px" })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props + 1);

    this.photoNpc = this.scene.add
      .text(photoZone.npcPose.x + 180, photoZone.npcPose.y, "💃", { fontSize: "82px" })
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(this.theme.depth.playerIcon);
  }

  bindStageEvents() {
    this.onLocal(GEOJE_STAGE_EVENTS.FISHING_START, (payload) => this.playFishingStart(payload));
    this.onLocal(GEOJE_STAGE_EVENTS.FISHING_PROGRESS, (payload) => this.syncFishing(payload));
    this.onLocal(GEOJE_STAGE_EVENTS.FISHING_COMPLETE, () => this.finishFishing());
    this.onLocal(GEOJE_STAGE_EVENTS.MOVING_PLATFORM_SYNC, ({ y }) => this.syncMovingPlatform(y));
    this.onLocal(GEOJE_STAGE_EVENTS.TILT_START, () => this.playTilt());
    this.onLocal(GEOJE_STAGE_EVENTS.NET_HIT, (payload) => this.playNetHit(payload));
    this.onLocal(GEOJE_STAGE_EVENTS.CLEAR_POSE, (payload) => this.playClearPose(payload));
  }

  onLocal(event, handler) {
    this.scene.events.on(event, handler);
    this.localHandlers.push([event, handler]);
  }

  unbindStageEvents() {
    this.localHandlers.forEach(([event, handler]) => this.scene?.events.off(event, handler));
    this.localHandlers = [];
    this.scene = null;
  }

  playFishingStart({ x, y }) {
    this.scene.tweens.killTweensOf([this.npc, this.rod, this.basket]);
    this.scene.tweens.add({
      targets: this.npc,
      angle: -14,
      duration: 260,
      yoyo: true,
      repeat: 2,
    });
    this.scene.tweens.add({
      targets: this.rod,
      angle: 142,
      duration: 380,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: this.basket,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 150,
      yoyo: true,
      repeat: 3,
    });

    ["💖", "✨", "💗", "✨"].forEach((symbol, index) => {
      const sparkle = this.scene.add
        .text(x - 90 + index * 60, y - 80, symbol, { fontSize: "44px" })
        .setOrigin(0.5)
        .setDepth(this.theme.depth.bubble);
      this.scene.tweens.add({
        targets: sparkle,
        y: y - 210 - (index % 2) * 35,
        alpha: 0,
        delay: index * 90,
        duration: 680,
        onComplete: () => sparkle.destroy(),
      });
    });
  }

  syncFishing({ x, y, progress }) {
    this.basket.setPosition(x, y);
    this.rod.setAngle(142 - Math.sin(progress * Math.PI) * 8);
    this.redrawFishingLine();
  }

  finishFishing() {
    this.basket.setAlpha(0.55);
    this.npc.setAngle(0);
    this.rod.setAngle(150);
    this.redrawFishingLine();
  }

  syncMovingPlatform(y) {
    this.movingPlatformVisual?.setY(y);
    this.movingPlatformLabel?.setY(y - 43);
  }

  playTilt() {
    if (!this.tiltPlatformVisual) return;
    this.scene.tweens.killTweensOf(this.tiltPlatformVisual);
    this.scene.tweens.add({
      targets: this.tiltPlatformVisual,
      angle: -9,
      duration: 260,
      ease: "Sine.easeOut",
      hold: 620,
      yoyo: true,
    });
  }

  playNetHit({ x, y }) {
    const stars = this.scene.add
      .text(x - 35, y - 95, "💫", { fontSize: "58px" })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.bubble);
    this.scene.tweens.add({
      targets: stars,
      angle: 180,
      y: y - 145,
      alpha: 0,
      duration: BALANCE.geoje.netStunMs,
      onComplete: () => stars.destroy(),
    });
  }

  playClearPose({ npc }) {
    this.photoNpc.setPosition(npc.x + 150, npc.y).setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: this.photoNpc,
      x: npc.x,
      alpha: 1,
      angle: -8,
      duration: 320,
      ease: "Back.easeOut",
    });
  }
}

const stageView = new StageView(gameEvents, STAGE_GEOMETRY, THEME);
