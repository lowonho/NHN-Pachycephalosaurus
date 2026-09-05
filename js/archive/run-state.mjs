export const TOTAL_TIME_MS = 143_000;

export function createArchiveRunState(stageIds, totalTimeMs = TOTAL_TIME_MS) {
  const validIds = new Set(stageIds);
  let totalRemainingMs = totalTimeMs;
  let phase = "menu";
  let paused = false;
  let currentStageId = null;
  let attemptFragment = false;
  const cleared = new Set();
  const collected = new Set();

  const assertStage = (stageId) => {
    if (!validIds.has(stageId)) throw new RangeError(`Unknown stage: ${stageId}`);
  };

  const resolveEnding = () => {
    if (totalRemainingMs <= 0) return "failure";
    if (cleared.size < validIds.size) return null;
    return collected.size === validIds.size ? "true" : "normal";
  };

  const snapshot = () => Object.freeze({
    totalTimeMs,
    totalRemainingMs: Math.max(0, Math.round(totalRemainingMs)),
    elapsedMs: Math.min(totalTimeMs, Math.round(totalTimeMs - totalRemainingMs)),
    phase,
    paused,
    currentStageId,
    attemptFragment,
    clearedCount: cleared.size,
    memoryCount: collected.size,
    totalStages: validIds.size,
    clearedStageIds: Object.freeze([...cleared]),
    memoryStageIds: Object.freeze([...collected]),
    ending: resolveEnding(),
  });

  const reset = () => {
    totalRemainingMs = totalTimeMs;
    phase = "menu";
    paused = false;
    currentStageId = null;
    attemptFragment = false;
    cleared.clear();
    collected.clear();
    return snapshot();
  };

  const beginAttempt = (stageId) => {
    assertStage(stageId);
    if (totalRemainingMs <= 0) return snapshot();
    currentStageId = stageId;
    attemptFragment = false;
    paused = false;
    phase = "playing";
    return snapshot();
  };

  const consume = (deltaMs) => {
    if (phase !== "playing" || paused || totalRemainingMs <= 0) return snapshot();
    const safeDelta = Math.max(0, Number(deltaMs) || 0);
    totalRemainingMs = Math.max(0, totalRemainingMs - safeDelta);
    if (totalRemainingMs === 0) {
      phase = "ended";
      paused = false;
    }
    return snapshot();
  };

  const markAttemptFragment = () => {
    if (phase === "playing") attemptFragment = true;
    return snapshot();
  };

  const completeAttempt = (success, fragmentCollected = attemptFragment) => {
    if (phase === "ended") return snapshot();
    if (currentStageId && success) {
      cleared.add(currentStageId);
      if (fragmentCollected) collected.add(currentStageId);
    }
    // 실패한 시도의 조각은 절대 collected에 들어가지 않는다.
    attemptFragment = false;
    paused = false;
    phase = resolveEnding() ? "ended" : "result";
    return snapshot();
  };

  const setPaused = (value) => {
    if (phase === "playing") paused = Boolean(value);
    return snapshot();
  };

  const leaveAttempt = () => {
    if (phase !== "ended") phase = "menu";
    paused = false;
    attemptFragment = false;
    currentStageId = null;
    return snapshot();
  };

  return Object.freeze({
    reset,
    beginAttempt,
    consume,
    markAttemptFragment,
    completeAttempt,
    setPaused,
    leaveAttempt,
    snapshot,
    resolveEnding,
  });
}
