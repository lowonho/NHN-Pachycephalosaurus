// Initial placements only. Change these independently of the physics and maps.
export const MEMORY_FRAGMENTS = Object.freeze({
  maze: { x: 830, y: 210, radius: 14, hint: "오른쪽 위 조각을 얻고 돌아오기" },
  gravity: { x: 307, y: 244, radius: 12, hint: "" },
  bounce: { x: 447, y: 82, radius: 10, hint: "" },
  stack: { x: 530, y: 220, radius: 12, hint: "" },
  friction: { x: 440, y: 64, radius: 12, hint: "" },
});

// Swept circle check prevents fast projectiles from skipping small fragments.
export function touchesFragment(fragment, body, previous = body) {
  const dx = body.x - previous.x;
  const dy = body.y - previous.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((fragment.x - previous.x) * dx + (fragment.y - previous.y) * dy) / length)) : 0;
  const radius = fragment.radius + (body.radius ?? 12);
  return Math.hypot(fragment.x - previous.x - dx * t, fragment.y - previous.y - dy * t) <= radius;
}
