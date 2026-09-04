export const VIEWPORT = { width: 960, height: 540 };
export const BALL_RADIUS = 12;
export const START = { x: 100, y: 450 };
export const GOAL = { x: 715, y: 420, radius: 30 };

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

// Record 01: four broad S-bends, then an optional loop around the side island.
// Alternating dividers make the bends real without tightening the first turns.
export const WALLS = [
  { x: 32, y: 126, w: 896, h: 14, kind: "outer" },
  { x: 32, y: 498, w: 896, h: 14, kind: "outer" },
  { x: 32, y: 126, w: 14, h: 386, kind: "outer" },
  { x: 914, y: 126, w: 14, h: 386, kind: "outer" },
  { x: 46, y: 140, w: 164, h: 212, kind: "divider" },
  { x: 400, y: 290, w: 25, h: 208, kind: "divider" },
  { x: 610, y: 140, w: 25, h: 212, kind: "divider" },
  { x: 775, y: 295, w: 25, h: 45, kind: "divider" },
];

export const ROUTE = [
  { x: 300, y: 450, input: "right" },
  { x: 300, y: 215, input: "up" },
  { x: 515, y: 215, input: "right" },
  { x: 515, y: 420, input: "down" },
  { ...GOAL, input: "right" },
];
export const FRAGMENT_ROUTE = [
  ...ROUTE.slice(0, 4),
  { x: 840, y: 420, input: "right" },
  { x: 840, y: 210, input: "up" },
  { x: 715, y: 210, input: "left" },
  { ...GOAL, input: "down" },
];
