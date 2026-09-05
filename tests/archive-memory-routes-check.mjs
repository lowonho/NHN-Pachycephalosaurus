import assert from "node:assert/strict";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";

const LIMIT = 20.26;
const dt = 1 / 240;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const towardZero = (value, amount) => Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount;

function circleRect(body, rect, restitution = 0) {
  const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - nearestX;
  let dy = body.y - nearestY;
  const squared = dx * dx + dy * dy;
  if (squared >= body.radius * body.radius) return false;
  let nx;
  let ny;
  let penetration;
  if (squared > 0.0001) {
    const length = Math.sqrt(squared);
    nx = dx / length; ny = dy / length; penetration = body.radius - length;
  } else {
    const sides = [
      { d: Math.abs(body.x - rect.x), nx: -1, ny: 0 },
      { d: Math.abs(rect.x + rect.w - body.x), nx: 1, ny: 0 },
      { d: Math.abs(body.y - rect.y), nx: 0, ny: -1 },
      { d: Math.abs(rect.y + rect.h - body.y), nx: 0, ny: 1 },
    ].sort((a, b) => a.d - b.d);
    ({ nx, ny } = sides[0]); penetration = body.radius + sides[0].d;
  }
  body.x += nx * penetration; body.y += ny * penetration;
  const dot = body.vx * nx + body.vy * ny;
  if (dot < 0) { body.vx -= (1 + restitution) * dot * nx; body.vy -= (1 + restitution) * dot * ny; }
  return true;
}

const boundary = () => [
  { x: 28, y: 28, w: 904, h: 14 }, { x: 28, y: 498, w: 904, h: 14 },
  { x: 28, y: 28, w: 14, h: 484 }, { x: 918, y: 28, w: 14, h: 484 },
];

function verifyFrictionMemory() {
  const walls = [...boundary(), { x: 278, y: 252, w: 30, h: 258 }, { x: 520, y: 30, w: 30, h: 282 }, { x: 728, y: 252, w: 30, h: 258 }];
  const route = [
    // 일찍 우회전을 시작해 남은 위쪽 관성으로 (440, 105)의 조각을 스친다.
    { direction: "up", axis: "y", value: 153, sign: -1 },
    { direction: "right", axis: "x", value: 440, sign: 1 },
    { direction: "down", axis: "y", value: 350, sign: 1 },
    { direction: "right", axis: "x", value: 680, sign: 1 },
    { direction: "up", axis: "y", value: 205, sign: -1 },
    { direction: "right", axis: "x", value: 805, sign: 1 },
    { direction: "up", axis: "y", value: 82, sign: -1 },
  ];
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const body = { x: 92, y: 452, vx: 0, vy: 0, radius: 15, direction: route[0].direction, actions: 1 };
  let routeIndex = 0;
  let time = 0;
  let collected = false;
  let nearestFragment = Infinity;
  let nearestPoint = null;
  let hold = 0;
  let finalApproach = false;
  while (time < LIMIT && hold < 0.4) {
    const previous = { x: body.x, y: body.y };
    const [dx, dy] = vectors[body.direction] || [0, 0];
    const drag = Math.max(55, 720 - body.actions * 82);
    if (dx) body.vx += dx * 470 * dt; else body.vx = towardZero(body.vx, drag * dt);
    if (dy) body.vy += dy * 470 * dt; else body.vy = towardZero(body.vy, drag * dt);
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > 265) { body.vx = body.vx / speed * 265; body.vy = body.vy / speed * 265; }
    body.x += body.vx * dt; body.y += body.vy * dt;
    walls.forEach((wall) => circleRect(body, wall, 0.02));
    collected ||= touchesFragment(MEMORY_FRAGMENTS.friction, body, previous);
    const fragmentDistance = Math.hypot(body.x - MEMORY_FRAGMENTS.friction.x, body.y - MEMORY_FRAGMENTS.friction.y);
    if (fragmentDistance < nearestFragment) { nearestFragment = fragmentDistance; nearestPoint = { x: body.x, y: body.y }; }

    const waypoint = route[routeIndex];
    const passed = waypoint.sign > 0 ? body[waypoint.axis] >= waypoint.value : body[waypoint.axis] <= waypoint.value;
    if (passed && routeIndex < route.length - 1) {
      routeIndex += 1; body.direction = route[routeIndex].direction; body.actions += 1;
    }
    else if (passed) finalApproach = true;
    if (finalApproach) {
      const control = (864 - body.x) * 2.4 - body.vx * 1.35;
      const nextDirection = Math.abs(864 - body.x) < 8 && Math.abs(body.vx) < 54
        ? null : control > 0 ? "right" : "left";
      if (nextDirection !== body.direction) { body.direction = nextDirection; body.actions += 1; }
    }

    const inside = Math.hypot(body.x - 864, body.y - 72) <= 32;
    const currentSpeed = Math.hypot(body.vx, body.vy);
    if (inside && currentSpeed <= 78) hold += dt;
    else if (!inside) hold = 0;
    else hold = Math.max(0, hold - dt * 2);
    time += dt;
  }
  return { passed: collected && hold >= 0.4, time, collected, nearestFragment, nearestPoint, x: body.x, y: body.y, speed: Math.hypot(body.vx, body.vy) };
}

function verifyDarknessMemory() {
  const points = [
    { x: 430, y: 458 }, { x: 430, y: 290 }, { x: 610, y: 290 },
    { x: 470, y: 290 }, { x: 470, y: 466 }, { x: 730, y: 466 },
    { x: 730, y: 72 }, { x: 865, y: 72 },
  ];
  let previous = { x: 86, y: 458, radius: 12 };
  let distance = 0;
  let collected = false;
  for (const point of points) {
    const current = { ...point, radius: 12 };
    distance += Math.hypot(current.x - previous.x, current.y - previous.y);
    collected ||= touchesFragment(MEMORY_FRAGMENTS.darkness, current, previous);
    previous = current;
  }
  return { passed: collected && distance / 185 < LIMIT, time: distance / 185, collected };
}

function verifyRecoilMemory() {
  const targets = [
    { baseX: 205, y: 150, phase: 0 },
    { baseX: 480, y: 112, phase: 2.1 },
    { baseX: 755, y: 165, phase: 4.2 },
  ];
  let turretX = 480;
  let time = 0;
  let actions = 0;
  let collected = false;
  let hits = 0;

  const shoot = ({ baseX, y, phase = 0, fragment = false }) => {
    actions += 1;
    let arrival = time + Math.hypot(baseX - turretX, y - 456) / 720;
    // 움직이는 표적은 예상 도착 시점의 위치를 두 번 보정해 조준한다.
    let targetX = baseX;
    for (let i = 0; i < 2 && !fragment; i += 1) {
      targetX = baseX + Math.sin(arrival * 1.35 + phase) * 34;
      arrival = time + Math.hypot(targetX - turretX, y - 456) / 720;
    }
    const drift = actions === 1 ? 0 : (actions - 1) * 0.012 * (actions % 2 ? -1 : 1);
    const desiredAngle = Math.atan2(y - 456, targetX - turretX);
    const baseAim = desiredAngle - drift;
    const angle = baseAim + drift; // 누적 오차만큼 반대로 조준한 실제 최종 탄도
    const bullet = { x: turretX, y: 456, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720, radius: 5 };
    let reached = false;
    for (let step = 0; step < 900 && !reached; step += 1) {
      const previous = { x: bullet.x, y: bullet.y };
      time += dt;
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
      if (fragment) {
        reached = touchesFragment(MEMORY_FRAGMENTS.recoil, bullet, previous);
        collected ||= reached;
      } else {
        const movingX = baseX + Math.sin(time * 1.35 + phase) * 34;
        reached = Math.hypot(bullet.x - movingX, bullet.y - y) <= 33;
        if (reached) hits += 1;
      }
    }
    turretX = clamp(turretX - Math.cos(angle) * (12 + actions * 6), 105, 855);
    return reached;
  };

  shoot({ baseX: MEMORY_FRAGMENTS.recoil.x, y: MEMORY_FRAGMENTS.recoil.y, fragment: true });
  targets.forEach((target) => shoot(target));
  return { passed: collected && hits === 3 && time < LIMIT, time, collected, hits, actions };
}

function simulateRotation(firstLeft, rightDrive) {
  let angle = -1.15;
  let velocity = 0;
  let actions = 1;
  let time = 0;
  let hold = 0;
  let collected = false;
  while (time < LIMIT && hold < 0.65) {
    let direction = 0;
    if (time < firstLeft) direction = -1;
    else if (time < firstLeft + rightDrive) { direction = 1; actions = 2; }
    const torque = 2.45 * (1 + actions * 0.16);
    const damping = Math.max(0.22, 1.32 - actions * 0.1);
    if (direction) velocity += direction * torque * dt;
    else velocity = towardZero(velocity, damping * dt);
    const maxVelocity = 1.55 + actions * 0.27;
    velocity = clamp(velocity, -maxVelocity, maxVelocity);
    const previousAngle = angle;
    angle += velocity * dt;
    if (angle > Math.PI) angle -= Math.PI * 2;
    if (angle < -Math.PI) angle += Math.PI * 2;
    const fragmentAngle = -2.1;
    const crossed = Math.abs(Math.atan2(Math.sin(angle - fragmentAngle), Math.cos(angle - fragmentAngle))) <= 0.13
      || Math.abs(Math.atan2(Math.sin(previousAngle - fragmentAngle), Math.cos(previousAngle - fragmentAngle))) <= 0.13;
    collected ||= crossed;
    const error = Math.abs(Math.atan2(Math.sin(angle - 0.42), Math.cos(angle - 0.42)));
    const valid = error <= 0.09 && Math.abs(velocity) <= 0.22;
    if (valid) hold += dt; else hold = Math.max(0, hold - dt * 1.5);
    time += dt;
  }
  return { passed: collected && hold >= 0.65, time, collected, angle, velocity };
}

function verifyRotationMemory() {
  let best = null;
  for (let left = 0.75; left <= 1.35; left += 0.025) {
    for (let right = 1.25; right <= 3.5; right += 0.025) {
      const result = simulateRotation(left, right);
      if (result.passed && (!best || result.time < best.time)) best = { ...result, left, right };
    }
  }
  return best || { passed: false, time: LIMIT, collected: false };
}

const friction = verifyFrictionMemory();
const darkness = verifyDarknessMemory();
const rotation = verifyRotationMemory();
const recoil = verifyRecoilMemory();
for (const [name, result] of Object.entries({ recoil, friction, darkness, rotation })) {
  console.log(`${result.passed ? "PASS" : "FAIL"} | ${name} memory route | ${result.time.toFixed(2)}초`);
  assert.ok(result.passed, `${name} 기억조각 포함 경로가 20.26초 안에 완료돼야 한다: ${JSON.stringify(result)}`);
}
