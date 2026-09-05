import { GRAVITY_COURSE, createGravityState, applyGravityJump, stepGravity } from "../gravity-core.mjs";
import { HEIGHT, clamp, emit } from "./shared.mjs";

// Stage 2: gravity. Hooks run with the shared Phaser scene as this.
export const e2 = {
  id: "gravity",
  build() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "중력 1.0×";
    const platforms = GRAVITY_COURSE.platforms;
    this.drawWalls(platforms, 0x3f4f65, 0x8399b4);
    this.add.graphics().lineStyle(2, 0xff756d, 0.4).lineBetween(175, HEIGHT - 2, 930, HEIGHT - 2);
    this.drawGoal(GRAVITY_COURSE.goal.x, GRAVITY_COURSE.goal.y, 19, "TOP");
    this.gravityArrows = this.add.graphics().setDepth(2);
    this.state = createGravityState();
    this.player = this.add.rectangle(this.state.x, this.state.y, 26, 34, 0xe9f6ff).setStrokeStyle(3, 0x7bc8ff).setDepth(5);
  },

  press(direction) {
    if (direction === "left" || direction === "right") this.state.direction = direction;
  },

  action() {
    const state = this.state;
    this.actions += 1;
    applyGravityJump(state, this.actions);
    this.risk = clamp((state.gravity - GRAVITY_COURSE.baseGravity) / (GRAVITY_COURSE.maxGravity - GRAVITY_COURSE.baseGravity) * 100, 0, 100);
    this.anomaly = `중력 ${(state.gravity / GRAVITY_COURSE.baseGravity).toFixed(2)}×`;
    this.setCorruption(this.risk * 0.7);
    emit("archive-sfx", { name: "action" });
  },

  update(dt) {
    const s = this.state;
    const result = stepGravity(s, dt);
    if (result.failed) { this.finish(false, "추락으로 기록 소실"); return; }
    if (result.landed) {
      this.shake(60 + this.risk * 0.4, 0.0015 + this.risk * 0.00004);
      if (this.settings.effects) {
        this.tweens.killTweensOf(this.player);
        this.player.setScale(1 + this.risk * 0.0016, 1 - this.risk * 0.002);
        this.tweens.add({ targets: this.player, scaleX: 1, scaleY: 1, duration: 130, ease: "Quad.Out" });
      }
    }
    this.player.setPosition(s.x, s.y);
    if (result.cleared) this.finish(true);
    this.gravityArrows.clear().lineStyle(2, 0xffb35d, 0.18 + this.risk / 170);
    for (let x = 72; x < 930; x += 74) {
      const length = 18 + this.risk * 0.28;
      this.gravityArrows.lineBetween(x, 52, x, 52 + length).lineBetween(x, 52 + length, x - 4, 62 + length).lineBetween(x, 52 + length, x + 4, 62 + length);
    }
  },

  release(direction) { if (this.state.direction === direction) this.state.direction = null; },
};
