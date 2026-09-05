import { BOUNCE_COURSE, createBounceState, stepBounce } from "../bounce-core.mjs";
import { clamp, emit } from "./shared.mjs";

// Stage 3: bounce. Hooks run with the shared Phaser scene as this.
export const e3 = {
  id: "bounce",
  build() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "바운스 1.0×";
    this.state = createBounceState();
    this.drawWalls(BOUNCE_COURSE.walls.filter(w => !w.oneWay), 0x315169, 0x789bb7);
    this.drawWalls(BOUNCE_COURSE.walls.filter(w => w.oneWay), 0x5a4930, 0xffd27c);
    const marks = this.add.graphics();
    marks.lineStyle(2, 0xf47777, 0.8).lineBetween(145, 532, 930, 532);
    for (let x = 153; x < 920; x += 24) {
      marks.lineBetween(x, 529, x + 5, 534).lineBetween(x + 5, 534, x + 10, 529);
    }
    marks.lineStyle(3, 0xffb35d, 0.7).lineBetween(650, 325, 762, 325);
    const goal = BOUNCE_COURSE.goal;
    this.drawGoal(goal.x, goal.y, goal.radius, "CORE");
    this.player = this.add.circle(this.state.x, this.state.y, 12, 0xf0f8ff)
      .setStrokeStyle(3, 0xb7d4ff).setDepth(5);
  },

  update(dt) {
    const s = this.state;
    const result = stepBounce(s, dt);
    this.actions = s.bounces;
    this.risk = clamp((s.bounceHeight - BOUNCE_COURSE.initialHeight) / (BOUNCE_COURSE.maxHeight - BOUNCE_COURSE.initialHeight) * 100, 0, 100);
    this.anomaly = `바운스 ${(s.bounceHeight / BOUNCE_COURSE.initialHeight).toFixed(1)}×`;
    this.setCorruption(this.risk * 0.25);
    if (result.landed) {
      emit("archive-sfx", { name: "action" });
      if (this.settings.effects) {
        this.tweens.killTweensOf(this.player);
        this.player.setScale(1.18, 0.82);
        this.tweens.add({ targets: this.player, scaleX: 1, scaleY: 1, duration: 150 });
      }
    }
    this.player.setPosition(s.x, s.y);
    if (result.failed) this.finish(false, "추락으로 기록 소실");
    else if (result.cleared) this.finish(true);
  },

  release(direction) { if (this.state.direction === direction) this.state.direction = null; },
  press(direction) { if (direction === "left" || direction === "right") this.state.direction = direction; },
};
