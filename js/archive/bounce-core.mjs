// Fixed horizontal control; only landings increase the next bounce height.
export const BOUNCE_COURSE = {
  gravity: 900, moveSpeed: 185, initialHeight: 72, heightStep: 24, maxHeight: 216,
  minimumSupportOverlap: 14,
  start: { x: 112, y: 488 }, goal: { x: 810, y: 450, radius: 16 },
  walls: [
    { id: "start-floor", x: 30, y: 500, w: 115, h: 22 },
    { id: "p1", x: 198, y: 438, w: 26, h: 16 },
    { id: "p2", x: 133, y: 350, w: 24, h: 16 },
    { id: "p3", x: 253, y: 238, w: 24, h: 16 },
    { id: "p4", x: 436, y: 318, w: 22, h: 16 },
    { id: "p5", x: 572, y: 405, w: 22, h: 16 },
    { id: "p6", x: 663, y: 450, w: 24, h: 16 },
    { id: "end-floor", x: 796, y: 480, w: 28, h: 20 },
    { id: "low-ceiling", x: 650, y: 48, w: 112, h: 277 },
  ],
};

export function createBounceState() {
  return { ...BOUNCE_COURSE.start, vx: 0,
    vy: -Math.sqrt(2 * BOUNCE_COURSE.gravity * BOUNCE_COURSE.initialHeight),
    radius: 12, direction: null, bounces: 0, lastLanding: null, bounceHeight: BOUNCE_COURSE.initialHeight,
    walls: BOUNCE_COURSE.walls,
  };
}

export function stepBounce(s, dt) {
  const result = { landed: false, ceilingHit: false, failed: false, cleared: false };
  // Small steps prevent tunnelling through shelves and obstacle sides.
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.vx = s.direction === "left" ? -BOUNCE_COURSE.moveSpeed : s.direction === "right" ? BOUNCE_COURSE.moveSpeed : 0;
    s.x = Math.max(42, Math.min(918, s.x + s.vx * h));
    for (const wall of s.walls) {
      if (wall.oneWay || s.y + s.radius <= wall.y || s.y - s.radius >= wall.y + wall.h) continue;
      if (s.x + s.radius > wall.x && s.x - s.radius < wall.x + wall.w) {
        if (s.vx > 0) s.x = wall.x - s.radius;
        if (s.vx < 0) s.x = wall.x + wall.w + s.radius;
      }
    }
    const previousY = s.y;
    s.y += s.vy * h + BOUNCE_COURSE.gravity * h * h / 2;
    s.vy += BOUNCE_COURSE.gravity * h;
    for (const wall of s.walls) {
      const overlap = Math.min(s.x + s.radius, wall.x + wall.w) - Math.max(s.x - s.radius, wall.x);
      if (overlap <= 0) continue;
      if (overlap >= BOUNCE_COURSE.minimumSupportOverlap && s.vy >= 0 && previousY + s.radius <= wall.y + 0.01 && s.y + s.radius >= wall.y) {
        s.y = wall.y - s.radius;
        s.bounces++;
        s.lastLanding = wall.id;
        s.bounceHeight = Math.min(BOUNCE_COURSE.maxHeight, BOUNCE_COURSE.initialHeight + s.bounces * BOUNCE_COURSE.heightStep);
        s.vy = -Math.sqrt(2 * BOUNCE_COURSE.gravity * s.bounceHeight);
        result.landed = true;
        break;
      }
      if (!wall.oneWay && s.vy < 0 && previousY - s.radius >= wall.y + wall.h - 0.01 && s.y - s.radius <= wall.y + wall.h) {
        s.y = wall.y + wall.h + s.radius;
        s.vy = 0; // Ceiling absorbs the impact instead of starting a ricochet chain.
        result.ceilingHit = true;
        break;
      }
    }
    if (s.y < 48) { s.y = 48; s.vy = Math.max(0, s.vy); }
    result.failed = s.y - s.radius > 540;
    result.cleared = Math.hypot(s.x - BOUNCE_COURSE.goal.x, s.y - BOUNCE_COURSE.goal.y) <= s.radius + BOUNCE_COURSE.goal.radius;
    if (result.failed || result.cleared) break;
  }
  return result;
}
