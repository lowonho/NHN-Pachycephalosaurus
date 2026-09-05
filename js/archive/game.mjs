import { STAGES } from "./data.mjs";
import { createProgressStore } from "./progress.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "./fragments.mjs";
import { GRAVITY_COURSE, createGravityState, applyGravityJump, stepGravity } from "./gravity-core.mjs";
import { BOUNCE_COURSE, createBounceState, stepBounce } from "./bounce-core.mjs";
import { STACK_RULES, stackBlockWidth, createStackState, dropStack, stepStack, nextStackBlock } from "./stack-core.mjs";
import { audio } from "./audio.mjs";
import { BALL_RADIUS, GOAL, PHYSICS, START, VIEWPORT, WALLS, ROUTE, FRAGMENT_ROUTE } from "./level-data.mjs";
import { createBallState, multiplierForPresses, registerDirection, releaseDirection, riskLabel, stepBall } from "./physics-core.mjs";

const WIDTH = VIEWPORT.width;
const HEIGHT = VIEWPORT.height;
const lightOverlay = document.querySelector("#light-overlay");
const corruptionOverlay = document.querySelector("#corruption");

window.archiveAudio = audio;
let progressStorage = null;
try { progressStorage = window.localStorage; } catch { /* Session-only fallback. */ }
window.archiveProgress = createProgressStore(STAGES.map((stage) => stage.id), progressStorage);
window.addEventListener("archive-sfx", (event) => audio.play(event.detail?.name));

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const moveTowardZero = (value, amount) => Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function circleRectCollision(body, rect, restitution = 0) {
  const radius = body.radius;
  const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - nearestX;
  let dy = body.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= radius * radius) return false;

  let nx;
  let ny;
  let penetration;
  if (distanceSquared > 0.0001) {
    const length = Math.sqrt(distanceSquared);
    nx = dx / length;
    ny = dy / length;
    penetration = radius - length;
  } else {
    const sides = [
      { d: Math.abs(body.x - rect.x), nx: -1, ny: 0 },
      { d: Math.abs(rect.x + rect.w - body.x), nx: 1, ny: 0 },
      { d: Math.abs(body.y - rect.y), nx: 0, ny: -1 },
      { d: Math.abs(rect.y + rect.h - body.y), nx: 0, ny: 1 },
    ].sort((a, b) => a.d - b.d);
    ({ nx, ny } = sides[0]);
    penetration = radius + sides[0].d;
  }

  body.x += nx * penetration;
  body.y += ny * penetration;
  const dot = body.vx * nx + body.vy * ny;
  if (dot < 0) {
    body.vx -= (1 + restitution) * dot * nx;
    body.vy -= (1 + restitution) * dot * ny;
  }
  return true;
}

function boundaryWalls(inset = 30, thickness = 14) {
  return [
    { x: inset, y: inset, w: WIDTH - inset * 2, h: thickness },
    { x: inset, y: HEIGHT - inset - thickness, w: WIDTH - inset * 2, h: thickness },
    { x: inset, y: inset, w: thickness, h: HEIGHT - inset * 2 },
    { x: WIDTH - inset - thickness, y: inset, w: thickness, h: HEIGHT - inset * 2 },
  ];
}

class ArchiveGame extends Phaser.Scene {
  constructor() {
    super("archive-game");
    this.stageId = null;
    this.mode = "idle";
    this.remaining = PHYSICS.timeLimit;
    this.settings = window.archiveSettings || { shake: true, effects: true };
    this.pausedByMenu = false;
  }

  create() {
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [this.input.keyboard.addKey(codes.W), this.input.keyboard.addKey(codes.UP)],
      down: [this.input.keyboard.addKey(codes.S), this.input.keyboard.addKey(codes.DOWN)],
      left: [this.input.keyboard.addKey(codes.A), this.input.keyboard.addKey(codes.LEFT)],
      right: [this.input.keyboard.addKey(codes.D), this.input.keyboard.addKey(codes.RIGHT)],
      action: this.input.keyboard.addKey(codes.SPACE),
    };
    this.input.keyboard.addCapture([codes.W, codes.A, codes.S, codes.D, codes.UP, codes.DOWN, codes.LEFT, codes.RIGHT, codes.SPACE]);
    this.input.on("pointerdown", (pointer) => {
      if (this.mode === "playing" && !this.pausedByMenu) this.pointerAction(pointer.worldX, pointer.worldY);
    });

    window.archiveGame = {
      loadStage: (id) => this.loadStage(id),
      start: () => this.startStage(),
      press: (direction) => this.directionPress(direction),
      release: (direction) => this.directionRelease(direction),
      action: () => this.primaryAction(),
      pause: (value) => { this.pausedByMenu = Boolean(value); },
      stop: () => this.stopGame(),
      applySettings: (value) => { this.settings = value; },
    };
    emit("archive-game-ready", { scene: this, stages: STAGES });
  }

  loadStage(id) {
    this.stageId = id;
    this.mode = "ready";
    this.remaining = PHYSICS.timeLimit;
    this.elapsed = 0;
    this.timePenalty = 0;
    this.pausedByMenu = false;
    this.children.removeAll(true);
    this.tweens.killAll();
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor("#07141d");
    corruptionOverlay.style.opacity = "0";
    lightOverlay.classList.remove("is-active");
    this.drawBackdrop();
    const builders = {
      maze: () => this.buildMaze(),
      gravity: () => this.buildGravity(),
      bounce: () => this.buildBounce(),
      friction: () => this.buildFriction(),
      stack: () => this.buildStack(),
    };
    builders[id]?.();
    this.buildFragment();
    this.sendHud();
  }

  startStage() {
    if (!this.stageId) return;
    this.loadStage(this.stageId);
    this.mode = "playing";
    this.remaining = PHYSICS.timeLimit;
    emit("archive-sfx", { name: "click" });
  }

  stopGame() {
    this.mode = "idle";
    this.pausedByMenu = false;
    this.setCorruption(0);
    lightOverlay.classList.remove("is-active");
  }

  drawBackdrop() {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x153746, 0.34);
    for (let x = 32; x < WIDTH; x += 32) grid.lineBetween(x, 0, x, HEIGHT);
    for (let y = 28; y < HEIGHT; y += 32) grid.lineBetween(0, y, WIDTH, y);
    this.add.text(24, 18, "ARCHIVE SIMULATION SPACE", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#315a6c",
    }).setDepth(1);
  }

  drawWalls(walls, color = 0x205568, stroke = 0x55b7ce) {
    const graphics = this.add.graphics();
    for (const wall of walls) {
      graphics.fillStyle(color, 1).fillRect(wall.x, wall.y, wall.w, wall.h);
      graphics.lineStyle(1, stroke, 0.55).strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
    }
    return graphics;
  }

  drawGoal(x, y, radius = 25, label = "RESTORE") {
    const ring = this.add.circle(x, y, radius, 0x93fca0, 0.1).setStrokeStyle(3, 0x93fca0, 0.92).setDepth(3);
    this.add.circle(x, y, 5, 0xc8ffd0, 0.92).setDepth(3);
    this.add.text(x, y + radius + 10, label, { fontFamily: "monospace", fontSize: "10px", color: "#93fca0" }).setOrigin(0.5).setDepth(3);
    this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.35, yoyo: true, repeat: -1, duration: 760 });
    return ring;
  }

  shake(duration, intensity) {
    if (this.settings.shake) this.cameras.main.shake(duration, intensity);
  }

  flash(duration, r, g, b) {
    if (this.settings.effects) this.cameras.main.flash(duration, r, g, b, false);
  }

  setCorruption(risk) {
    corruptionOverlay.style.opacity = this.settings.effects ? String(clamp(risk / 230, 0, 0.48)) : "0";
  }

  sendHud() {
    emit("archive-hud", {
      remaining: this.remaining,
      actions: this.actions ?? 0,
      anomaly: this.anomaly ?? "대기",
      risk: this.risk ?? 0,
      fragmentCollected: this.fragmentCollected,
      fragmentHint: this.fragment?.hint,
      wallHits: this.stageId === "maze" ? this.state.ball.collisions : null,
      timePenalty: this.timePenalty,
    });
  }

  readKeyboard() {
    const groups = [["up", this.keys.up], ["down", this.keys.down], ["left", this.keys.left], ["right", this.keys.right]];
    for (const [direction, keys] of groups) {
      for (const key of keys) {
        if (Phaser.Input.Keyboard.JustDown(key)) this.directionPress(direction);
        if (Phaser.Input.Keyboard.JustUp(key)) this.directionRelease(direction);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) this.primaryAction();
  }

  update(_time, deltaMs) {
    this.readKeyboard();
    if (this.mode !== "playing" || this.pausedByMenu) return;
    const dt = Math.min(deltaMs / 1000, 0.025);
    this.elapsed += Math.min(this.remaining, deltaMs / 1000);
    this.remaining = Math.max(0, this.remaining - deltaMs / 1000);
    if (this.remaining <= 0) { this.finish(false); this.sendHud(); return; }
    const previous = this.fragmentBody();
    const updates = {
      maze: () => this.updateMaze(dt),
      gravity: () => this.updateGravity(dt),
      bounce: () => this.updateBounce(dt),
      friction: () => this.updateFriction(dt),
      stack: () => this.updateStack(dt),
    };
    updates[this.stageId]?.();
    if (this.mode === "playing" && this.stageId !== "stack") this.checkFragment(this.fragmentBody(), previous);
    this.sendHud();
    if (this.remaining <= 0 && this.mode === "playing") this.finish(false);
  }

  directionPress(direction) {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    const handlers = {
      maze: () => this.mazePress(direction),
      gravity: () => this.gravityPress(direction),
      bounce: () => { if (direction === "left" || direction === "right") this.state.direction = direction; },
      friction: () => this.frictionPress(direction),
      stack: () => { this.state.direction = direction; },
    };
    handlers[this.stageId]?.();
  }

  directionRelease(direction) {
    if (this.mode !== "playing") return;
    const handlers = {
      maze: () => releaseDirection(this.state.ball, direction),
      bounce: () => { if (this.state.direction === direction) this.state.direction = null; },
      gravity: () => { if (this.state.direction === direction) this.state.direction = null; },
      friction: () => { if (this.state.direction === direction) this.state.direction = null; },
      stack: () => { if (this.state.direction === direction) this.state.direction = null; },
    };
    handlers[this.stageId]?.();
  }

  primaryAction() {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    if (this.stageId === "gravity") this.gravityJump();
    if (this.stageId === "stack" && dropStack(this.state)) this.actions++;
  }

  pointerAction(x, y) {

    if (this.stageId === "stack" && !this.state.dropping && this.state.blocks.length < STACK_RULES.count) {
      this.primaryAction();
    }
  }

  finish(success, extra = "") {
    if (this.mode !== "playing") return;
    if (success) this.checkFragment(this.fragmentBody());
    this.mode = "done";
    this.setCorruption(0);
    lightOverlay.classList.remove("is-active");
    if (success) this.flash(220, 147, 252, 160);
    emit("archive-stage-end", {
      success,
      elapsed: this.elapsed,
      timePenalty: this.timePenalty,
      actions: this.actions ?? 0,
      extra,
      fragmentCollected: this.fragmentCollected,
    });
  }

  buildFragment() {
    this.fragmentTip = null;
    this.fragment = MEMORY_FRAGMENTS[this.stageId];
    this.fragmentCollected = false;
    this.fragmentObject = this.add.rectangle(this.fragment.x, this.fragment.y, 19, 19, 0xffd27c, 0.85)
      .setStrokeStyle(2, 0xfff0c2).setRotation(Math.PI / 4).setDepth(7);
    this.fragmentRing = this.add.circle(this.fragment.x, this.fragment.y, this.fragment.radius + 7, 0xffd27c, 0.08)
      .setStrokeStyle(1, 0xffd27c, 0.6).setDepth(6);
    this.tweens.add({ targets: this.fragmentRing, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 });
    this.sendHud();
  }

  fragmentBody() {
    const s = this.state;
    if (!s) return null;

    const body = this.stageId === "maze" ? s.ball : s;
    return { x: body.x, y: body.y, radius: body.radius ?? 12 };
  }

  checkFragment(body, previous = body) {
    if (this.mode !== "playing" || this.pausedByMenu || this.fragmentCollected || !body) return;
    if (!touchesFragment(this.fragment, body, previous || body)) return;
    this.fragmentCollected = true;
    this.fragmentObject.setVisible(false);
    this.fragmentRing.setVisible(false);
    emit("archive-sfx", { name: "hit" });
    this.sendHud();
  }

  /* 01 — Velocity maze */
  buildMaze() {
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
  }

  mazePress(direction) {
    registerDirection(this.state.ball, direction);
    this.actions = this.state.ball.presses;
    this.risk = clamp((this.state.ball.multiplier - 1) / (PHYSICS.maxMultiplier - 1) * 100, 0, 100);
    this.anomaly = riskLabel(this.actions);
    this.setCorruption(this.risk);
    if (this.actions >= 7) this.shake(45, 0.0015 * Math.min(4, this.actions - 5));
    emit("archive-sfx", { name: "action" });
  }

  updateMaze(dt) {
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
  }

  /* 02 — Gravity tower */
  buildGravity() {
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
  }

  gravityPress(direction) {
    if (direction === "left" || direction === "right") this.state.direction = direction;
  }

  gravityJump() {
    const state = this.state;
    this.actions += 1;
    applyGravityJump(state, this.actions);
    this.risk = clamp((state.gravity - GRAVITY_COURSE.baseGravity) / (GRAVITY_COURSE.maxGravity - GRAVITY_COURSE.baseGravity) * 100, 0, 100);
    this.anomaly = `중력 ${(state.gravity / GRAVITY_COURSE.baseGravity).toFixed(2)}×`;
    this.setCorruption(this.risk * 0.7);
    emit("archive-sfx", { name: "action" });
  }

  updateGravity(dt) {
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
  }

  /* 03 — Growing bounce */
  buildBounce() {
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
  }

  updateBounce(dt) {
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
  }

  /* 05 — Friction drop */
  buildFriction() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "마찰 100%";
    const walls = [
      ...boundaryWalls(28, 14),
      { x: 278, y: 150, w: 30, h: 360 },
      { x: 520, y: 30, w: 30, h: 352 },
      { x: 728, y: 150, w: 30, h: 360 },
    ];
    this.drawWalls(walls, 0x3b5262, 0x7698aa);
    this.drawGoal(850, 92, 22, "DOCK");
    this.state = {
      x: 92, y: 452, vx: 0, vy: 0, radius: 15,
      direction: null, walls, goalHold: 0, wasInside: false, overruns: 0,
    };
    this.player = this.add.rectangle(92, 452, 30, 30, 0xffca75).setStrokeStyle(3, 0xffe1ad).setDepth(5);
    this.cargoTrail = this.add.graphics().setDepth(3);
    this.goalText = this.add.text(850, 92, "0%", { fontFamily: "monospace", fontSize: "10px", color: "#d9ffdd" }).setOrigin(0.5).setDepth(6);
  }

  frictionPress(direction) {
    this.state.direction = direction;
    this.actions += 1;
    const friction = Math.max(8, 100 - this.actions * 11);
    this.risk = clamp(100 - friction, 0, 100);
    this.anomaly = `마찰 ${friction}%`;
    this.setCorruption(this.risk * 0.75);
    emit("archive-sfx", { name: "action" });
  }

  updateFriction(dt) {
    const s = this.state;
    const vectors = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    const [dx, dy] = vectors[s.direction] || [0, 0];
    const acceleration = 470;
    const drag = Math.max(28, 640 - this.actions * 105);
    if (dx) s.vx += dx * acceleration * dt; else s.vx = moveTowardZero(s.vx, drag * dt);
    if (dy) s.vy += dy * acceleration * dt; else s.vy = moveTowardZero(s.vy, drag * dt);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 265) { s.vx = s.vx / speed * 265; s.vy = s.vy / speed * 265; }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    for (const wall of s.walls) circleRectCollision(s, wall, 0.35);
    this.player.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx) * 0.18);
    this.cargoTrail.clear().lineStyle(3, 0xffb35d, 0.14 + this.risk / 500).lineBetween(s.x - s.vx * 0.12, s.y - s.vy * 0.12, s.x, s.y);

    const currentSpeed = Math.hypot(s.vx, s.vy);
    const inside = Math.hypot(s.x - 850, s.y - 92) <= 22;
    if (inside && currentSpeed <= 28) s.goalHold += dt;
    else if (!inside) s.goalHold = 0;
    else s.goalHold = Math.max(0, s.goalHold - dt * 2);
    if (s.wasInside && !inside && s.goalHold < 0.8) s.overruns += 1;
    s.wasInside = inside;
    const progress = clamp(s.goalHold / 0.8, 0, 1);
    this.goalText.setText(inside && currentSpeed > 28 ? "FAST" : `${Math.round(progress * 100)}%`)
      .setColor(inside && currentSpeed > 28 ? "#ffb35d" : "#d9ffdd");
    if (progress >= 1) this.finish(true, `지나침 ${s.overruns}회`);
  }

  buildStack() {
    this.actions = 0; this.risk = 0; this.anomaly = "다음 무게 1.00×";
    this.state = createStackState();
    this.drawWalls([{ x: 480 - STACK_RULES.baseWidth / 2, y: 480, w: STACK_RULES.baseWidth, h: 22 }], 0x315169, 0x789bb7);
    this.stackArt = this.add.graphics().setDepth(4);
    this.player = this.add.rectangle(480, 80, STACK_RULES.width, 38, 0xffca75).setStrokeStyle(2, 0xffe1ad).setDepth(5);
    this.stackText = this.add.text(650, 460, "STACK 0 / 6", { fontFamily: "monospace", fontSize: "16px", color: "#93fca0" });
  }

  updateStack(dt) {
    const s = this.state, previous = { x: s.x, y: s.y, radius: s.radius };
    const result = stepStack(s, dt);
    this.checkFragment(this.fragmentBody(), previous);
    this.risk = clamp((30 - s.margin) / 30 * 100, 0, 100);
    this.anomaly = `다음 무게 ${(1 + Math.min(s.blocks.length, 5) * STACK_RULES.massStep).toFixed(2)}×`;
    this.stackArt.clear();
    for (const block of s.blocks) {
      this.stackArt.fillStyle(0x487e94).fillRect(block.x - block.w / 2, block.y - 19, block.w, 38);
      this.stackArt.lineStyle(2, 0x9cdcef).strokeRect(block.x - block.w / 2, block.y - 19, block.w, 38);
    }
    if (s.blocks.length) {
      const mass = s.blocks.reduce((n, b) => n + b.mass, 0);
      const center = s.blocks.reduce((n, b) => n + b.x * b.mass, 0) / mass;
      this.stackArt.lineStyle(2, s.margin < 12 ? 0xff7979 : 0x93fca0, 0.8).lineBetween(center, 240, center, 500);
    }
    this.stackText.setText(`STACK ${s.blocks.length} / 6`);
    if (result.landed && !result.failed && s.blocks.length < STACK_RULES.count) nextStackBlock(s);
    this.player.setPosition(s.x, s.y).setDisplaySize(stackBlockWidth(Math.min(s.blocks.length, 5)), 38).setVisible(s.blocks.length < STACK_RULES.count && !result.failed);
    if (result.failed) this.finish(false, "무게중심 이탈 · 기록 붕괴");
    else if (result.cleared) this.finish(true);
  }

}

window.archivePhaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: "game-container",
  backgroundColor: "#07141d",
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: ArchiveGame,
});
