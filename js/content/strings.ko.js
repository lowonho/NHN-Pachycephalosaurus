/* 화면 코드가 쓰는 짧은 UI 문구. 이야기와 대사는 scenario-data.js 한 곳에서 관리한다. */
const STRINGS = Object.freeze({
  cutscene: Object.freeze({
    ...SCENARIO_DATA.opening,
    logTitle: "LOG",
    logEmpty: "아직 지나간 대사가 없습니다.",
  }),
  protocol: Object.freeze({
    loading: "기억 불러오는 중",
    restored: "증언 완료",
    engineMissing: "기억 재생 장치가 아직 준비되지 않았습니다.",
    progress: (restored, memory, total) => `TESTIMONY ${restored} / ${total} · MEMORY ${memory} / ${total}`,
  }),
  archive: Object.freeze({
    rate: (percent) => `ARCHIVE RECOVERY ${percent}%`,
    detail: (cleared, fragments, total) => `확인한 기록 ${cleared}/${total} · 보관된 기억 ${fragments}/${total}`,
    ending: Object.freeze({
      complete: "MULTIPLE WITNESSES · 모든 기억을 다시 볼 수 있습니다.",
      normal: "PERSONAL RECORD · 아직 확인하지 못한 기억이 있습니다.",
      incomplete: "RECOVERY INCOMPLETE · SOME MEMORIES WERE LOST",
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
