import assert from "node:assert/strict";
import { GOAL, PHYSICS, ROUTE, FRAGMENT_ROUTE } from "../js/archive/level-data.mjs";
import { createBallState, registerDirection, stepBall, dragForPresses } from "../js/archive/physics-core.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "../js/archive/fragments.mjs";

function simulate(route, dt, reactionDelay = 0) {
  const state = createBallState();
  let elapsed = 0, hold = 0, index = 0, braking = false, fragment = false;
  registerDirection(state, route[0].input);
  while (elapsed + state.collisions * PHYSICS.wallPenaltySeconds < PHYSICS.timeLimit && hold < PHYSICS.goalHoldSeconds) {
    const waypoint = route[index];
    const axis = ['left', 'right'].includes(waypoint.input) ? 'x' : 'y';
    const sign = ['right', 'down'].includes(waypoint.input) ? 1 : -1;
    const velocity = Math.abs(axis === 'x' ? state.vx : state.vy);
    const distance = (waypoint[axis] - state[axis]) * sign;
    // Anticipate half a frame of acceleration; later bends have much more
    // inertia, so a purely continuous stopping estimate reacts too late.
    const drag = dragForPresses(state.presses);
    const stoppingDistance = velocity * velocity / (2 * drag)
      + PHYSICS.baseAcceleration * state.multiplier * dt * velocity / (2 * drag);
    if (!braking && distance <= stoppingDistance + velocity * dt - velocity * reactionDelay) {
      state.input = null;
      braking = true;
    }
    const previous = { x: state.x, y: state.y };
    stepBall(state, dt);
    elapsed += dt;
    fragment ||= touchesFragment(MEMORY_FRAGMENTS.maze, state, previous);
    const speed = Math.hypot(state.vx, state.vy);
    const inside = Math.hypot(state.x - GOAL.x, state.y - GOAL.y) <= GOAL.radius;
    if (inside && speed <= PHYSICS.goalMaxSpeed) hold += dt;
    else if (!inside) hold = 0;
    else hold = Math.max(0, hold - dt * 2);
    if (braking && speed === 0 && index < route.length - 1) {
      index++;
      braking = false;
      registerDirection(state, route[index].input);
    }
  }
  return { cleared: hold >= PHYSICS.goalHoldSeconds, elapsed, fragment, collisions: state.collisions, presses: state.presses, x: state.x, y: state.y };
}

for (const hz of [40, 60, 120]) {
  for (const [name, route, full] of [['일반', ROUTE, false], ['조각 왕복', FRAGMENT_ROUTE, true]]) {
    const run = simulate(route, 1 / hz);
    assert.ok(run.cleared, `${name} ${hz}Hz: ${JSON.stringify(run)}`);
    assert.equal(run.fragment, full);
    assert.equal(run.collisions, 0);
    console.log(`PASS | ${name} ${hz}Hz | ${run.elapsed.toFixed(2)}초 | 입력 ${run.presses}회 | 충돌 ${run.collisions}`);
  }
}
const delayed = simulate(ROUTE, 1 / 60, 0.08);
assert.ok(delayed.cleared, `늦은 제동: ${JSON.stringify(delayed)}`);
console.log(`PASS | 제동 반응 0.08초 지연 | ${delayed.elapsed.toFixed(2)}초 | 충돌 ${delayed.collisions}`);

const wall = { x: 200, y: 0, w: 20, h: 500 };
const ball = createBallState();
Object.assign(ball, { x: 186, y: 250, vx: 180, input: 'right' });
stepBall(ball, 0.025, [wall]);
assert.equal(ball.collisions, 1);
for (let i = 0; i < 240; i++) stepBall(ball, 1 / 120, [wall]);
assert.equal(ball.collisions, 1, 'Holding against a wall must not drain time repeatedly');
ball.input = null;
Object.assign(ball, { x: 150, vx: 190 });
for (let i = 0; i < 60; i++) { ball.input = 'right'; stepBall(ball, 1 / 120, [wall]); }
assert.equal(ball.collisions, 2, 'Leaving and hitting again must count');
const graze = createBallState();
Object.assign(graze, { x: 187.9, y: 100, vx: 35, vy: 180, input: 'down' });
stepBall(graze, 0.01, [wall]);
assert.equal(graze.collisions, 0, 'Tangential speed must not turn a light graze into a penalty');
const corner = createBallState();
Object.assign(corner, { x: 186, y: 186, vx: 140, vy: 140, presses: 3 });
stepBall(corner, 0.025, [wall, { x: 0, y: 200, w: 500, h: 20 }]);
assert.equal(corner.collisions, 1, 'Two walls in one impact count once');
const cooldown = createBallState();
Object.assign(cooldown, { x: 186, y: 250, vx: 180, impactCooldown: 0.3 });
stepBall(cooldown, 0.025, [wall]);
assert.equal(cooldown.collisions, 0);
console.log('PASS | hard impact, sustained contact, re-entry, graze, corner deduplication, cooldown');
