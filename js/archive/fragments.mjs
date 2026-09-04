// Initial placements only. Change these independently of the physics and maps.
export const MEMORY_FRAGMENTS = Object.freeze({
  maze: { x: 830, y: 210, radius: 14, hint: "오른쪽 위 조각을 얻고 돌아오기" },
  gravity: { x: 307, y: 244, radius: 12, hint: "" },
  bounce: { x: 550, y: 400, radius: 14, hint: "공으로 조각에 접촉" },
  recoil: { x: 100, y: 280, radius: 16, hint: "세 노드 완료 전에 조각을 사격" },
  friction: { x: 440, y: 105, radius: 12, hint: "화물로 상단 조각에 접촉" },
  darkness: { x: 610, y: 290, radius: 12, hint: "회랑 안쪽의 조각에 접촉" },
  rotation: { x: 480 + Math.cos(-2.1) * 165, y: 272 + Math.sin(-2.1) * 165, radius: 14, hint: "밝은 끝점을 조각까지 회전" },
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
