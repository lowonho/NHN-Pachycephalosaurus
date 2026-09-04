export const RECORD_STATUS = Object.freeze({
  DAMAGED: "DAMAGED", PARTIAL: "PARTIALLY RESTORED", FULL: "FULLY RESTORED", LOST: "RECORD LOST",
});
export const PROGRESS_KEY = "archive-2026-recovery-v1";
export const RECOVERY_RULES = Object.freeze({ partialWeight: 0.5, normalEndingRatio: 0.5 });

// Results belong to an attempt; stored records only ever improve.
export function createProgressStore(stageIds, storage = null) {
  const ids = [...new Set(stageIds)];
  const records = Object.fromEntries(ids.map((id) => [id, RECORD_STATUS.DAMAGED]));
  try {
    const saved = JSON.parse(storage?.getItem(PROGRESS_KEY) || "null");
    if (saved?.version === 1) for (const id of ids) {
      if ([RECORD_STATUS.PARTIAL, RECORD_STATUS.FULL].includes(saved.records?.[id])) records[id] = saved.records[id];
    }
  } catch { /* An unavailable or damaged save must not prevent play. */ }
  const summary = () => {
    const clearedCount = ids.filter((id) => records[id] !== RECORD_STATUS.DAMAGED).length;
    const fragmentCount = ids.filter((id) => records[id] === RECORD_STATUS.FULL).length;
    const recoveryRate = ids.length ? Math.round(100 * (fragmentCount + (clearedCount - fragmentCount) * RECOVERY_RULES.partialWeight) / ids.length) : 0;
    const allCleared = ids.length > 0 && clearedCount === ids.length;
    const ending = !allCleared ? null : fragmentCount === ids.length ? "complete"
      : fragmentCount / ids.length >= RECOVERY_RULES.normalEndingRatio ? "normal" : "incomplete";
    return { totalRecords: ids.length, clearedCount, fragmentCount, recoveryRate, allCleared, ending };
  };
  return {
    status: (id) => records[id] || RECORD_STATUS.DAMAGED,
    summary,
    record(id, success, fragmentCollected) {
      if (!ids.includes(id)) throw new Error(`Unknown record: ${id}`);
      const result = !success ? RECORD_STATUS.LOST : fragmentCollected ? RECORD_STATUS.FULL : RECORD_STATUS.PARTIAL;
      if (success && records[id] !== RECORD_STATUS.FULL) {
        records[id] = result;
        try { storage?.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, records })); } catch { /* Session state remains available. */ }
      }
      return { result, savedStatus: records[id], ...summary() };
    },
  };
}
