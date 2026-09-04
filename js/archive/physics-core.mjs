import { BALL_RADIUS, PHYSICS, START, WALLS } from "./level-data.mjs";

const DIRECTION_VECTORS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export function multiplierForPresses(presses) {
  if (presses <= 0) return 1;
  if (presses <= 3) return 1 + (presses - 1) * 0.08;
  if (presses <= 7) return 1.42 + (presses - 4) * 0.29;
  return Math.min(PHYSICS.maxMultiplier, 2.66 + (presses - 8) * 0.22);
}

export function dragForPresses(presses) {
  if (presses <= 3) return 920;
  if (presses <= 7) return Math.max(260, 710 - (presses - 3) * 105);
  return Math.max(90, 250 - (presses - 7) * 28);
}

export function createBallState() {
  return {
    x: START.x,
    y: START.y,
    vx: 0,
    vy: 0,
    input: null,
    presses: 0,
    multiplier: 1,
    collisions: 0,
    touchingWall: false,
  };
}

export function registerDirection(state, direction) {
  if (!DIRECTION_VECTORS[direction]) return;
  state.input = direction;
  state.presses += 1;
  state.multiplier = multiplierForPresses(state.presses);
}

export function releaseDirection(state, direction) {
  if (state.input === direction) state.input = null;
}

function moveTowardZero(value, amount) {
  if (Math.abs(value) <= amount) return 0;
  return value - Math.sign(value) * amount;
}

function resolveCircleRect(state, rect) {
  const nearestX = Math.max(rect.x, Math.min(state.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(state.y, rect.y + rect.h));
  let dx = state.x - nearestX;
  let dy = state.y - nearestY;
  const radiusSq = BALL_RADIUS * BALL_RADIUS;
  let distanceSq = dx * dx + dy * dy;

  if (distanceSq >= radiusSq) return false;

  let nx;
  let ny;
  let penetration;

  if (distanceSq > 0.0001) {
    const distance = Math.sqrt(distanceSq);
    nx = dx / distance;
    ny = dy / distance;
    penetration = BALL_RADIUS - distance;
  } else {
    const toLeft = Math.abs(state.x - rect.x);
    const toRight = Math.abs(rect.x + rect.w - state.x);
    const toTop = Math.abs(state.y - rect.y);
    const toBottom = Math.abs(rect.y + rect.h - state.y);
    const minimum = Math.min(toLeft, toRight, toTop, toBottom);
    nx = minimum === toLeft ? -1 : minimum === toRight ? 1 : 0;
    ny = minimum === toTop ? -1 : minimum === toBottom ? 1 : 0;
    penetration = BALL_RADIUS + minimum;
  }

  state.x += nx * penetration;
  state.y += ny * penetration;

  const velocityIntoWall = state.vx * nx + state.vy * ny;
  if (velocityIntoWall < 0) {
    state.vx -= velocityIntoWall * nx;
    state.vy -= velocityIntoWall * ny;
  }
  return true;
}

export function stepBall(state, dt, walls = WALLS) {
  const vector = DIRECTION_VECTORS[state.input] ?? { x: 0, y: 0 };
  const acceleration = PHYSICS.baseAcceleration * state.multiplier;
  const drag = dragForPresses(state.presses);

  if (vector.x !== 0) state.vx += vector.x * acceleration * dt;
  else state.vx = moveTowardZero(state.vx, drag * dt);

  if (vector.y !== 0) state.vy += vector.y * acceleration * dt;
  else state.vy = moveTowardZero(state.vy, drag * dt);

  const maxSpeed = PHYSICS.baseMaxSpeed * state.multiplier;
  const speed = Math.hypot(state.vx, state.vy);
  if (speed > maxSpeed) {
    state.vx = (state.vx / speed) * maxSpeed;
    state.vy = (state.vy / speed) * maxSpeed;
  }

  state.x += state.vx * dt;
  state.y += state.vy * dt;

  let frameCollisions = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let resolved = false;
    for (const wall of walls) {
      if (resolveCircleRect(state, wall)) {
        resolved = true;
        frameCollisions += 1;
      }
    }
    if (!resolved) break;
  }
  if (frameCollisions > 0 && !state.touchingWall) state.collisions += 1;
  state.touchingWall = frameCollisions > 0;
  return frameCollisions;
}

export function riskLabel(presses) {
  if (presses <= 3) return "안정";
  if (presses <= 7) return "가속";
  if (presses <= 11) return "위험";
  return "붕괴 직전";
}

