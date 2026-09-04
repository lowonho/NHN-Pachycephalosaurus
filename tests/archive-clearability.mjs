import { GOAL, MAZE, MAZE_CELLS, PHYSICS, RECOMMENDED_INPUTS, ROUTE } from "../js/archive/level-data.mjs";
import { createBallState, registerDirection, stepBall } from "../js/archive/physics-core.mjs";

const dt = 1 / 120;
const OPPOSITE = { right: "left", left: "right", up: "down", down: "up" };

function passedWaypoint(state, waypoint) {
  if (waypoint.input === "right") return state.x >= waypoint.x;
  if (waypoint.input === "left") return state.x <= waypoint.x;
  if (waypoint.input === "up") return state.y <= waypoint.y;
  return state.y >= waypoint.y;
}

function reachedBrakePoint(state, direction, distance) {
  if (direction === "right") return state.x >= GOAL.x - distance;
  if (direction === "left") return state.x <= GOAL.x + distance;
  if (direction === "up") return state.y <= GOAL.y + distance;
  return state.y >= GOAL.y - distance;
}

function simulate({ reactionDelay = 0, brake = true, label }) {
  const state = createBallState();
  let time = 0;
  let routeIndex = 0;
  let delayRemaining = null;
  let braking = false;
  let brakeRemaining = 0;
  let goalHold = 0;
  let overruns = 0;
  let wasInsideGoal = false;
  registerDirection(state, ROUTE[0].input);

  while (time < PHYSICS.timeLimit && goalHold < PHYSICS.goalHoldSeconds) {
    stepBall(state, dt);
    time += dt;

    const waypoint = ROUTE[routeIndex];
    if (routeIndex < ROUTE.length - 1 && delayRemaining === null && passedWaypoint(state, waypoint)) {
      delayRemaining = reactionDelay;
    }
    if (delayRemaining !== null) {
      delayRemaining -= dt;
      if (delayRemaining <= 0) {
        routeIndex += 1;
        registerDirection(state, ROUTE[routeIndex].input);
        delayRemaining = null;
      }
    }

    const finalDirection = ROUTE[ROUTE.length - 1].input;
    if (
      brake &&
      routeIndex === ROUTE.length - 1 &&
      !braking &&
      reachedBrakePoint(state, finalDirection, 92)
    ) {
      braking = true;
      brakeRemaining = 0.26;
      registerDirection(state, OPPOSITE[finalDirection]);
    }
    if (braking && brakeRemaining > 0) {
      brakeRemaining -= dt;
      if (brakeRemaining <= 0) state.input = null;
    }

    const speed = Math.hypot(state.vx, state.vy);
    const insideGoal = Math.hypot(state.x - GOAL.x, state.y - GOAL.y) <= GOAL.radius;
    if (insideGoal && speed <= PHYSICS.goalMaxSpeed) goalHold += dt;
    else if (!insideGoal) goalHold = 0;
    else goalHold = Math.max(0, goalHold - dt * 2);

    if (wasInsideGoal && !insideGoal && goalHold < PHYSICS.goalHoldSeconds) overruns += 1;
    wasInsideGoal = insideGoal;
  }

  return {
    label,
    cleared: goalHold >= PHYSICS.goalHoldSeconds,
    elapsed: time,
    presses: state.presses,
    collisions: state.collisions,
    overruns,
  };
}

const clearRuns = [
  simulate({ label: "권장 경로 + 역방향 제동", reactionDelay: 0 }),
  simulate({ label: "회전마다 0.12초 지연 + 제동", reactionDelay: 0.12 }),
  simulate({ label: "회전마다 0.18초 지연 + 제동", reactionDelay: 0.18 }),
];
const speedRun = simulate({ label: "제동 없이 고속 진입", brake: false });

let deadEnds = 0;
let junctions = 0;
let edgeSum = 0;
for (const row of MAZE_CELLS) {
  for (const cell of row) {
    const passages = Object.values(cell.walls).filter((blocked) => !blocked).length;
    if (passages === 1) deadEnds += 1;
    if (passages >= 3) junctions += 1;
    edgeSum += passages;
  }
}
const cellCount = MAZE.columns * MAZE.rows;
const isPerfectMaze = edgeSum / 2 === cellCount - 1;

for (const run of clearRuns) {
  const mark = run.cleared ? "PASS" : "FAIL";
  console.log(`${mark} | ${run.label} | ${run.elapsed.toFixed(2)}초 | 입력 ${run.presses}회 | 고속 통과 ${run.overruns}회`);
}
console.log(`${speedRun.cleared ? "UNEXPECTED PASS" : "EXPECTED BLOCK"} | ${speedRun.label} | ${speedRun.elapsed.toFixed(2)}초`);
console.log(`INFO | 미로 해답 ${RECOMMENDED_INPUTS}회 + 제동 1회`);
console.log(`${isPerfectMaze ? "PASS" : "FAIL"} | 멀티커설 미로 구조 | 막다른 길 ${deadEnds}개 | 갈림길 ${junctions}개`);

if (clearRuns.some((run) => !run.cleared) || speedRun.cleared || !isPerfectMaze || deadEnds < 6 || junctions < 5) {
  process.exitCode = 1;
}

