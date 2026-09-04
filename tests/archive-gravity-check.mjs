import assert from "node:assert/strict";
import { GRAVITY_COURSE as C, createGravityState, applyGravityJump, stepGravity } from "../js/archive/gravity-core.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";

const tail = [['p5',401,453], ['p6',464,517], ['p7',527,582], ['goal',592,647]];
const routes = [
  { name: '초반 두 칸 건너뛰기', full: false, hops: [['p2',170,263], ['p4',279,392], ...tail] },
  { name: '한 칸씩', full: false, hops: [['p1',160,198], ['p2',214,263], ['p3',279,324], ['p4',336,389], ...tail] },
  { name: '조각 우회', full: true, hops: [['p2',170,263], ['p3',279,324], ['left',312,239], ['memory',251,304], ['merge',316,403], ['p6',414,517], ['p7',527,582], ['goal',592,647]] },
];
function run(hz, route, wasted = 0) {
  const dt = 1 / hz, s = createGravityState();
  let time = 0, actions = wasted, fragment = false, cleared = false;
  const visited = new Set(['floor']);
  const tick = () => {
    const previous = { x: s.x, y: s.y };
    const result = stepGravity(s, dt);
    assert.ok(!result.failed, `${route.name}: fell at ${hz}Hz`);
    time += dt;
    fragment ||= touchesFragment(MEMORY_FRAGMENTS.gravity, s, previous);
    if (result.landed) visited.add(s.support.id);
    cleared ||= result.cleared;
    assert.ok(time < 20.26, `route timed out: ${JSON.stringify(s)}`);
  };
  const walkTo = (x) => {
    while (Math.abs(s.x - x) > C.moveSpeed * dt) { s.direction = s.x < x ? 'right' : 'left'; tick(); }
    s.direction = null;
  };
  for (const [id, takeoff, landingX] of route.hops) {
    const target = C.platforms.find(p => p.id === id);
    walkTo(takeoff);
    assert.ok(applyGravityJump(s, ++actions));
    do {
      s.direction = Math.abs(s.x - landingX) <= C.moveSpeed * dt ? null : s.x < landingX ? 'right' : 'left';
      tick();
    } while (!s.onGround);
    assert.equal(s.support, target, `${route.name}: missed ${id} at ${hz}Hz`);
  }
  walkTo(C.goal.x);
  tick();
  assert.ok(cleared);
  assert.equal(fragment, route.full);
  assert.ok(visited.size < C.platforms.length, 'not every platform is mandatory');
  return { time, actions, visited: [...visited] };
}
for (const hz of [40, 60, 120]) for (const route of routes) {
  const result = run(hz, route);
  console.log(`PASS | ${route.name} ${hz}Hz | ${result.time.toFixed(2)}초 | 점프 ${result.actions}회`);
}
for (const hz of [40, 60, 120]) {
  const capped = run(hz, routes[1], 10);
  console.log(`PASS | 최대 중력 한 칸씩 ${hz}Hz | ${capped.time.toFixed(2)}초`);
}

// Same takeoff: an early jump can skip p1; a late jump cannot reach p2.
for (const hz of [40, 60, 120]) {
  for (const [actions, canSkip] of [[1, true], [8, false]]) {
    const s = createGravityState();
    s.x = 170;
    applyGravityJump(s, actions);
    let maxRise = 0;
    for (let i = 0; i < hz * 2 && !s.onGround; i++) {
      s.direction = s.x < 263 - C.moveSpeed / hz ? 'right' : null;
      const result = stepGravity(s, 1 / hz);
      maxRise = Math.max(maxRise, 500 - (s.y + s.height / 2));
      if (result.failed) break;
    }
    assert.equal(s.support?.id === 'p2', canSkip, `${hz}Hz, jump ${actions}`);
    assert.ok(canSkip ? maxRise >= 96 : maxRise < 96);
  }
}
const fallen = createGravityState();
Object.assign(fallen, { x: 430, y: 565, vy: 180, onGround: false, support: null });
assert.equal(stepGravity(fallen, 1 / 60).failed, true);
console.log('PASS | early double-step succeeds, late double-step fails, falling ends the record');
const ledge = C.platforms.find(p => p.id === 'p7');
for (const [offset, shouldLand] of [[-12, false], [-3, true]]) {
  const s = createGravityState();
  Object.assign(s, { x: ledge.x + offset, y: ledge.y - 18, vy: 120, onGround: false, support: null });
  stepGravity(s, 0.025);
  assert.equal(s.support === ledge, shouldLand, 'edge support needs enough overlap');
}
console.log('PASS | 1px edge catch rejected, stable landing accepted');
