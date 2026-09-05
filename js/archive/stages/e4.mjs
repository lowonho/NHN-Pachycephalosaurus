import { STOP_RULES, advanceFrictionStop, settleFrictionStop } from "../friction-stop.mjs";
import { WIDTH, HEIGHT, clamp, emit } from "./shared.mjs";

const moveTowardZero = (value, amount) => Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount;

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

// Stage 4: friction. Hooks run with the shared Phaser scene as this.
export const e4 = {
  id: "friction",
  build() {
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
    this.drawGoal(850, 92, 18, "DOCK");
    this.state = {
      x: 92, y: 452, vx: 0, vy: 0, radius: 15,
      direction: null, walls, goalHold: 0, wasInside: false, overruns: 0,
      wallHits: 0, contacts: new Set(), hitCooldown: 0,
      stops: [{ x: 440, y: 108 }, { x: 640, y: 428 }], stopIndex: 0, stopHold: 0, stopGrace: 0,
    };
    this.player = this.add.rectangle(92, 452, 30, 30, 0xffca75).setStrokeStyle(3, 0xffe1ad).setDepth(5);
    this.cargoTrail = this.add.graphics().setDepth(3);
    this.goalText = this.add.text(850, 92, "0%", { fontFamily: "monospace", fontSize: "10px", color: "#d9ffdd" }).setOrigin(0.5).setDepth(6);
    this.stopRings = this.state.stops.map((stop, index) => {
      const ring = this.add.circle(stop.x, stop.y, STOP_RULES.radius, 0xffca75, 0.08).setStrokeStyle(2, 0xffca75).setDepth(3);
      this.add.circle(stop.x, stop.y, 3, 0xffca75).setDepth(6);
      const label = this.add.text(stop.x, stop.y + 28, `STOP ${index + 1}`, { fontFamily: "monospace", fontSize: "11px", color: "#ffca75" }).setOrigin(0.5).setDepth(3);
      return { ring, label };
    });
  },

  press(direction) {
    this.state.direction = direction;
    this.actions += 1;
    const friction = Math.max(8, 100 - this.actions * 11);
    this.risk = clamp(100 - friction, 0, 100);
    this.anomaly = `마찰 ${friction}%`;
    this.setCorruption(this.risk * 0.75);
    emit("archive-sfx", { name: "action" });
  },

  update(dt) {
    const s = this.state;
    const vectors = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    const [dx, dy] = vectors[s.direction] || [0, 0];
    const acceleration = 470;
    const drag = Math.max(14, 560 - this.actions * 110);
    if (dx) s.vx += dx * acceleration * dt; else s.vx = moveTowardZero(s.vx, drag * dt);
    if (dy) s.vy += dy * acceleration * dt; else s.vy = moveTowardZero(s.vy, drag * dt);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 265) { s.vx = s.vx / speed * 265; s.vy = s.vy / speed * 265; }
    settleFrictionStop(s, s.stops[s.stopIndex], dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.hitCooldown = Math.max(0, s.hitCooldown - dt);
    const contacts = new Set();
    let impact = false;
    s.walls.forEach((wall, index) => {
      const dx = s.x - clamp(s.x, wall.x, wall.x + wall.w);
      const dy = s.y - clamp(s.y, wall.y, wall.y + wall.h);
      const distance = Math.hypot(dx, dy);
      const approach = distance > 0 ? -(s.vx * dx + s.vy * dy) / distance : Math.hypot(s.vx, s.vy);
      if (distance <= s.radius + 5) contacts.add(index);
      if (circleRectCollision(s, wall, 0.35) && !s.contacts.has(index) && approach > 20 && s.hitCooldown <= 0) impact = true;
    });
    s.contacts = contacts;
    if (impact) {
      s.wallHits++; s.hitCooldown = 0.35;
      this.timePenalty += 1;
      this.remaining = Math.max(0, this.remaining - 1);
      const popup = this.add.text(clamp(s.x, 85, 875), clamp(s.y - 30, 155, 480), "−1.00s", { fontFamily: "monospace", fontSize: "25px", color: "#ff947d", stroke: "#07141d", strokeThickness: 5 }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: popup, y: popup.y - 22, alpha: 0, duration: 650, onComplete: () => popup.destroy() });
      emit("archive-wall-hit", { seconds: 1 });
      emit("archive-sfx", { name: "warning" });
      if (this.remaining <= 0) { this.finish(false, "벽 충돌로 재생 시간 소진"); return; }
    }
    this.player.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx) * 0.18);
    this.cargoTrail.clear().lineStyle(3, 0xffb35d, 0.14 + this.risk / 500).lineBetween(s.x - s.vx * 0.12, s.y - s.vy * 0.12, s.x, s.y);

    const currentSpeed = Math.hypot(s.vx, s.vy);
    const stop = s.stops[s.stopIndex];
    let stopLabel = "0%";
    if (stop) {
      const result = advanceFrictionStop(s, Math.hypot(s.x - stop.x, s.y - stop.y), currentSpeed, dt);
      stopLabel = result.label;
      if (result.complete) { s.stopIndex++; s.stopHold = 0; s.stopGrace = 0; stopLabel = "0%"; emit("archive-sfx", { name: "hit" }); }
    }
    this.stopRings.forEach(({ ring, label }, index) => {
      const done = index < s.stopIndex;
      ring.setStrokeStyle(2, done ? 0x93fca0 : index === s.stopIndex ? 0xffca75 : 0x557788);
      label.setText(done ? "LOCKED" : `STOP ${index + 1}${index === s.stopIndex ? ` ${stopLabel}` : " · WAIT"}`);
    });
    this.anomaly = `마찰 ${Math.max(3, Math.round(drag / 560 * 100))}% · 정차 ${s.stopIndex}/2`;
    const ready = s.stopIndex === s.stops.length;
    const inside = Math.hypot(s.x - 850, s.y - 92) <= 18;
    if (ready && inside && currentSpeed <= 18) s.goalHold += dt;
    else if (!inside) s.goalHold = 0;
    else s.goalHold = Math.max(0, s.goalHold - dt * 2);
    if (s.wasInside && !inside && s.goalHold < 1) s.overruns += 1;
    s.wasInside = inside;
    const progress = clamp(s.goalHold, 0, 1);
    this.goalText.setText(!ready ? "LOCK" : inside && currentSpeed > 18 ? "FAST" : `${Math.round(progress * 100)}%`)
      .setColor(!ready || (inside && currentSpeed > 18) ? "#ffb35d" : "#d9ffdd");
    if (progress >= 1) this.finish(true, `지나침 ${s.overruns}회`);
  },

  release(direction) { if (this.state.direction === direction) this.state.direction = null; },
  wallHits() { return this.state.wallHits; },
};
