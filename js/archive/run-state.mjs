export const TOTAL_TIME_MS = 20_260;

export function sampleStages(ids, count = 5, random = Math.random) {
  const bag = [...new Set(ids)];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, count);
}

export function createArchiveRunState(stageIds, totalTimeMs = TOTAL_TIME_MS) {
  let selected = sampleStages(stageIds), phase = 'menu', currentStageId = null, paused = false;
  let remaining = totalTimeMs, elapsedMs = 0;
  const cleared = new Set();
  const resolveEnding = () => cleared.size === selected.length ? 'normal' : null;
  const snapshot = () => ({
    totalTimeMs, totalRemainingMs: Math.round(remaining), elapsedMs, phase, paused, currentStageId,
    selectedStageIds: [...selected], clearedStageIds: [...cleared], clearedCount: cleared.size,
    totalStages: selected.length, memoryCount: cleared.size, memoryStageIds: [...cleared],
    ending: resolveEnding(),
  });
  return {
    snapshot, resolveEnding,
    reset() { selected = sampleStages(stageIds); cleared.clear(); remaining = totalTimeMs; elapsedMs = 0; currentStageId = null; phase = 'menu'; paused = false; return snapshot(); },
    beginAttempt(id) {
      if (!selected.includes(id)) throw new RangeError(`Stage not selected in this run: ${id}`);
      currentStageId = id; remaining = totalTimeMs; paused = false; phase = 'playing'; return snapshot();
    },
    consume(ms) {
      if (phase === 'playing' && !paused) { const delta = Math.min(remaining, Math.max(0, Number(ms) || 0)); remaining -= delta; elapsedMs += delta; }
      return snapshot();
    },
    completeAttempt(success) { if (phase === 'playing' && success && currentStageId) cleared.add(currentStageId); phase = 'result'; paused = false; return snapshot(); },
    leaveAttempt() { phase = 'menu'; currentStageId = null; paused = false; return snapshot(); },
    setPaused(value) { paused = Boolean(value); return snapshot(); },
  };
}
