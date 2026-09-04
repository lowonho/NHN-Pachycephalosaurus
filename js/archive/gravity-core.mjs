export const GRAVITY_COURSE = {
  jumpSpeed: 430, moveSpeed: 190, baseGravity: 720, gravityStep: 80, maxGravity: 1040,
  start: { x: 95, y: 483 },
  goal: { x: 745, y: 132, minX: 735 },
  platforms: [
    { id: "floor", x: 30, y: 500, w: 900, h: 20 },
    { id: "entry", x: 185, y: 416, w: 70, h: 16 },
    { id: "middle", x: 360, y: 332, w: 62, h: 16 },
    { id: "upper", x: 530, y: 248, w: 60, h: 16 },
    { id: "goal", x: 695, y: 164, w: 85, h: 16, goal: true },
    // Optional footholds: fewer jumps on the direct route, more choices around it.
    { id: "bridge", x: 280, y: 370, w: 48, h: 14 },
    { id: "left", x: 105, y: 342, w: 62, h: 14 },
    { id: "memory", x: 230, y: 284, w: 66, h: 14 },
    { id: "crossing", x: 375, y: 232, w: 62, h: 14 },
    { id: "merge", x: 510, y: 190, w: 60, h: 14 },
    { id: "catch", x: 450, y: 400, w: 68, h: 14 },
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
  if (s.onGround && s.support && (s.x + s.width / 2 <= s.support.x || s.x - s.width / 2 >= s.support.x + s.support.w)) {
    s.onGround = false;
    s.support = null;
  }
  let landed = false;
  if (s.vy >= 0) for (const platform of s.platforms) {
    const horizontal = s.x + s.width / 2 > platform.x && s.x - s.width / 2 < platform.x + platform.w;
    if (horizontal && previousBottom <= platform.y + 3 && s.y + s.height / 2 >= platform.y) {
      landed = !s.onGround;
      s.y = platform.y - s.height / 2;
      s.vy = 0;
      s.onGround = true;
      s.support = platform;
      break;
    }
  }
  if (s.y > 600) {
    Object.assign(s, GRAVITY_COURSE.start, { vx: 0, vy: 0, onGround: true, support: s.platforms[0] });
  }
  return { landed, cleared: Boolean(s.support?.goal && s.onGround && s.x >= GRAVITY_COURSE.goal.minX) };
}
