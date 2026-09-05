export const STOP_RULES = { radius: 18, exitRadius: 22, speed: 18, exitSpeed: 24, seconds: 0.75, grace: 0.12 };

// A low-speed cargo released inside the active bay settles even at minimum
// floor friction. This is braking only: no position snap or high-speed capture.
export function settleFrictionStop(state, stop, dt) {
  if (!stop || state.direction || Math.hypot(state.x - stop.x, state.y - stop.y) > STOP_RULES.radius || Math.hypot(state.vx, state.vy) > STOP_RULES.exitSpeed) return false;
  const brake = value => Math.sign(value) * Math.max(0, Math.abs(value) - 100 * dt);
  state.vx = brake(state.vx);
  state.vy = brake(state.vy);
  return true;
}

// Only time inside the target at low speed counts. Brief correction inputs
// preserve earned time; actually leaving the target cancels it.
export function advanceFrictionStop(state, distance, speed, dt) {
  if (distance <= STOP_RULES.radius && speed <= STOP_RULES.speed) {
    state.stopGrace = 0;
    state.stopHold = Math.min(STOP_RULES.seconds, state.stopHold + dt);
    return { complete: state.stopHold >= STOP_RULES.seconds - 1e-9, label: `${Math.floor(state.stopHold / STOP_RULES.seconds * 100)}%` };
  }
  const label = distance > STOP_RULES.radius ? 'CENTER' : 'BRAKE';
  if (distance > STOP_RULES.exitRadius || speed > STOP_RULES.exitSpeed) {
    state.stopHold = 0;
    state.stopGrace = 0;
  } else {
    const previousGrace = state.stopGrace || 0;
    state.stopGrace = previousGrace + dt;
    const decayTime = Math.max(0, state.stopGrace - STOP_RULES.grace) - Math.max(0, previousGrace - STOP_RULES.grace);
    state.stopHold = Math.max(0, state.stopHold - decayTime * 2);
  }
  return { complete: false, label };
}
