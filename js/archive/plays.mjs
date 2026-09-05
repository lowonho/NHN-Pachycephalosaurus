/*
 * 미니게임 도감이 읽는 "한 번이라도 해 봤는가" 기록.
 *
 * progress.mjs(복구 등급)·records.mjs(최고 기록)와 성격이 다르다.
 * 그 둘은 클리어해야 남지만, 여기는 시작한 순간 남는다 —
 * 도감은 "클리어한 게임"이 아니라 "만나 본 게임"을 펼치는 화면이라서다.
 *
 * 저장소가 막혀 있어도(사생활 보호 모드 등) 플레이는 그대로 되어야 하므로
 * 실패는 전부 삼키고 세션 동안만 기억한다.
 */
export const PLAY_LOG_KEY = 'archive-2026-minigame-plays-v1';

export function createMinigamePlayLog(stageIds, storage = null) {
  const ids = [...new Set(stageIds)];
  const played = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(PLAY_LOG_KEY) || '[]');
    if (Array.isArray(saved)) for (const id of saved) if (ids.includes(id)) played.add(id);
  } catch { /* 저장이 깨져 있어도 도감은 열려야 한다 */ }

  const persist = () => {
    try { storage?.setItem(PLAY_LOG_KEY, JSON.stringify([...played])); } catch { /* 세션 기록은 유지 */ }
  };

  return {
    has: (id) => played.has(id),
    all: () => [...played],
    count: () => played.size,
    /* 이미 있는 id면 저장소를 다시 건드리지 않는다. 스테이지 시작마다 불리는 자리라서다. */
    record(id) {
      if (!ids.includes(id) || played.has(id)) return false;
      played.add(id);
      persist();
      return true;
    },
  };
}
