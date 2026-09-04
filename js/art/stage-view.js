/*
 * A(비주얼) 전용 — 배경·지면·장애물·포토존의 외형.
 *
 * 물리 바디는 scene/stage-scene.js가 따로 만든다. 이 파일은 보이는 것만 담당한다.
 * 모든 그리기는 "텍스처가 있으면 이미지, 없으면 프리미티브" 폴백 구조라서
 * C1이 이미지를 채워 넣는 동안에도 게임이 멈추지 않는다.
 */

class StageView {
  constructor(events, geometry, theme) {
    this.events = events;
    this.geo = geometry;
    this.theme = theme;
    this.scene = null;
    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => this.build(scene));
  }

  build(scene) {
    this.scene = scene;
    registerSpriteAnimations(scene);
    this.drawBackground();
    this.drawGround();
    this.geo.obstacles.forEach((obstacle) => this.drawObstacle(obstacle));
    this.drawPhotoZone();
  }

  drawBackground() {
    const { canvas } = this.geo;
    this.scene.add
      .image(canvas.width / 2, canvas.height / 2, TEXTURE_KEYS.background)
      .setDisplaySize(canvas.width, canvas.height)
      .setDepth(this.theme.depth.background);
  }

  drawGround() {
    const { ground, canvas, floorY } = this.geo;

    if (this.scene.textures.exists(TEXTURE_KEYS.ground)) {
      this.scene.add
        .tileSprite(ground.x, ground.y, ground.width, ground.height, TEXTURE_KEYS.ground)
        .setDepth(this.theme.depth.ground);
      return;
    }

    this.scene.add
      .rectangle(ground.x, ground.y, ground.width, ground.height, this.theme.color.groundFill, this.theme.alpha.ground)
      .setDepth(this.theme.depth.ground);
    this.scene.add
      .rectangle(canvas.width / 2, floorY, canvas.width, ground.lineThickness, this.theme.color.cyan, this.theme.alpha.floorLine)
      .setDepth(this.theme.depth.ground);
  }

  drawObstacle(obstacle) {
    const textureKey = TEXTURE_KEYS.obstacle[obstacle.tier];

    if (this.scene.textures.exists(textureKey)) {
      this.scene.add
        .image(obstacle.x, obstacle.y, textureKey)
        .setDisplaySize(obstacle.width, obstacle.height)
        .setDepth(this.theme.depth.props);
    } else {
      const fill = obstacle.tier === "HIGH" ? this.theme.color.coral : this.theme.color.yellow;
      this.scene.add
        .rectangle(obstacle.x, obstacle.y, obstacle.width, obstacle.height, fill, this.theme.alpha.obstacle)
        .setStrokeStyle(5, this.theme.color.ink, this.theme.alpha.obstacleStroke)
        .setDepth(this.theme.depth.props);
    }

    this.scene.add
      .text(
        obstacle.x,
        obstacle.y - obstacle.height / 2 - 30,
        STRINGS.stage.obstacleTier[obstacle.tier],
        this.theme.label(this.theme.text.obstacleTier),
      )
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }

  drawPhotoZone() {
    const { photoZone } = this.geo;

    if (this.scene.textures.exists(TEXTURE_KEYS.photoZone)) {
      this.scene.add
        .image(photoZone.goal.x, photoZone.goal.y, TEXTURE_KEYS.photoZone)
        .setDepth(this.theme.depth.props);
    } else {
      photoZone.frame.forEach((bar) => {
        this.scene.add
          .rectangle(bar.x, bar.y, bar.width, bar.height, this.theme.color.cyan, this.theme.alpha.photoZone)
          .setDepth(this.theme.depth.props);
      });
    }

    this.scene.add
      .text(photoZone.label.x, photoZone.label.y, STRINGS.stage.photoZone, {
        ...this.theme.label(this.theme.text.photoZone),
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(this.theme.depth.props);
  }
}

const stageView = new StageView(gameEvents, STAGE_GEOMETRY, THEME);
