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
  // 스테이지 기본값과 QA 설정을 반영한 한 시도의 시간 예산.
  let budgetMs = totalTimeMs;
  let remaining = budgetMs, elapsedMs = 0;
  const cleared = new Set();
  const resolveEnding = () => cleared.size === selected.length ? 'normal' : null;
  const snapshot = () => ({
    totalTimeMs: budgetMs, totalRemainingMs: Math.round(remaining), elapsedMs, phase, paused, currentStageId,
    selectedStageIds: [...selected], clearedStageIds: [...cleared], clearedCount: cleared.size,
    totalStages: selected.length, memoryCount: cleared.size, memoryStageIds: [...cleared],
    ending: resolveEnding(),
  });
  return {
    snapshot, resolveEnding,
    reset() { selected = sampleStages(stageIds); cleared.clear(); remaining = budgetMs; elapsedMs = 0; currentStageId = null; phase = 'menu'; paused = false; return snapshot(); },
    /*
     * QA 모드 전용 — 랜덤 5개 대신 지정한 목록을 이번 판의 선택으로 쓴다.
     * (게임 브리지는 selectedStageIds에 없는 스테이지를 열어 주지 않는다.)
     */
    setSelection(ids) {
      const next = [...new Set(ids)].filter(id => stageIds.includes(id));
      if (next.length === 0) throw new RangeError('Empty stage selection');
      selected = next;
      for (const id of [...cleared]) if (!selected.includes(id)) cleared.delete(id);
      return snapshot();
    },
    /* 한 시도의 예산(책상 시계)을 스테이지 제한시간에 맞춘다. */
    setAttemptTime(ms) {
      const value = Number(ms);
      if (!Number.isFinite(value) || value <= 0) throw new RangeError('Invalid attempt time');
      budgetMs = Math.round(value);
      if (phase !== 'playing') remaining = budgetMs;
      return snapshot();
    },
    beginAttempt(id) {
      if (!selected.includes(id)) throw new RangeError(`Stage not selected in this run: ${id}`);
      currentStageId = id; remaining = budgetMs; paused = false; phase = 'playing'; return snapshot();
    },
    consume(ms) {
      if (phase === 'playing' && !paused) { const delta = Math.min(remaining, Math.max(0, Number(ms) || 0)); remaining -= delta; elapsedMs += delta; }
      return snapshot();
    },
    syncRemaining(ms) {
      if (Number.isFinite(ms)) remaining = Math.max(0, Math.min(budgetMs, ms));
      return snapshot();
    },
    completeAttempt(success) { if (phase === 'playing' && success && currentStageId) cleared.add(currentStageId); phase = 'result'; paused = false; return snapshot(); },
    leaveAttempt() { phase = 'menu'; currentStageId = null; paused = false; return snapshot(); },
    setPaused(value) { paused = Boolean(value); return snapshot(); },
  };
}
