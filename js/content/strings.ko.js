/* 화면 코드가 쓰는 짧은 UI 문구. 이야기와 대사는 scenario-data.js 한 곳에서 관리한다. */
const STRINGS = Object.freeze({
  cutscene: Object.freeze({
    ...SCENARIO_DATA.opening,
    logTitle: "LOG",
    logEmpty: "아직 지나간 대사가 없습니다.",
  }),
  protocol: Object.freeze({
    loading: "기록 연결 중",
    restored: "등록 완료",
    engineMissing: "기록 접속 장치가 아직 준비되지 않았습니다.",
  }),
  result: Object.freeze({ failResult: "접속 경로를 다시 구성합니다." }),
  buttons: Object.freeze({
    retryStage: "재접속",
    continueStory: "계속",
    stageSelect: "기록 연결 화면으로",
    mainMenu: "메인 화면으로",
  }),
});
