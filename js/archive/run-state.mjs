export const STAGE_TIME_MS = 20_260;
export const TOTAL_TIME_MS = STAGE_TIME_MS; // 이전 호출부와 QA 도구 호환용 이름
export const ACT_COUNT = 3;
export const STAGES_PER_ACT = 6;
export const LIVES_PER_ACT = 3;
export const STORY_RECORD_COUNT = ACT_COUNT * STAGES_PER_ACT;
export const RUN_STORAGE_KEY = 'archive-2026-story-run-v3';

export function sampleStages(ids, count = STAGES_PER_ACT, random = Math.random) {
  const bag = [...new Set(ids)];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, Math.min(count, bag.length));
}

function makeGrid(value = false) {
  return Array.from({ length: ACT_COUNT }, () => Array(STAGES_PER_ACT).fill(value));
}

export function createArchiveRunState(stageIds, options = {}) {
  const ids = [...new Set(stageIds)];
  const config = typeof options === 'number' ? { stageTimeMs: options } : options;
  const storage = config.storage ?? null;
  const random = config.random ?? Math.random;
  let stageTimeMs = Math.max(1, Math.round(config.stageTimeMs ?? STAGE_TIME_MS));

  const blank = () => ({
    version: 3,
    active: false,
    finished: false,
    archiveViewerUnlocked: false,
    archiveEntries: [],
    currentAct: 1,
    currentStageInAct: 1,
    currentStageId: null,
    selectedGames: [[], [], []],
    selectionSeeds: [null, null, null],
    lives: LIVES_PER_ACT,
    actAttemptCount: [1, 1, 1],
    assistProtocolAct1: false,
    stageRecords: makeGrid(false),
    cutscenesSeen: {},
    phase: 'menu',
    paused: false,
    elapsedMs: 0,
    remainingMs: stageTimeMs,
    transition: null,
    qaMode: false,
  });

  let state = blank();
  let qaBackup = null;

  const validSelection = (selection) => Array.isArray(selection)
    && selection.every((id) => ids.includes(id))
    && new Set(selection).size === selection.length;

  try {
    const saved = JSON.parse(storage?.getItem(RUN_STORAGE_KEY) || 'null');
    if (saved?.version === 3 && Array.isArray(saved.selectedGames)
      && saved.selectedGames.length === ACT_COUNT
      && saved.selectedGames.every(validSelection)) {
      state = {
        ...blank(),
        ...saved,
        archiveEntries: Array.isArray(saved.archiveEntries) ? saved.archiveEntries.map((entry) => ({ ...entry })) : [],
        selectedGames: saved.selectedGames.map((selection) => [...selection]),
        selectionSeeds: [...saved.selectionSeeds],
        actAttemptCount: [...saved.actAttemptCount],
        stageRecords: saved.stageRecords.map((row) => row.map(Boolean)),
        cutscenesSeen: { ...saved.cutscenesSeen },
        phase: saved.phase === 'playing' ? 'menu' : saved.phase,
        paused: false,
        currentStageId: null,
        elapsedMs: 0,
        remainingMs: stageTimeMs,
        qaMode: false,
      };
    }
  } catch { /* 손상되거나 사용할 수 없는 저장소는 새 상태로 대체한다. */ }

  const persist = () => {
    try { storage?.setItem(RUN_STORAGE_KEY, JSON.stringify(state)); } catch { /* 세션 진행은 유지 */ }
  };

  const currentSelection = () => state.selectedGames[state.currentAct - 1] ?? [];
  const expectedStageId = () => currentSelection()[state.currentStageInAct - 1] ?? null;
  const recordCount = () => state.stageRecords.flat().filter(Boolean).length;
  const actRecordCount = () => state.stageRecords[state.currentAct - 1]?.filter(Boolean).length ?? 0;
  const suppressionMultiplier = () => {
    const base = [0.85, 1, 1.35][state.currentAct - 1] ?? 1;
    return state.currentAct === 1 && state.assistProtocolAct1 ? base * .8 : base;
  };

  const stageConfigSeed = () => {
    const stageId = state.currentStageId || expectedStageId() || '';
    let hash = 2166136261;
    for (const character of stageId) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const actSeed = Number(state.selectionSeeds[state.currentAct - 1]) >>> 0;
    return (actSeed ^ Math.imul(state.currentStageInAct, 0x9e3779b1) ^ hash) >>> 0;
  };

  const selectAct = (actIndex) => {
    state.selectionSeeds[actIndex] = Math.floor(random() * 0x7fffffff);
    state.selectedGames[actIndex] = sampleStages(ids, STAGES_PER_ACT, random);
  };

  const snapshot = () => {
    const selected = currentSelection();
    const currentActRecords = state.stageRecords[state.currentAct - 1] ?? [];
    const selectedCleared = selected.filter((_, index) => currentActRecords[index]);
    const totalRecordCount = recordCount();
    return {
      active: state.active,
      hasSave: state.active && !state.finished,
      finished: state.finished,
      archiveViewerUnlocked: state.archiveViewerUnlocked,
      archiveEntries: state.archiveEntries.map((entry) => ({ ...entry })),
      currentAct: state.currentAct,
      currentStageInAct: state.currentStageInAct,
      currentStageId: state.currentStageId || expectedStageId(),
      expectedStageId: expectedStageId(),
      selectedGames: state.selectedGames.map((selection) => [...selection]),
      selectedStageIds: [...selected],
      selectionSeeds: [...state.selectionSeeds],
      stageConfigSeed: stageConfigSeed(),
      lives: state.lives,
      actAttemptCount: [...state.actAttemptCount],
      assistProtocolAct1: state.assistProtocolAct1,
      suppressionMultiplier: suppressionMultiplier(),
      ariaPhase: ['GUIDE', 'REVEALED', 'HOSTILE'][state.currentAct - 1],
      stageRecords: state.stageRecords.map((row) => [...row]),
      registeredRecordIds: state.stageRecords.flatMap((row, actIndex) => row.flatMap((registered, slotIndex) => (
        registered ? [`A${actIndex + 1}-${String(slotIndex + 1).padStart(2, '0')}`] : []
      ))),
      actRecordCount: actRecordCount(),
      totalRecordCount,
      clearedStageIds: selectedCleared,
      clearedCount: actRecordCount(),
      totalStages: selected.length || STAGES_PER_ACT,
      memoryCount: totalRecordCount,
      memoryStageIds: [],
      stageTimeMs,
      totalTimeMs: stageTimeMs,
      stageRemainingMs: Math.round(state.remainingMs),
      totalRemainingMs: Math.round(state.remainingMs),
      elapsedMs: state.elapsedMs,
      phase: state.phase,
      paused: state.paused,
      transition: state.transition,
      ending: state.finished ? 'shared' : null,
      qaMode: state.qaMode,
    };
  };

  const startNew = () => {
    const viewerUnlocked = state.archiveViewerUnlocked;
    const archiveEntries = state.archiveEntries.map((entry) => ({ ...entry }));
    state = blank();
    state.archiveViewerUnlocked = viewerUnlocked;
    state.archiveEntries = archiveEntries;
    state.active = true;
    selectAct(0);
    persist();
    return snapshot();
  };

  return {
    snapshot,
    resolveEnding: () => state.finished ? 'shared' : null,
    hasSave: () => state.active && !state.finished,
    startNew,
    reset: startNew,
    setSelection(selection) {
      const next = [...new Set(selection)].filter((id) => ids.includes(id));
      if (next.length === 0) throw new RangeError('Empty stage selection');
      if (!state.qaMode) qaBackup = JSON.parse(JSON.stringify(state));
      state.active = true;
      state.qaMode = true;
      state.currentAct = 1;
      state.currentStageInAct = 1;
      state.selectedGames[0] = next;
      state.currentStageId = null;
      state.stageRecords[0] = Array(STAGES_PER_ACT).fill(false);
      state.phase = 'menu';
      state.transition = null;
      return snapshot();
    },
    exitQa() {
      if (qaBackup) state = qaBackup;
      qaBackup = null;
      state.qaMode = false;
      state.paused = false;
      state.phase = 'menu';
      state.currentStageId = null;
      persist();
      return snapshot();
    },
    setAttemptTime(ms) {
      const value = Number(ms);
      if (!Number.isFinite(value) || value <= 0) throw new RangeError('Invalid attempt time');
      stageTimeMs = Math.round(value);
      if (state.phase !== 'playing') state.remainingMs = stageTimeMs;
      return snapshot();
    },
    beginAttempt(id) {
      const selected = currentSelection();
      if (!selected.includes(id)) throw new RangeError(`Stage not selected in this act: ${id}`);
      if (!state.qaMode && id !== expectedStageId()) throw new RangeError(`Expected story stage: ${expectedStageId()}`);
      state.currentStageId = id;
      state.remainingMs = stageTimeMs;
      state.elapsedMs = 0;
      state.paused = false;
      state.phase = 'playing';
      persist();
      return snapshot();
    },
    consume(ms) {
      if (state.phase === 'playing' && !state.paused) {
        const delta = Math.min(state.remainingMs, Math.max(0, Number(ms) || 0));
        state.remainingMs -= delta;
        state.elapsedMs += delta;
      }
      return snapshot();
    },
    // 미로의 벽 충돌 시간 차감도 스토리 HUD와 책상 시계에 동일하게 반영합니다.
    syncRemaining(ms) {
      if (Number.isFinite(ms)) state.remainingMs = Math.max(0, Math.min(stageTimeMs, ms));
      return snapshot();
    },
    completeAttempt(success) {
      if (state.phase !== 'playing') return snapshot();
      state.phase = 'result';
      state.paused = false;
      if (state.qaMode) {
        state.transition = success ? 'qa-clear' : 'qa-retry';
        persist();
        return snapshot();
      }

      if (success) {
        state.stageRecords[state.currentAct - 1][state.currentStageInAct - 1] = true;
        state.transition = state.currentAct === ACT_COUNT && state.currentStageInAct === STAGES_PER_ACT
          ? 'ending'
          : state.currentStageInAct === STAGES_PER_ACT ? 'next-act' : 'next-stage';
      } else {
        state.lives -= 1;
        if (state.lives > 0) {
          state.transition = 'retry';
        } else {
          const actIndex = state.currentAct - 1;
          state.actAttemptCount[actIndex] += 1;
          state.stageRecords[actIndex] = Array(STAGES_PER_ACT).fill(false);
          state.currentStageInAct = 1;
          state.currentStageId = null;
          state.lives = LIVES_PER_ACT;
          selectAct(actIndex);
          if (state.currentAct === 1 && state.actAttemptCount[0] >= 4) state.assistProtocolAct1 = true;
          state.transition = 'act-restarted';
        }
      }
      persist();
      return snapshot();
    },
    advance() {
      const transition = state.transition;
      if (transition === 'next-stage') state.currentStageInAct += 1;
      else if (transition === 'next-act') {
        state.currentAct += 1;
        state.currentStageInAct = 1;
        state.lives = LIVES_PER_ACT;
        if (!state.selectedGames[state.currentAct - 1].length) selectAct(state.currentAct - 1);
      } else if (transition === 'ending') {
        state.archiveEntries = state.selectedGames.flatMap((selection, actIndex) => selection.map((gameId, slotIndex) => ({
          recordId: `A${actIndex + 1}-${String(slotIndex + 1).padStart(2, '0')}`,
          gameId,
        })));
        state.finished = true;
        state.active = false;
        state.archiveViewerUnlocked = true;
      }
      state.currentStageId = null;
      state.remainingMs = stageTimeMs;
      state.elapsedMs = 0;
      state.paused = false;
      state.phase = 'menu';
      state.transition = null;
      persist();
      return { transition, snapshot: snapshot() };
    },
    leaveAttempt() {
      state.currentStageId = null;
      state.paused = false;
      if (state.phase === 'playing') state.phase = 'menu';
      persist();
      return snapshot();
    },
    setPaused(value) {
      state.paused = Boolean(value);
      persist();
      return snapshot();
    },
    markCutsceneSeen(id) {
      if (id) state.cutscenesSeen[id] = true;
      persist();
      return snapshot();
    },
    hasSeenCutscene: (id) => Boolean(state.cutscenesSeen[id]),
  };
}
