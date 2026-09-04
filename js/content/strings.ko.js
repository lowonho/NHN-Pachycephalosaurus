/*
 * 화면에 출력되는 모든 한국어 문구.
 * JS가 주입하는 문자열만 여기에 둔다. index.html의 정적 마크업 문구는 HTML에 남긴다.
 *
 * 옛 스테이지의 음성 안내·명령어 문구는 게임을 새로 정하면서 걷어냈다.
 * 지금 남은 것은 결과 화면 문구뿐이다.
 */

const STRINGS = Object.freeze({
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
    mainMenu: "메인 화면으로",
  }),
});
