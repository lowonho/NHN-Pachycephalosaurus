export const GRAVITY_COURSE = {
  jumpSpeed: 430, moveSpeed: 190, baseGravity: 800, gravityStep: 160, maxGravity: 1840,
  minimumSupportOverlap: 8,
  start: { x: 95, y: 483 },
  goal: { x: 657, y: 78, minX: 650 },
  platforms: [
    { id: "floor", x: 30, y: 500, w: 145, h: 20 },
    { id: "p1", x: 180, y: 452, w: 36, h: 14 },
    { id: "p2", x: 245, y: 404, w: 36, h: 14 },
    { id: "p3", x: 310, y: 356, w: 32, h: 14 },
    { id: "p4", x: 375, y: 308, w: 32, h: 14 },
    { id: "p5", x: 440, y: 260, w: 30, h: 14 },
    { id: "p6", x: 505, y: 210, w: 28, h: 14 },
    { id: "p7", x: 570, y: 160, w: 28, h: 14 },
    { id: "goal", x: 635, y: 110, w: 40, h: 16, goal: true },
    // Extra jumps on this branch trade a memory fragment for stronger gravity.
    { id: "left", x: 225, y: 316, w: 32, h: 14 },
    { id: "memory", x: 290, y: 268, w: 32, h: 14 },
    { id: "merge", x: 390, y: 228, w: 30, h: 14 },
  ],
};
export function createGravityState() {
  return { ...GRAVITY_COURSE.start, width: 26, height: 34, vx: 0, vy: 0,
    direction: null, onGround: true, support: GRAVITY_COURSE.platforms[0],
    gravity: GRAVITY_COURSE.baseGravity, platforms: GRAVITY_COURSE.platforms };
}

export function applyGravityJump(state, actions) {
  state.gravity = Math.min(GRAVITY_COURSE.maxGravity, GRAVITY_COURSE.baseGravity + (actions - 1) * GRAVITY_COURSE.gravityStep);
  if (!state.onGround) return false;
  state.vy = -GRAVITY_COURSE.jumpSpeed;
  state.onGround = false;
  state.support = null;
  return true;
}

export function stepGravity(s, dt) {
  const previousBottom = s.y + s.height / 2;
  s.vx = s.direction === "left" ? -GRAVITY_COURSE.moveSpeed : s.direction === "right" ? GRAVITY_COURSE.moveSpeed : 0;
  s.x = Math.max(61, Math.min(899, s.x + s.vx * dt));
  // Integrate constant gravity exactly so tight jumps stay possible at 40–120Hz.
  s.y += s.vy * dt + s.gravity * dt * dt / 2;
  s.vy += s.gravity * dt;
  const overlap = (platform) => Math.min(s.x + s.width / 2, platform.x + platform.w) - Math.max(s.x - s.width / 2, platform.x);
  if (s.onGround && s.support && overlap(s.support) < GRAVITY_COURSE.minimumSupportOverlap) {
    s.onGround = false;
    s.support = null;
  }
  let landed = false;
  if (s.vy >= 0) for (const platform of s.platforms) {
    const horizontal = overlap(platform) >= GRAVITY_COURSE.minimumSupportOverlap;
    if (horizontal && previousBottom <= platform.y + 3 && s.y + s.height / 2 >= platform.y) {
      landed = !s.onGround;
      s.y = platform.y - s.height / 2;
      s.vy = 0;
      s.onGround = true;
      s.support = platform;
      break;
    }
  }
  return { landed, failed: s.y - s.height / 2 > 540,
    cleared: Boolean(s.support?.goal && s.onGround && s.x >= GRAVITY_COURSE.goal.minX) };
}
