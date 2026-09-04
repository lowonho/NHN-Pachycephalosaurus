import assert from "node:assert/strict";
import { GRAVITY_COURSE as C, createGravityState, applyGravityJump, stepGravity } from "../js/archive/gravity-core.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";

const routes = [
  { name: '직행', full: false, hops: [['entry',150,220], ['middle',253,390], ['upper',420,560], ['goal',588,717]] },
  { name: '중간 발판 경유', full: false, hops: [['entry',150,220], ['bridge',250,304], ['middle',326,390], ['upper',420,560], ['goal',588,717]] },
  { name: '조각 우회', full: true, hops: [['entry',150,220], ['left',190,136], ['memory',165,263], ['crossing',294,405], ['merge',435,540], ['goal',568,717]] },
];
function run(hz, route, wasted = 0) {
  const dt = 1 / hz, s = createGravityState();
  let time = 0, actions = wasted, fragment = false, cleared = false;
  const visited = new Set(['floor']);
  const tick = () => {
    const previous = { x: s.x, y: s.y };
    const result = stepGravity(s, dt);
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
  walkTo(745);
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
for (const route of routes) {
  const result = run(60, route, 10);
  console.log(`PASS | 최대 중력 ${route.name} | ${result.time.toFixed(2)}초`);
}
const early = createGravityState();
Object.assign(early, { x: 185, y: 399, support: C.platforms[1] });
applyGravityJump(early, 2);
early.direction = 'right';
for (let i = 0; i < 100 && !early.onGround; i++) stepGravity(early, 1 / 120);
assert.notEqual(early.support, C.platforms[2]);
console.log('PASS | too-early takeoff does not reach the direct route target');
