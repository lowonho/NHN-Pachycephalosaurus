import assert from 'node:assert/strict';
import { BOUNCE_COURSE, createBounceState, stepBounce } from '../js/archive/bounce-core.mjs';
import { MEMORY_FRAGMENTS, touchesFragment } from '../js/archive/fragments.mjs';

for (const hz of [40, 60, 120]) {
  for (const memory of [false, true]) {
    const s = createBounceState();
    let collected = false, cleared = false, ceilingHits = 0, elapsed = 0;
    while (elapsed < 20.26) {
      let target = { p1: 145, p2: 265, p3: 447, p4: 583, p5: 675, p6: 810 }[s.lastLanding] ?? 211;
      if (memory && !collected && s.lastLanding === 'p4') target = 447;
      s.direction = Math.abs(target - s.x) < 2 ? null : target > s.x ? 'right' : 'left';
      const previous = { ...s };
      const result = stepBounce(s, 1 / hz);
      collected ||= touchesFragment(MEMORY_FRAGMENTS.bounce, s, previous);
      ceilingHits += Number(result.ceilingHit);
      elapsed += 1 / hz;
      assert.equal(result.failed, false, `${hz}Hz route fell`);
      assert.ok(Math.abs(s.vx) <= BOUNCE_COURSE.moveSpeed);
      if (result.cleared) { cleared = true; break; }
    }
    assert.ok(cleared, `${hz}Hz ${memory ? 'memory' : 'basic'} route`);
    assert.equal(collected, memory, 'Memory requires a deliberate detour');
    assert.ok(ceilingHits > 0, 'Route traverses the low ceiling');
    console.log(`${hz}Hz ${memory ? 'memory' : 'basic'}: ${elapsed.toFixed(2)}s, ${s.bounces} landings`);
  }
}

const idle = createBounceState();
for (let i = 0; i < 2400; i++) stepBounce(idle, 1 / 120);
assert.equal(idle.bounceHeight, BOUNCE_COURSE.maxHeight);
assert.equal(idle.x, BOUNCE_COURSE.start.x);
const ceiling = createBounceState();
Object.assign(ceiling, { x: 740, y: 340, vy: -450 });
const hit = stepBounce(ceiling, 1 / 40);
assert.ok(hit.ceilingHit);
assert.equal(ceiling.bounces, 0, 'Ceiling contact does not increase bounce strength');
assert.ok(ceiling.vy >= 0);
const pit = createBounceState();
Object.assign(pit, { x: 575, y: 490, vy: 150 });
let fell = false;
for (let i = 0; i < 60; i++) fell ||= stepBounce(pit, 1 / 60).failed;
assert.ok(fell, 'The floor gap is a real fall hazard');
const wall = createBounceState();
Object.assign(wall, { x: 183, y: 446, direction: 'right', vy: 0 });
stepBounce(wall, 1 / 40);
assert.ok(wall.x <= 184);
assert.equal(wall.bounces, 0, 'Side contact does not increase bounce strength');
const held = createBounceState();
held.direction = 'right';
let holdFailed = false;
for (let i = 0; i < 1200; i++) {
  const result = stepBounce(held, 1 / 60);
  assert.equal(result.cleared, false, 'Holding right must not clear the course');
  if (result.failed) { holdFailed = true; break; }
}
assert.ok(holdFailed);
console.log('Bounce routes, capped height, ceiling, walls, fall and hold-right checks passed.');
