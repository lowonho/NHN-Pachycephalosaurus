/*
 * 음성 명령어 단일 출처.
 * 인식 사전(words)과 화면 표기(label/hint)를 한곳에서 관리한다.
 * index.html의 명령어 카드는 art/command-deck-view.js가 이 사전으로 렌더링하므로
 * 문구를 HTML에 중복해서 적지 않는다.
 */

const COMMAND_DICT = Object.freeze([
  Object.freeze({
    command: "LEFT",
    label: "오이데",
    hint: "← 왼쪽",
    bubble: "오이데!",
    className: "command-left",
    words: Object.freeze(["오이데", "오이대", "오이대요", "오이돼"]),
  }),
  Object.freeze({
    command: "JUMP",
    label: "야호!",
    hint: "↑ 점프 · 높게 말할수록 높이",
    bubble: "야호!",
    className: "command-jump",
    words: Object.freeze(["야호", "야오", "야호오"]),
  }),
  Object.freeze({
    command: "STOP",
    label: "마떼루요",
    hint: "■ 정지",
    bubble: "마떼루요!",
    className: "command-stop",
    words: Object.freeze(["마떼루요", "마테루요", "맛대로요", "마때루요", "기다려요"]),
  }),
  Object.freeze({
    command: "RIGHT",
    label: "파라파라",
    hint: "→ 오른쪽",
    bubble: "파라파라!",
    className: "command-right",
    words: Object.freeze(["파라파라", "파라파라요", "팔아팔아", "바라바라"]),
  }),
]);

// command 키로 빠르게 찾기 위한 색인.
const COMMAND_BY_KEY = Object.freeze(
  COMMAND_DICT.reduce((map, entry) => {
    map[entry.command] = entry;
    return map;
  }, {}),
);
