import { BALL_RADIUS, GOAL, PHYSICS, START, WALLS, ROUTE, FRAGMENT_ROUTE } from "../level-data.mjs";
import { createBallState, registerDirection, releaseDirection, riskLabel, stepBall } from "../physics-core.mjs";
import { WIDTH, HEIGHT, clamp, emit } from "./shared.mjs";

// Stage 1: maze. Hooks run with the shared Phaser scene as this.
export const e1 = {
  id: "maze",
  build() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "안정";
    this.drawWalls(WALLS, 0x164d48, 0x4ca78f);
    this.drawGoal(GOAL.x, GOAL.y, GOAL.radius);
    const guide = this.add.graphics().setDepth(1);
    guide.lineStyle(2, 0x56ddfb, 0.2).beginPath().moveTo(START.x, START.y);
    for (const point of ROUTE) guide.lineTo(point.x, point.y);
    guide.strokePath();
    guide.lineStyle(2, 0xffd27c, 0.2).beginPath().moveTo(GOAL.x, GOAL.y);
    for (const point of FRAGMENT_ROUTE.slice(4)) guide.lineTo(point.x, point.y);
    guide.strokePath();
    this.add.text(175, 405, "HOLD →", { fontFamily: "monospace", fontSize: "13px", color: "#78bdc8" }).setOrigin(0.5);
    this.add.text(300, 365, "TURN ↑", { fontFamily: "monospace", fontSize: "13px", color: "#78bdc8" }).setOrigin(0.5);
    this.add.text(515, 290, "TURN ↓", { fontFamily: "monospace", fontSize: "13px", color: "#78bdc8" }).setOrigin(0.5);
    this.add.text(GOAL.x, GOAL.y - 48, "BRAKE", { fontFamily: "monospace", fontSize: "12px", color: "#93fca0" }).setOrigin(0.5);
    this.add.text(850, 365, "MEMORY ↑", { fontFamily: "monospace", fontSize: "12px", color: "#ffd27c" }).setOrigin(0.5);
    this.add.text(128, 230, "벽 충돌 −1.00초\n반대 방향으로 제동", { fontFamily: "sans-serif", fontSize: "15px", color: "#e1c29a", align: "center", lineSpacing: 8 }).setOrigin(0.5).setDepth(3);
    this.state = {
      ball: createBallState(),
      goalHold: 0,
      wasInside: false,
      overruns: 0,
      trail: [],
    };
    this.trailGraphics = this.add.graphics().setDepth(4);
    this.playerGlow = this.add.circle(START.x, START.y, BALL_RADIUS + 8, 0x56ddfb, 0.13).setDepth(5);
    this.player = this.add.circle(START.x, START.y, BALL_RADIUS, 0xe7fbff, 1).setStrokeStyle(3, 0x56ddfb).setDepth(6);
    this.goalProgress = this.add.graphics().setDepth(5);
    this.goalText = this.add.text(GOAL.x, GOAL.y, "0%", { fontFamily: "monospace", fontSize: "10px", color: "#d9ffdd" }).setOrigin(0.5).setDepth(6);
  },

  press(direction) {
    registerDirection(this.state.ball, direction);
    this.actions = this.state.ball.presses;
    this.risk = clamp((this.state.ball.multiplier - 1) / (PHYSICS.maxMultiplier - 1) * 100, 0, 100);
    this.anomaly = riskLabel(this.actions);
    this.setCorruption(this.risk);
    if (this.actions >= 7) this.shake(45, 0.0015 * Math.min(4, this.actions - 5));
    emit("archive-sfx", { name: "action" });
  },

  update(dt) {
    const state = this.state;
    const previousHits = state.ball.collisions;
    stepBall(state.ball, dt);
    if (state.ball.collisions > previousHits) {
      this.timePenalty += PHYSICS.wallPenaltySeconds;
      this.remaining = Math.max(0, this.remaining - PHYSICS.wallPenaltySeconds);
      const penalty = this.add.text(clamp(state.ball.x, 85, WIDTH - 85), clamp(state.ball.y - 30, 155, HEIGHT - 60), "−1.00s", {
        fontFamily: "monospace", fontSize: "25px", color: "#ff947d", stroke: "#07141d", strokeThickness: 5,
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: penalty, y: penalty.y - 22, alpha: 0, delay: 250, duration: 500, onComplete: () => penalty.destroy() });
      emit("archive-wall-hit", { seconds: PHYSICS.wallPenaltySeconds });
      emit("archive-sfx", { name: "warning" });
      this.shake(90, 0.003);
      if (this.remaining <= 0) { this.finish(false); return; }
    }
    state.trail.unshift({ x: state.ball.x, y: state.ball.y });
    state.trail.length = Math.min(14, 4 + Math.floor(state.ball.multiplier * 3));
    this.trailGraphics.clear();
    state.trail.forEach((point, index) => {
      const alpha = 1 - index / state.trail.length;
      this.trailGraphics.fillStyle(0x56ddfb, alpha * 0.12 * state.ball.multiplier).fillCircle(point.x, point.y, BALL_RADIUS * alpha * 0.72);
    });
    this.player.setPosition(state.ball.x, state.ball.y);
    this.playerGlow.setPosition(state.ball.x, state.ball.y).setScale(0.95 + state.ball.multiplier * 0.1);

    const speed = Math.hypot(state.ball.vx, state.ball.vy);
    const inside = Math.hypot(state.ball.x - GOAL.x, state.ball.y - GOAL.y) <= GOAL.radius;
    if (inside && speed <= PHYSICS.goalMaxSpeed) state.goalHold += dt;
    else if (!inside) state.goalHold = 0;
    else state.goalHold = Math.max(0, state.goalHold - dt * 2);
    if (state.wasInside && !inside && state.goalHold < PHYSICS.goalHoldSeconds) state.overruns += 1;
    state.wasInside = inside;

    const progress = clamp(state.goalHold / PHYSICS.goalHoldSeconds, 0, 1);
    this.goalProgress.clear();
    if (progress > 0) {
      this.goalProgress.lineStyle(5, 0x93fca0, 1).beginPath().arc(GOAL.x, GOAL.y, GOAL.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress).strokePath();
    }
    this.goalText.setText(inside && speed > PHYSICS.goalMaxSpeed ? "FAST" : `${Math.round(progress * 100)}%`)
      .setColor(inside && speed > PHYSICS.goalMaxSpeed ? "#ffb35d" : "#d9ffdd");
    if (progress >= 1) this.finish(true, `고속 통과 ${state.overruns}회`);
  },

  release(direction) { releaseDirection(this.state.ball, direction); },
  body() { return this.state?.ball; },
  wallHits() { return this.state.ball.collisions; },
};
