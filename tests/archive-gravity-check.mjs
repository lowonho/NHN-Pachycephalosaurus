import assert from "node:assert/strict";
import { GRAVITY_COURSE as C, createGravityState, applyGravityJump, stepGravity } from "../js/archive/gravity-core.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";

function run(hz, full = false, wasted = 0) {
  const dt = 1 / hz, s = createGravityState();
  let time = 0, actions = wasted, fragment = false, cleared = false;
  const tick = () => {
    const previous = { x: s.x, y: s.y };
    const result = stepGravity(s, dt);
    time += dt;
    fragment ||= touchesFragment(MEMORY_FRAGMENTS.gravity, s, previous);
    cleared ||= result.cleared;
    assert.ok(time < 20.26, `route timed out: ${JSON.stringify(s)}`);
  };
  const walkTo = (x) => {
    while (Math.abs(s.x - x) > C.moveSpeed * dt) { s.direction = s.x < x ? 'right' : 'left'; tick(); }
    s.direction = null;
  };
  for (let i = 1; i < C.platforms.length; i++) {
    const from = C.platforms[i - 1], target = C.platforms[i];
    walkTo(i === 1 ? 150 : from.x + from.w - 2);
    assert.ok(applyGravityJump(s, ++actions));
    const landingX = target.goal ? 717 : target.x + target.w / 2;
    do {
      s.direction = s.x < landingX - C.moveSpeed * dt ? 'right' : null;
      tick();
    } while (!s.onGround);
    assert.equal(s.support, target, `missed platform ${i} at ${hz}Hz`);
  }
  if (full) {
    walkTo(721);
    applyGravityJump(s, ++actions);
    do {
      s.direction = !fragment ? 'right' : s.x > 722 ? 'left' : null;
      tick();
    } while (!s.onGround);
    assert.ok(fragment, 'extra jump must collect the fragment');
    assert.ok(s.support.goal, 'fragment jump must land back on the final platform');
  }
  walkTo(745);
  tick();
  assert.ok(cleared);
  assert.equal(fragment, full);
  return { time, actions };
}

for (const hz of [40, 60, 120]) for (const full of [false, true]) {
  const result = run(hz, full);
  console.log(`PASS | 중력 ${full ? '완전' : '부분'} 복구 ${hz}Hz | ${result.time.toFixed(2)}초 | 점프 ${result.actions}회`);
}
const capped = run(60, false, 10);
console.log(`PASS | 중력 상한에서도 기본 경로 가능 | ${capped.time.toFixed(2)}초`);
// Earlier takeoff should fail: course precision is part of the challenge.
const early = createGravityState();
Object.assign(early, { x: 185, y: 399, support: C.platforms[1] });
applyGravityJump(early, 2);
early.direction = 'right';
for (let i = 0; i < 100 && !early.onGround; i++) stepGravity(early, 1 / 120);
assert.notEqual(early.support, C.platforms[2]);
console.log('PASS | too-early takeoff misses the next platform');
