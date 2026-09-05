/* 화면 코드가 쓰는 짧은 UI 문구. 이야기와 대사는 scenario-data.js 한 곳에서 관리한다. */
const STRINGS = Object.freeze({
  cutscene: Object.freeze({
    ...SCENARIO_DATA.opening,
    logTitle: "LOG",
    logEmpty: "아직 지나간 대사가 없습니다.",
  }),
  protocol: Object.freeze({
    loading: "기억 불러오는 중",
    restored: "클리어",
    engineMissing: "기억 재생 장치가 아직 준비되지 않았습니다.",
    progress: (restored, memory, total) => `TESTIMONY ${restored} / ${total} · MEMORY ${memory} / ${total}`,
  }),
  archive: Object.freeze({
    rate: (percent) => `ARCHIVE RECOVERY ${percent}%`,
    detail: (cleared, fragments, total) => `전체 게임 클리어 ${cleared}/${total} · 최고 기록은 다음 판에도 유지`,
    ending: Object.freeze({
      complete: "ALL CLEAR · 9개 게임을 모두 클리어했습니다.",
      normal: "최고 기록에 다시 도전하세요.",
      incomplete: "아직 클리어하지 못한 게임이 있습니다.",
    }),
  }),
  result: Object.freeze({ failResult: "다시 하면 감이 올 거예요." }),
  buttons: Object.freeze({
    retryStage: "스테이지 재구성",
    continueStory: "계속",
    viewMemory: "기억 기록 보기",
    stageSelect: "기억 선택으로",
    mainMenu: "메인 화면으로",
  }),
});
