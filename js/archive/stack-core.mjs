export const STACK_RULES = { count: 6, width: 84, widthStep: 8, height: 38, gravity: 1100, speed: 240, baseWidth: 96, massStep: 0.75, minimumMargin: 8 };
export const stackBlockWidth = count => STACK_RULES.width - count * STACK_RULES.widthStep;
export function createStackState() {
  return { blocks: [], x: 480, y: 80, vy: 0, radius: 18, direction: null, travel: 1, dropping: false, failed: false, hold: 0, margin: 48 };
}
// Each interface must support the mass-weighted centre of everything above it.
export function stackMargin(blocks) {
  let margin = 70;
  for (let i = 0; i < blocks.length; i++) {
    const lower = i ? blocks[i - 1] : { x: 480, w: STACK_RULES.baseWidth };
    const upper = blocks[i];
    const left = Math.max(lower.x - lower.w / 2, upper.x - upper.w / 2);
    const right = Math.min(lower.x + lower.w / 2, upper.x + upper.w / 2);
    const above = blocks.slice(i);
    const mass = above.reduce((n, b) => n + b.mass, 0);
    const center = above.reduce((n, b) => n + b.x * b.mass, 0) / mass;
    margin = Math.min(margin, center - left, right - center);
  }
  return margin;
}
export function dropStack(s) {
  if (s.dropping || s.failed || s.blocks.length >= STACK_RULES.count) return false;
  s.dropping = true;
  return true;
}
export function stepStack(s, dt) {
  let landed = false;
  if (s.failed) return { failed: true, cleared: false, landed };
  if (s.blocks.length >= STACK_RULES.count) {
    s.hold += dt;
    return { failed: false, cleared: s.hold >= 0.7, landed };
  }
  if (!s.dropping) {
    const velocity = s.direction === 'left' ? -STACK_RULES.speed : s.direction === 'right' ? STACK_RULES.speed : s.travel * (130 + s.blocks.length * 22);
    s.x = Math.max(300, Math.min(660, s.x + velocity * dt));
    if (s.x <= 300) s.travel = 1;
    if (s.x >= 660) s.travel = -1;
  } else {
    s.y += s.vy * dt + STACK_RULES.gravity * dt * dt / 2;
    s.vy += STACK_RULES.gravity * dt;
    const top = 480 - s.blocks.length * STACK_RULES.height;
    if (s.y + STACK_RULES.height / 2 >= top) {
      s.y = top - STACK_RULES.height / 2;
      s.blocks.push({ x: s.x, y: s.y, w: stackBlockWidth(s.blocks.length), mass: 1 + s.blocks.length * STACK_RULES.massStep });
      s.margin = stackMargin(s.blocks);
      s.failed = s.margin < STACK_RULES.minimumMargin;
      s.dropping = false;
      landed = true;
    }
  }
  return { failed: s.failed, cleared: false, landed };
}
export function nextStackBlock(s) {
  s.x = s.blocks.length % 2 ? 650 : 310;
  s.travel = s.blocks.length % 2 ? -1 : 1;
  s.y = 80; s.vy = 0;
}
