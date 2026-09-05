export function createMinigameRecords(ids, storage = null) {
  const key = 'archive-2026-minigame-bests-v1', bests = {};
  const limit = () => 20.26001;
  try {
    const saved = JSON.parse(storage?.getItem(key) || '{}');
    for (const id of ids) if (Number.isFinite(saved[id]?.elapsed) && saved[id].elapsed >= 0 && saved[id].elapsed <= limit(id) && Number.isInteger(saved[id].actions) && saved[id].actions >= 0) bests[id] = saved[id];
  } catch { /* 저장소가 차단되어도 플레이 가능 */ }
  return {
    best: id => bests[id] ? { ...bests[id] } : null,
    record(id, elapsed, actions) {
      if (!ids.includes(id) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > limit(id) || !Number.isInteger(actions) || actions < 0) throw new RangeError('Invalid clear record');
      const previous = bests[id];
      const isNew = !previous || elapsed < previous.elapsed - .00001 || Math.abs(elapsed - previous.elapsed) <= .00001 && actions < previous.actions;
      if (isNew) {
        bests[id] = { elapsed, actions };
        try { storage?.setItem(key, JSON.stringify(bests)); } catch { /* 세션 기록은 유지 */ }
      }
      return { isNew, best: { ...bests[id] } };
    },
  };
}
