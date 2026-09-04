/*
 * A(비주얼) 전용 — 플레이어 외형·점프 모션·말풍선.
 *
 * 물리 바디는 씬이 소유하고, 위치는 PLAYER_SYNC 이벤트로만 전달받는다.
 * 이 파일은 물리 값을 읽지도 쓰지도 않는다.
 */

class PlayerView {
  constructor(events, geometry, theme) {
    this.events = events;
    this.geo = geometry;
    this.theme = theme;
    this.scene = null;
    this.glow = null;
    this.icon = null;
    this.bubble = null;
    this.bubbleText = null;
    this.lastDirection = 1;

    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => this.build(scene));
    this.events.on(GAME_EVENTS.PLAYER_SYNC, (payload) => this.sync(payload));
    this.events.on(GAME_EVENTS.PLAYER_JUMP, (payload) => this.playJump(payload));
    this.events.on(GAME_EVENTS.COMMAND_RECOGNIZED, (payload) => this.showCommand(payload));
    this.events.on(GAME_EVENTS.VOICE_ONSET, () => this.playAnticipation());
  }

  build(scene) {
    this.scene = scene;
    const { player, speechBubble } = this.geo;

    this.glow = scene.add
      .circle(player.startX, player.startY, player.glowRadius, this.theme.color.cyan, this.theme.alpha.glow)
      .setDepth(this.theme.depth.player);

    // 캐릭터 스프라이트가 들어오면 이모지 대신 이미지를 쓴다.
    if (scene.textures.exists(TEXTURE_KEYS.player.idle)) {
      this.icon = scene.add
        .sprite(player.startX, player.startY, TEXTURE_KEYS.player.idle)
        .setOrigin(0.5, 1)
        .setDepth(this.theme.depth.playerIcon);
    } else {
      this.icon = scene.add
        .text(player.startX, this.geo.floorY + 6, "🕺", { fontSize: this.theme.font.playerIcon })
        .setOrigin(0.5, 1)
        .setDepth(this.theme.depth.playerIcon);
    }

    this.bubble = scene.add
      .container(player.startX, player.startY + player.bubbleOffsetY)
      .setAlpha(0)
      .setDepth(this.theme.depth.bubble);

    const backdrop = scene.textures.exists(TEXTURE_KEYS.speechBubble)
      ? scene.add.image(0, 0, TEXTURE_KEYS.speechBubble).setDisplaySize(speechBubble.width, speechBubble.height)
      : scene.add
          .rectangle(0, 0, speechBubble.width, speechBubble.height, this.theme.color.ink, this.theme.alpha.bubble)
          .setStrokeStyle(3, this.theme.color.white, this.theme.alpha.bubbleStroke);

    this.bubbleText = scene.add.text(0, 0, "", this.theme.label(this.theme.text.bubble)).setOrigin(0.5);
    this.bubble.add([backdrop, this.bubbleText]);

    const face = ({ direction }) => this.setFacing(direction);
    const dance = () => this.playFishingDance();
    const fall = () => this.icon?.setAlpha(0);
    const recover = () => this.playRecovery();
    scene.events.on(GEOJE_STAGE_EVENTS.FACING, face);
    scene.events.on(GEOJE_STAGE_EVENTS.FISHING_START, dance);
    scene.events.on(GEOJE_STAGE_EVENTS.FALL_START, fall);
    scene.events.on(GEOJE_STAGE_EVENTS.FALL_COMPLETE, recover);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(GEOJE_STAGE_EVENTS.FACING, face);
      scene.events.off(GEOJE_STAGE_EVENTS.FISHING_START, dance);
      scene.events.off(GEOJE_STAGE_EVENTS.FALL_START, fall);
      scene.events.off(GEOJE_STAGE_EVENTS.FALL_COMPLETE, recover);
    });
  }

  sync(payload) {
    if (!this.icon || !payload) return;
    const { player } = this.geo;

    this.glow.setPosition(payload.x, payload.y);
    this.icon.setPosition(payload.x, payload.y + player.iconOffsetY);
    if (payload.velocityX) this.setFacing(payload.velocityX >= 0 ? 1 : -1);
    if (this.bubble.alpha > 0) {
      this.bubble.setPosition(payload.x, payload.y + player.bubbleOffsetY);
    }
  }

  setFacing(direction) {
    if (!this.icon || !direction) return;
    this.lastDirection = direction >= 0 ? 1 : -1;
    this.icon.setFlipX(this.lastDirection < 0);
  }

  playFishingDance() {
    if (!this.icon) return;
    this.scene.tweens.killTweensOf(this.icon);
    this.scene.tweens.add({
      targets: this.icon,
      angle: { from: -14, to: 14 },
      scaleX: { from: 0.94, to: 1.08 },
      scaleY: { from: 1.08, to: 0.94 },
      duration: 150,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.icon?.setAngle(0).setScale(1),
    });
  }

  playRecovery() {
    if (!this.icon) return;
    this.icon.setAlpha(1).setScale(0.75);
    this.scene.tweens.add({
      targets: this.icon,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: "Back.easeOut",
    });
  }

  playAnticipation() {
    if (!this.icon) return;
    // 음성 인식 결과(수백ms~1s 지연)를 기다리지 않고, 마이크가 발화를 감지한
    // 즉시 살짝 반응해서 "말하자마자 반응한다"는 체감을 만든다. 실제 명령
    // 판정과 물리 반응은 그대로 COMMAND_RECOGNIZED 이후에만 적용된다.
    if (this.anticipationTween) this.anticipationTween.stop();
    this.icon.setScale(1);
    this.anticipationTween = this.scene.tweens.add({
      targets: this.icon,
      scaleX: { from: 0.92, to: 1 },
      scaleY: { from: 1.06, to: 1 },
      duration: 90,
      ease: "Quad.easeOut",
    });
  }

  playJump(payload) {
    if (!this.icon) return;
    // 씬이 알려준 진행 방향을 우선 쓰고, 없으면 마지막 속도 방향으로 기운다.
    const direction = payload?.direction ?? this.lastDirection;
    this.scene.tweens.add({
      targets: this.icon,
      angle: direction >= 0 ? this.theme.motion.jumpTiltDegrees : -this.theme.motion.jumpTiltDegrees,
      duration: this.theme.motion.jumpTiltDuration,
      yoyo: true,
    });
  }

  showCommand({ command, level }) {
    if (!this.bubble) return;
    const entry = COMMAND_BY_KEY[command];
    if (!entry) return;

    const text = command === "JUMP" ? `${entry.bubble} ${level}` : entry.bubble;
    this.bubbleText.setText(text);
    this.bubble.setAlpha(1);
    this.scene.tweens.killTweensOf(this.bubble);
    this.scene.tweens.add({
      targets: this.bubble,
      alpha: 0,
      delay: this.theme.motion.bubbleHoldMs,
      duration: this.theme.motion.bubbleFadeMs,
    });
  }
}

const playerView = new PlayerView(gameEvents, STAGE_GEOMETRY, THEME);
