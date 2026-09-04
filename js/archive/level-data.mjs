export const VIEWPORT = { width: 960, height: 540 };
export const BALL_RADIUS = 12;
export const START = { x: 100, y: 450 };
export const GOAL = { x: 665, y: 215, radius: 30 };

export const PHYSICS = {
  timeLimit: 20.26,
  baseAcceleration: 610,
  baseMaxSpeed: 190,
  maxMultiplier: 3.35,
  goalMaxSpeed: 110,
  goalHoldSeconds: 0.35,
  wallPenaltySeconds: 1,
  wallImpactMinSpeed: 90,
  wallImpactCooldown: 0.45,
};

// Record 01: two broad corners, then a choice between braking at RESTORE
// and travelling into the side bay for a fragment. No invisible boundaries.
export const WALLS = [
  { x: 32, y: 126, w: 896, h: 14, kind: "outer" },
  { x: 32, y: 498, w: 896, h: 14, kind: "outer" },
  { x: 32, y: 126, w: 14, h: 386, kind: "outer" },
  { x: 914, y: 126, w: 14, h: 386, kind: "outer" },
  { x: 46, y: 140, w: 264, h: 212, kind: "divider" },
  { x: 490, y: 310, w: 240, h: 188, kind: "divider" },
];

export const ROUTE = [
  { x: 400, y: 450, input: "right" },
  { x: 400, y: 215, input: "up" },
  { ...GOAL, input: "right" },
];
export const FRAGMENT_ROUTE = [
  ...ROUTE.slice(0, 2),
  { x: 830, y: 215, input: "right" },
  { x: 830, y: 420, input: "down" },
  { x: 830, y: 215, input: "up" },
  { ...GOAL, input: "left" },
];
