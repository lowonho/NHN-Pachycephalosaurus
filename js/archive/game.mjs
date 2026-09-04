import { STAGES } from "./data.mjs";
import { createProgressStore } from "./progress.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "./fragments.mjs";
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
      recoil: () => this.buildRecoil(),
      friction: () => this.buildFriction(),
      darkness: () => this.buildDarkness(),
      rotation: () => this.buildRotation(),
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
      recoil: () => this.updateRecoil(dt),
      friction: () => this.updateFriction(dt),
      darkness: () => this.updateDarkness(dt),
      rotation: () => this.updateRotation(dt),
    };
    updates[this.stageId]?.();
    if (this.mode === "playing") this.checkFragment(this.fragmentBody(), previous);
    this.sendHud();
    if (this.remaining <= 0 && this.mode === "playing") this.finish(false);
  }

  directionPress(direction) {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    const handlers = {
      maze: () => this.mazePress(direction),
      gravity: () => this.gravityPress(direction),
      friction: () => this.frictionPress(direction),
      darkness: () => this.darknessPress(direction),
      rotation: () => this.rotationPress(direction),
    };
    handlers[this.stageId]?.();
  }

  directionRelease(direction) {
    if (this.mode !== "playing") return;
    const handlers = {
      maze: () => releaseDirection(this.state.ball, direction),
      gravity: () => { if (this.state.direction === direction) this.state.direction = null; },
      friction: () => { if (this.state.direction === direction) this.state.direction = null; },
      darkness: () => { if (this.state.direction === direction) this.state.direction = null; },
      rotation: () => { if (this.state.direction === direction) this.state.direction = null; },
    };
    handlers[this.stageId]?.();
  }

  primaryAction() {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    if (this.stageId === "gravity") this.gravityJump();
  }

  pointerAction(x, y) {
    if (this.stageId === "bounce") this.launchBounceBall(x, y);
    if (this.stageId === "recoil") this.fireRecoilShot(x, y);
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
    if (this.stageId === "rotation") this.fragmentTip = this.add.circle(0, 0, 7, 0xffe5ab).setDepth(6);
    this.sendHud();
  }

  fragmentBody() {
    const s = this.state;
    if (!s || this.stageId === "recoil") return null;
    if (this.stageId === "rotation") {
      const body = { x: s.center.x + Math.cos(s.angle) * 165, y: s.center.y + Math.sin(s.angle) * 165, radius: 7 };
      this.fragmentTip?.setPosition(body.x, body.y);
      return body;
    }
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
    const platforms = [
      { x: 30, y: 500, w: 900, h: 20 },
      { x: 120, y: 415, w: 170, h: 16 },
      { x: 335, y: 330, w: 170, h: 16 },
      { x: 545, y: 245, w: 170, h: 16 },
      { x: 755, y: 160, w: 155, h: 16, goal: true },
    ];
    this.drawWalls(platforms, 0x3f4f65, 0x8399b4);
    this.add.text(850, 112, "GRAVITY BEACON", { fontFamily: "monospace", fontSize: "10px", color: "#93fca0" }).setOrigin(0.5);
    this.drawGoal(850, 128, 19, "TOP");
    this.gravityArrows = this.add.graphics().setDepth(2);
    this.state = {
      x: 75, y: 483, width: 26, height: 34, vx: 0, vy: 0,
      direction: null, onGround: true, support: platforms[0], gravity: 720, platforms,
    };
    this.player = this.add.rectangle(75, 483, 26, 34, 0xe9f6ff).setStrokeStyle(3, 0x7bc8ff).setDepth(5);
  }

  gravityPress(direction) {
    if (direction === "left" || direction === "right") this.state.direction = direction;
  }

  gravityJump() {
    const state = this.state;
    this.actions += 1;
    state.gravity = 720 + (this.actions - 1) * 112;
    if (state.onGround) {
      state.vy = -430;
      state.onGround = false;
      state.support = null;
    }
    this.risk = clamp((state.gravity - 720) / 780 * 100, 0, 100);
    this.anomaly = `중력 ${(state.gravity / 720).toFixed(1)}×`;
    this.setCorruption(this.risk * 0.7);
    emit("archive-sfx", { name: "action" });
  }

  updateGravity(dt) {
    const s = this.state;
    const previousBottom = s.y + s.height / 2;
    s.vx = s.direction === "left" ? -190 : s.direction === "right" ? 190 : 0;
    s.vy += s.gravity * dt;
    s.x = clamp(s.x + s.vx * dt, 48 + s.width / 2, 912 - s.width / 2);
    s.y += s.vy * dt;
    const newBottom = s.y + s.height / 2;

    if (s.onGround && s.support && (s.x + s.width / 2 < s.support.x || s.x - s.width / 2 > s.support.x + s.support.w)) {
      s.onGround = false;
      s.support = null;
    }
    if (s.vy >= 0) {
      for (const platform of s.platforms) {
        const horizontal = s.x + s.width / 2 > platform.x && s.x - s.width / 2 < platform.x + platform.w;
        if (horizontal && previousBottom <= platform.y + 3 && newBottom >= platform.y) {
          s.y = platform.y - s.height / 2;
          s.vy = 0;
          s.onGround = true;
          s.support = platform;
          this.shake(45, clamp(s.gravity / 500000, 0.0015, 0.004));
          if (platform.goal && s.x > 810) this.finish(true);
          break;
        }
      }
    }
    if (s.y > HEIGHT + 60) {
      s.x = 75;
      s.y = 483;
      s.vx = 0;
      s.vy = 0;
      s.onGround = true;
      s.support = s.platforms[0];
    }
    this.player.setPosition(s.x, s.y);
    if (s.support?.goal && s.x > 810) this.finish(true);
    this.gravityArrows.clear().lineStyle(2, 0xffb35d, 0.18 + this.risk / 170);
    for (let x = 72; x < 930; x += 74) {
      const length = 18 + this.risk * 0.28;
      this.gravityArrows.lineBetween(x, 52, x, 52 + length).lineBetween(x, 52 + length, x - 4, 62 + length).lineBetween(x, 52 + length, x + 4, 62 + length);
    }
  }

  /* 03 — Restitution loop */
  buildBounce() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "탄성 1.0×";
    const walls = [
      ...boundaryWalls(28, 14),
      { x: 424, y: 150, w: 34, h: 338 },
      { x: 650, y: 230, w: 24, h: 282 },
    ];
    this.drawWalls(walls, 0x315169, 0x789bb7);
    this.drawGoal(830, 128, 28, "CORE");
    this.add.text(470, 126, "직선 경로 차단", { fontFamily: "monospace", fontSize: "10px", color: "#6f91a0" });
    this.state = {
      x: 118, y: 444, vx: 0, vy: 0, radius: 12, launched: false,
      walls, target: { x: 830, y: 128, radius: 28 }, collisionCooldown: 0, launchAge: 0,
    };
    this.player = this.add.circle(118, 444, 12, 0xf0f8ff).setStrokeStyle(3, 0xb7d4ff).setDepth(5);
    this.aimLine = this.add.graphics().setDepth(3);
  }

  launchBounceBall(x, y) {
    const s = this.state;
    const speed = Math.hypot(s.vx, s.vy);
    if (s.launched && speed > 34 && s.launchAge < 0.9) return;
    if (s.launched) {
      s.x = 118;
      s.y = 444;
      s.vx = 0;
      s.vy = 0;
    }
    const dx = x - s.x;
    const dy = y - s.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    s.vx = dx / length * 470;
    s.vy = dy / length * 470;
    s.launched = true;
    s.launchAge = 0;
    emit("archive-sfx", { name: "action" });
  }

  updateBounce(dt) {
    const s = this.state;
    if (s.launched) s.launchAge += dt;
    if (!s.launched || Math.hypot(s.vx, s.vy) < 34) {
      const pointer = this.input.activePointer;
      this.aimLine.clear().lineStyle(2, 0x7bc8ff, 0.46).lineBetween(s.x, s.y, pointer.worldX, pointer.worldY);
    } else {
      this.aimLine.clear();
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.collisionCooldown = Math.max(0, s.collisionCooldown - dt);
    const restitution = clamp(0.88 + this.actions * 0.11, 0.88, 1.72);
    for (const wall of s.walls) {
      if (circleRectCollision(s, wall, restitution) && s.collisionCooldown <= 0) {
        this.actions += 1;
        s.collisionCooldown = 0.055;
        this.risk = clamp(this.actions / 7 * 100, 0, 100);
        this.anomaly = `탄성 ${Math.min(2.7, 1 + this.actions * 0.24).toFixed(1)}×`;
        this.setCorruption(this.risk);
        this.shake(55, clamp(0.0018 + this.actions * 0.00045, 0.0018, 0.006));
        emit("archive-sfx", { name: "warning" });
      }
    }
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 820) {
      s.vx = s.vx / speed * 820;
      s.vy = s.vy / speed * 820;
    }
    this.player.setPosition(s.x, s.y).setScale(1 + Math.min(0.65, this.actions * 0.07));
    if (Math.hypot(s.x - s.target.x, s.y - s.target.y) <= s.radius + s.target.radius) this.finish(true);
  }

  /* 04 — Recoil array */
  buildRecoil() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "반동 정상";
    this.state = {
      turretX: 480,
      turretY: 468,
      bullets: [],
      hits: 0,
      time: 0,
      targets: [
        { x: 205, y: 150, baseX: 205, phase: 0, hit: false },
        { x: 480, y: 112, baseX: 480, phase: 2.1, hit: false },
        { x: 755, y: 165, baseX: 755, phase: 4.2, hit: false },
      ],
    };
    this.targetObjects = this.state.targets.map((target, index) => {
      const ring = this.add.circle(target.x, target.y, 27, 0xffb35d, 0.09).setStrokeStyle(3, 0xffb35d).setDepth(3);
      const text = this.add.text(target.x, target.y, String(index + 1), { fontFamily: "monospace", fontSize: "12px", color: "#ffd19d" }).setOrigin(0.5).setDepth(4);
      return { ring, text };
    });
    this.turret = this.add.rectangle(480, 468, 68, 28, 0x46788c).setStrokeStyle(2, 0x79cbe4).setDepth(4);
    this.barrel = this.add.rectangle(480, 440, 70, 9, 0xb8dfec).setOrigin(0.1, 0.5).setDepth(3);
    this.crosshair = this.add.circle(480, 220, 13, 0x000000, 0).setStrokeStyle(2, 0x93fca0, 0.8).setDepth(5);
    this.hitText = this.add.text(48, 60, "NODES 0 / 3", { fontFamily: "monospace", fontSize: "16px", color: "#93fca0" });
  }

  fireRecoilShot(x, y) {
    const s = this.state;
    this.actions += 1;
    const baseAngle = Math.atan2(y - s.turretY, x - s.turretX);
    const drift = this.actions === 1 ? 0 : (this.actions - 1) * 0.012 * (this.actions % 2 ? -1 : 1);
    const angle = baseAngle + drift;
    const speed = 720;
    const bullet = { x: s.turretX, y: s.turretY - 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    bullet.object = this.add.circle(bullet.x, bullet.y, 5, 0xe9fbff).setDepth(5);
    s.bullets.push(bullet);
    const recoil = 12 + this.actions * 6;
    s.turretX = clamp(s.turretX - Math.cos(angle) * recoil, 105, 855);
    this.risk = clamp(this.actions / 7 * 100, 0, 100);
    this.anomaly = `반동 ${Math.min(3.4, 1 + this.actions * 0.34).toFixed(1)}×`;
    this.setCorruption(this.risk * 0.85);
    this.shake(70, clamp(0.002 + this.actions * 0.0005, 0.002, 0.007));
    emit("archive-sfx", { name: "action" });
  }

  updateRecoil(dt) {
    const s = this.state;
    s.time += dt;
    const pointer = this.input.activePointer;
    this.crosshair.setPosition(pointer.worldX, pointer.worldY);
    const barrelAngle = Math.atan2(pointer.worldY - s.turretY, pointer.worldX - s.turretX);
    this.turret.setPosition(s.turretX, s.turretY);
    this.barrel.setPosition(s.turretX, s.turretY - 4).setRotation(barrelAngle);

    s.targets.forEach((target, index) => {
      if (target.hit) return;
      target.x = target.baseX + Math.sin(s.time * 1.35 + target.phase) * 34;
      this.targetObjects[index].ring.setPosition(target.x, target.y);
      this.targetObjects[index].text.setPosition(target.x, target.y);
    });

    for (let index = s.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = s.bullets[index];
      const previous = { x: bullet.x, y: bullet.y };
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      this.checkFragment({ x: bullet.x, y: bullet.y, radius: 5 }, previous);
      bullet.object.setPosition(bullet.x, bullet.y);
      let removed = false;
      for (let targetIndex = 0; targetIndex < s.targets.length; targetIndex += 1) {
        const target = s.targets[targetIndex];
        if (!target.hit && Math.hypot(bullet.x - target.x, bullet.y - target.y) <= 33) {
          target.hit = true;
          s.hits += 1;
          this.targetObjects[targetIndex].ring.setFillStyle(0x93fca0, 0.22).setStrokeStyle(3, 0x93fca0);
          this.targetObjects[targetIndex].text.setText("✓").setColor("#93fca0");
          bullet.object.destroy();
          s.bullets.splice(index, 1);
          removed = true;
          this.hitText.setText(`NODES ${s.hits} / 3`);
          emit("archive-sfx", { name: "hit" });
          if (s.hits === 3) this.finish(true, `${this.actions}발 사용`);
          break;
        }
      }
      if (!removed && (bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < -20 || bullet.y > HEIGHT + 20)) {
        bullet.object.destroy();
        s.bullets.splice(index, 1);
      }
    }
  }

  /* 05 — Friction drop */
  buildFriction() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "마찰 100%";
    const walls = [
      ...boundaryWalls(28, 14),
      { x: 278, y: 252, w: 30, h: 258 },
      { x: 520, y: 30, w: 30, h: 282 },
      { x: 728, y: 252, w: 30, h: 258 },
    ];
    this.drawWalls(walls, 0x3b5262, 0x7698aa);
    this.drawGoal(864, 72, 32, "DOCK");
    this.state = {
      x: 92, y: 452, vx: 0, vy: 0, radius: 15,
      direction: null, walls, goalHold: 0, wasInside: false, overruns: 0,
    };
    this.player = this.add.rectangle(92, 452, 30, 30, 0xffca75).setStrokeStyle(3, 0xffe1ad).setDepth(5);
    this.cargoTrail = this.add.graphics().setDepth(3);
    this.goalText = this.add.text(864, 72, "0%", { fontFamily: "monospace", fontSize: "10px", color: "#d9ffdd" }).setOrigin(0.5).setDepth(6);
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
    const drag = Math.max(55, 720 - this.actions * 82);
    if (dx) s.vx += dx * acceleration * dt; else s.vx = moveTowardZero(s.vx, drag * dt);
    if (dy) s.vy += dy * acceleration * dt; else s.vy = moveTowardZero(s.vy, drag * dt);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 265) { s.vx = s.vx / speed * 265; s.vy = s.vy / speed * 265; }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    for (const wall of s.walls) circleRectCollision(s, wall, 0.02);
    this.player.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx) * 0.18);
    this.cargoTrail.clear().lineStyle(3, 0xffb35d, 0.14 + this.risk / 500).lineBetween(s.x - s.vx * 0.12, s.y - s.vy * 0.12, s.x, s.y);

    const currentSpeed = Math.hypot(s.vx, s.vy);
    const inside = Math.hypot(s.x - 864, s.y - 72) <= 32;
    if (inside && currentSpeed <= 78) s.goalHold += dt;
    else if (!inside) s.goalHold = 0;
    else s.goalHold = Math.max(0, s.goalHold - dt * 2);
    if (s.wasInside && !inside && s.goalHold < 0.4) s.overruns += 1;
    s.wasInside = inside;
    const progress = clamp(s.goalHold / 0.4, 0, 1);
    this.goalText.setText(inside && currentSpeed > 78 ? "FAST" : `${Math.round(progress * 100)}%`)
      .setColor(inside && currentSpeed > 78 ? "#ffb35d" : "#d9ffdd");
    if (progress >= 1) this.finish(true, `지나침 ${s.overruns}회`);
  }

  /* 06 — Light decay */
  buildDarkness() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "광량 100%";
    const walls = [
      ...boundaryWalls(28, 14),
      { x: 28, y: 392, w: 330, h: 18 },
      { x: 358, y: 208, w: 18, h: 202 },
      { x: 190, y: 208, w: 488, h: 18 },
      { x: 678, y: 208, w: 18, h: 222 },
      { x: 500, y: 430, w: 196, h: 18 },
      { x: 790, y: 100, w: 18, h: 108 },
      { x: 808, y: 100, w: 122, h: 18 },
    ];
    this.drawWalls(walls, 0x263f4b, 0x65808d);
    this.drawGoal(865, 72, 24, "EXIT");
    this.state = { x: 86, y: 458, vx: 0, vy: 0, radius: 12, direction: null, walls, lightRadius: 230 };
    this.player = this.add.circle(86, 458, 12, 0xf6fbff).setStrokeStyle(3, 0xffe29d).setDepth(5);
    lightOverlay.classList.add("is-active");
    this.updateLightOverlay();
  }

  darknessPress(direction) {
    this.state.direction = direction;
    this.actions += 1;
    this.state.lightRadius = Math.max(58, 230 - this.actions * 19);
    this.risk = clamp((230 - this.state.lightRadius) / 172 * 100, 0, 100);
    this.anomaly = `광량 ${Math.round(this.state.lightRadius / 230 * 100)}%`;
    emit("archive-sfx", { name: this.actions >= 7 ? "warning" : "action" });
  }

  updateLightOverlay() {
    const s = this.state;
    lightOverlay.style.setProperty("--light-x", `${s.x / WIDTH * 100}%`);
    lightOverlay.style.setProperty("--light-y", `${s.y / HEIGHT * 100}%`);
    lightOverlay.style.setProperty("--light-radius", `${s.lightRadius / WIDTH * 100}%`);
  }

  updateDarkness(dt) {
    const s = this.state;
    const vectors = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    const [dx, dy] = vectors[s.direction] || [0, 0];
    s.vx = dx * 185;
    s.vy = dy * 185;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    for (const wall of s.walls) circleRectCollision(s, wall, 0);
    this.player.setPosition(s.x, s.y);
    this.updateLightOverlay();
    if (Math.hypot(s.x - 865, s.y - 72) <= 34) this.finish(true);
  }

  /* 07 — Angular lock */
  buildRotation() {
    this.actions = 0;
    this.risk = 0;
    this.anomaly = "각속도 안정";
    const center = { x: 480, y: 272 };
    const targetAngle = 0.42;
    this.add.circle(center.x, center.y, 184, 0x0b2835, 0.32).setStrokeStyle(2, 0x315e70, 0.8);
    const ticks = this.add.graphics().lineStyle(2, 0x5e8797, 0.46);
    for (let i = 0; i < 24; i += 1) {
      const angle = i / 24 * Math.PI * 2;
      ticks.lineBetween(center.x + Math.cos(angle) * 171, center.y + Math.sin(angle) * 171, center.x + Math.cos(angle) * 183, center.y + Math.sin(angle) * 183);
    }
    this.add.line(center.x, center.y, 0, 0, Math.cos(targetAngle) * 340, Math.sin(targetAngle) * 340, 0x93fca0, 0.22).setLineWidth(12).setOrigin(0, 0.5);
    this.add.text(center.x + Math.cos(targetAngle) * 202, center.y + Math.sin(targetAngle) * 202, "LOCK ANGLE", { fontFamily: "monospace", fontSize: "10px", color: "#93fca0" }).setOrigin(0.5);
    this.rotationBar = this.add.rectangle(center.x, center.y, 330, 14, 0x9cdcef).setStrokeStyle(2, 0xe8fbff).setDepth(4);
    this.add.circle(center.x, center.y, 25, 0x173f50).setStrokeStyle(3, 0x65cce8).setDepth(5);
    this.rotationText = this.add.text(center.x, 486, "ALIGN 0%", { fontFamily: "monospace", fontSize: "15px", color: "#8daeba" }).setOrigin(0.5);
    this.state = { angle: -1.15, angularVelocity: 0, direction: null, targetAngle, hold: 0, center };
    this.rotationBar.setRotation(this.state.angle);
  }

  rotationPress(direction) {
    if (direction !== "left" && direction !== "right") return;
    this.state.direction = direction;
    this.actions += 1;
    this.risk = clamp(this.actions / 9 * 100, 0, 100);
    this.anomaly = `각속도 ${Math.min(3.8, 1 + this.actions * 0.31).toFixed(1)}×`;
    this.setCorruption(this.risk);
    emit("archive-sfx", { name: "action" });
  }

  updateRotation(dt) {
    const s = this.state;
    const direction = s.direction === "left" ? -1 : s.direction === "right" ? 1 : 0;
    const torque = 2.45 * (1 + this.actions * 0.16);
    const damping = Math.max(0.22, 1.32 - this.actions * 0.1);
    if (direction) s.angularVelocity += direction * torque * dt;
    else s.angularVelocity = moveTowardZero(s.angularVelocity, damping * dt);
    const maxVelocity = 1.55 + this.actions * 0.27;
    s.angularVelocity = clamp(s.angularVelocity, -maxVelocity, maxVelocity);
    s.angle += s.angularVelocity * dt;
    if (s.angle > Math.PI) s.angle -= Math.PI * 2;
    if (s.angle < -Math.PI) s.angle += Math.PI * 2;
    this.rotationBar.setRotation(s.angle);

    const angleError = Math.abs(Math.atan2(Math.sin(s.angle - s.targetAngle), Math.cos(s.angle - s.targetAngle)));
    const valid = angleError <= 0.09 && Math.abs(s.angularVelocity) <= 0.22;
    if (valid) s.hold += dt; else s.hold = Math.max(0, s.hold - dt * 1.5);
    const progress = clamp(s.hold / 0.65, 0, 1);
    this.rotationText.setText(valid ? `LOCK ${Math.round(progress * 100)}%` : `ERROR ${(angleError * 180 / Math.PI).toFixed(1)}°`)
      .setColor(valid ? "#93fca0" : "#8daeba");
    if (progress >= 1) this.finish(true, `각도 오차 ${(angleError * 180 / Math.PI).toFixed(1)}°`);
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
