/*
 * 화면에 출력되는 모든 한국어 문구.
 * JS가 주입하는 문자열만 여기에 둔다. index.html의 정적 마크업 문구는 HTML에 남긴다.
 *
 * 옛 스테이지의 음성 안내·명령어 문구는 게임을 새로 정하면서 걷어냈다.
 * 지금 남은 것은 컷신 대본과 결과 화면 문구뿐이다.
 */

const STRINGS = Object.freeze({
  /*
   * 컷신 — "게임 시작"을 누르면 스테이지 선택 앞에 한 번 나온다.
   *
   * script가 대본이다. 배열 순서대로 한 줄씩 출력하고, 마지막 줄을 넘기면
   * 스테이지 선택 화면으로 넘어간다(js/ui/cutscene-flow.js).
   * 줄을 늘리려면 여기에 { speaker, text } 항목만 더 넣으면 된다.
   * text 안의 \n은 패널에서 줄바꿈으로 그대로 나온다.
   *
   * 지금은 실제 대사가 정해지지 않아 테스트 한 줄만 들어 있다.
   */
  cutscene: Object.freeze({
    chapter: "CUTSCENE 01 // SYSTEM ALERT",
    logTitle: "LOG",
    logEmpty: "아직 지나간 대사가 없습니다.",
    script: Object.freeze([
      Object.freeze({ speaker: "아무개", text: "테스트입니다." }),
    ]),
  }),

  /*
   * 프로토콜 선택 — JS가 채우는 문구만 여기 있다.
   * 화면 표제·안내 문구·실패 안내처럼 마크업에 박힌 문구는 index.html에 남긴다.
   */
  protocol: Object.freeze({
    loading: "프로토콜 불러오는 중",
    restored: "복구 완료",
    progress: (restored, total) => `RESTORED ${restored} / ${total}`,
  }),

  result: Object.freeze({
    clearStep: "STAGE CLEAR",
    clearTitle: "20.26초 안에 성공! 🎉",
    clearCopy: (elapsed) => `${elapsed}초 만에 클리어! 다음에는 더 빠르게 가볼까요?`,
    clearResult: "CLEAR",

    failStep: "TIME OVER",
    failTitle: "아깝습니다!",
    failCopy: "20.26초가 끝났어요. 다시 도전해보세요.",
    failResult: "다시 하면 감이 올 거예요.",
  }),

  buttons: Object.freeze({
    retryStage: "다시 도전",
    /*
     * 결과 화면에서는 메인 화면이 아니라 프로토콜 선택으로 돌아간다.
     * 2:26 예산이 한 판 전체를 재고 있어서, 메인으로 나가면 그 판이 끝나기 때문이다.
     * 메인으로 나가는 길은 프로토콜 선택의 "뒤로"가 맡는다.
     */
    stageSelect: "프로토콜 선택으로",
    mainMenu: "메인 화면으로",
  }),
});
