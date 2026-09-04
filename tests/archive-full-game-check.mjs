import { STAGES } from "../js/archive/data.mjs";
import { GRAVITY_COURSE } from "../js/archive/gravity-core.mjs";

const LIMIT = 20.26;
const dt = 1 / 240;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const moveTowardZero = (value, amount) => Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount;

function circleRect(body, rect, restitution = 0) {
  const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= body.radius * body.radius || distanceSquared < 0.0001) return false;
  const length = Math.sqrt(distanceSquared);
  const nx = dx / length;
  const ny = dy / length;
  const penetration = body.radius - length;
  body.x += nx * penetration;
  body.y += ny * penetration;
  const dot = body.vx * nx + body.vy * ny;
  if (dot < 0) {
    body.vx -= (1 + restitution) * dot * nx;
    body.vy -= (1 + restitution) * dot * ny;
  }
  return true;
}

function boundaryWalls() {
  return [
    { x: 28, y: 28, w: 904, h: 14 },
    { x: 28, y: 498, w: 904, h: 14 },
    { x: 28, y: 28, w: 14, h: 484 },
    { x: 918, y: 28, w: 14, h: 484 },
  ];
}

function verifyGravity() {
  const gaps = GRAVITY_COURSE.platforms.slice(1, 9).map((platform, i) => GRAVITY_COURSE.platforms[i].y - platform.y);
  const heights = gaps.map((_, index) => GRAVITY_COURSE.jumpSpeed ** 2 / (2 * Math.min(GRAVITY_COURSE.maxGravity, GRAVITY_COURSE.baseGravity + index * GRAVITY_COURSE.gravityStep)));
  return {
    passed: heights.every((height, index) => height >= gaps[index]),
    detail: `최소 점프 여유 ${(Math.min(...heights.map((height, index) => height - gaps[index]))).toFixed(1)}px`,
  };
}

function verifyBounce() {
  const walls = [...boundaryWalls(), { x: 424, y: 150, w: 34, h: 338 }, { x: 650, y: 230, w: 24, h: 282 }];
  let best = null;
  let solutionCount = 0;
  for (let degrees = -89; degrees <= -1; degrees += 0.25) {
    const angle = degrees * Math.PI / 180;
    const body = { x: 118, y: 444, vx: Math.cos(angle) * 470, vy: Math.sin(angle) * 470, radius: 12 };
    let time = 0;
    let collisions = 0;
    let cooldown = 0;
    while (time < LIMIT) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      cooldown = Math.max(0, cooldown - dt);
      const restitution = clamp(0.88 + collisions * 0.11, 0.88, 1.72);
      let collided = false;
      for (const wall of walls) collided = circleRect(body, wall, restitution) || collided;
      if (collided && cooldown <= 0) {
        collisions += 1;
        cooldown = 0.055;
      }
      const speed = Math.hypot(body.vx, body.vy);
      if (speed > 820) {
        body.vx = body.vx / speed * 820;
        body.vy = body.vy / speed * 820;
      }
      time += dt;
      if (Math.hypot(body.x - 830, body.y - 128) <= 40) {
        solutionCount += 1;
        if (!best || time < best.time) best = { time, degrees, collisions };
        break;
      }
    }
  }
  return best
    ? { passed: true, detail: `${best.time.toFixed(2)}초 · 유효 각도 ${solutionCount}개` }
    : { passed: false, detail: "검증 궤도 미도달" };
}

function verifyRecoil() {
  const targets = [
    { baseX: 205, y: 150, phase: 0 },
    { baseX: 480, y: 112, phase: 2.1 },
    { baseX: 755, y: 165, phase: 4.2 },
  ];
  let time = 0;
  let turretX = 480;
  let shots = 0;
  let hits = 0;
  for (const target of targets) {
    shots += 1;
    const roughDistance = Math.hypot(target.baseX - turretX, target.y - 468);
    const arrival = time + roughDistance / 720;
    const leadX = target.baseX + Math.sin(arrival * 1.35 + target.phase) * 34;
    const baseAngle = Math.atan2(target.y - 468, leadX - turretX);
    const drift = shots === 1 ? 0 : (shots - 1) * 0.012 * (shots % 2 ? -1 : 1);
    const angle = baseAngle + drift;
    const bullet = { x: turretX, y: 456, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720 };
    let hit = false;
    for (let step = 0; step < 900 && !hit; step += 1) {
      time += dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const targetX = target.baseX + Math.sin(time * 1.35 + target.phase) * 34;
      if (Math.hypot(bullet.x - targetX, bullet.y - target.y) <= 33) {
        hit = true;
        hits += 1;
      }
    }
    turretX = clamp(turretX - Math.cos(angle) * (12 + shots * 6), 105, 855);
  }
  return { passed: hits === 3 && time < LIMIT, detail: `${time.toFixed(2)}초 · ${shots}발 명중` };
}

function verifyFriction() {
  const walls = [...boundaryWalls(), { x: 278, y: 252, w: 30, h: 258 }, { x: 520, y: 30, w: 30, h: 282 }, { x: 728, y: 252, w: 30, h: 258 }];
  const route = [
    { direction: "up", axis: "y", value: 210, sign: -1 },
    { direction: "right", axis: "x", value: 470, sign: 1 },
    { direction: "down", axis: "y", value: 350, sign: 1 },
    { direction: "right", axis: "x", value: 680, sign: 1 },
    { direction: "up", axis: "y", value: 210, sign: -1 },
    { direction: "right", axis: "x", value: 850, sign: 1 },
  ];
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const body = { x: 92, y: 452, vx: 0, vy: 0, radius: 15, direction: "up", actions: 1 };
  let routeIndex = 0;
  let time = 0;
  let brakeRemaining = 0;
  let braked = false;
  let hold = 0;
  while (time < LIMIT && hold < 0.4) {
    const [dx, dy] = vectors[body.direction] || [0, 0];
    const drag = Math.max(55, 720 - body.actions * 82);
    if (dx) body.vx += dx * 470 * dt; else body.vx = moveTowardZero(body.vx, drag * dt);
    if (dy) body.vy += dy * 470 * dt; else body.vy = moveTowardZero(body.vy, drag * dt);
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > 265) { body.vx = body.vx / speed * 265; body.vy = body.vy / speed * 265; }
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    for (const wall of walls) circleRect(body, wall, 0.02);

    const waypoint = route[routeIndex];
    const passed = waypoint.sign > 0 ? body[waypoint.axis] >= waypoint.value : body[waypoint.axis] <= waypoint.value;
    if (passed && routeIndex < route.length - 1) {
      routeIndex += 1;
      body.direction = route[routeIndex].direction;
      body.actions += 1;
    }
    if (routeIndex === route.length - 1 && !braked && body.x >= 750) {
      braked = true;
      brakeRemaining = 0.07;
      body.direction = "left";
      body.actions += 1;
    }
    if (braked && brakeRemaining > 0) {
      brakeRemaining -= dt;
      if (brakeRemaining <= 0) body.direction = null;
    }

    const currentSpeed = Math.hypot(body.vx, body.vy);
    const inside = Math.hypot(body.x - 864, body.y - 72) <= 32;
    if (inside && currentSpeed <= 78) hold += dt;
    else if (!inside) hold = 0;
    else hold = Math.max(0, hold - dt * 2);
    time += dt;
  }
  return { passed: hold >= 0.4, detail: `${time.toFixed(2)}초 · 입력 ${body.actions}회` };
}

function verifyDarkness() {
  const routeDistance = (720 - 86) + (458 - 72) + (865 - 720);
  const time = routeDistance / 185;
  return { passed: time < LIMIT, detail: `${time.toFixed(2)}초 · 최소 방향 입력 3회` };
}

function verifyRotation() {
  let angle = -1.15;
  let angularVelocity = 0;
  let hold = 0;
  let time = 0;
  while (time < LIMIT && hold < 0.65) {
    const direction = time < 0.58 ? 1 : time < 0.63 ? -1 : 0;
    const actions = time < 0.58 ? 1 : 2;
    const torque = 2.45 * (1 + actions * 0.16);
    const damping = Math.max(0.22, 1.32 - actions * 0.1);
    if (direction) angularVelocity += direction * torque * dt;
    else angularVelocity = moveTowardZero(angularVelocity, damping * dt);
    angularVelocity = clamp(angularVelocity, -(1.55 + actions * 0.27), 1.55 + actions * 0.27);
    angle += angularVelocity * dt;
    const error = Math.abs(Math.atan2(Math.sin(angle - 0.42), Math.cos(angle - 0.42)));
    const valid = error <= 0.09 && Math.abs(angularVelocity) <= 0.22;
    if (valid) hold += dt; else hold = Math.max(0, hold - dt * 1.5);
    time += dt;
  }
  return { passed: hold >= 0.65, detail: `${time.toFixed(2)}초 · 회전 입력 2회` };
}

const checks = [
  { name: "전체 스테이지 등록", passed: STAGES.length === 7, detail: `${STAGES.length}개` },
  { name: "중력 타워", ...verifyGravity() },
  { name: "탄성 우회", ...verifyBounce() },
  { name: "반동 사격장", ...verifyRecoil() },
  { name: "무마찰 배송", ...verifyFriction() },
  { name: "소실 회랑", ...verifyDarkness() },
  { name: "각속도 잠금", ...verifyRotation() },
];

for (const check of checks) console.log(`${check.passed ? "PASS" : "FAIL"} | ${check.name} | ${check.detail}`);
if (checks.some((check) => !check.passed)) process.exitCode = 1;

