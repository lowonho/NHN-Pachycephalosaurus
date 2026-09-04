/*
 * 음성 명령어 단일 출처.
 * 인식 사전(words)과 화면 표기(label/hint)를 한곳에서 관리한다.
 * index.html의 명령어 카드는 art/command-deck-view.js가 이 사전으로 렌더링하므로
 * 문구를 HTML에 중복해서 적지 않는다.
 */

const COMMAND_DICT = Object.freeze([
  Object.freeze({
    command: "MOVE",
    label: "오이데",
    hint: "▶ 음량으로 출발 속도",
    bubble: "오이데!",
    className: "command-move",
    words: Object.freeze(["오이데", "오이대", "오이대요", "오이돼", "오이데요", "오이뎌"]),
    // ko-KR 인식이 "오이데"를 "오이대/오이돼"처럼 받아쓰는 경우까지 허용한다.
    // "이"는 필수로 남겨 "어디"처럼 흔한 단어와 겹치지 않게 한다.
    patterns: Object.freeze([/(?:오|어)이(?:데|대|돼|뎌)(?:요|용|여)?/]),
  }),
  Object.freeze({
    command: "JUMP",
    label: "야호!",
    hint: "↑ 점프 · 높게 말할수록 높이",
    bubble: "야호!",
    className: "command-jump",
    words: Object.freeze(["야호", "야오", "야호오", "야허", "여호"]),
    patterns: Object.freeze([/(?:야|여)(?:호|허)(?:오|우)?/]),
  }),
  Object.freeze({
    command: "STOP",
    label: "맛떼루용",
    hint: "■ 관성으로 감속",
    bubble: "맛떼루용!",
    className: "command-stop",
    words: Object.freeze([
      "맛떼루용",
      "마떼루용",
      "마테루용",
      "맛떼루요",
      "마떼루요",
      "마테루요",
      "마때루요",
      "기다려요",
    ]),
    // ko-KR 음성 인식이 일본어식 발음을 "멋대로용"처럼 받아쓰는 경우까지
    // 정지 명령 안에서만 허용한다. 다른 명령에는 이 느슨한 판정을 적용하지 않는다.
    patterns: Object.freeze([
      /(?:맛|마|멋|맏|매|메)(?:떼|때|테|대|데)(?:루|로)(?:용|요|욘)/,
      /(?:待ってるよん?|まってるよん?|マッテルヨン?)/,
    ]),
  }),
  Object.freeze({
    command: "REVERSE",
    label: "파라파라",
    hint: "↔ 진행 방향 변경",
    bubble: "파라파라!",
    className: "command-reverse",
    words: Object.freeze(["파라파라", "파라파라요", "팔아팔아", "바라바라", "빠라빠라"]),
    patterns: Object.freeze([/(?:파|바|빠)라(?:파|바|빠)라(?:요)?/]),
  }),
  Object.freeze({
    command: "GOAL",
    label: "오이쉬이",
    hint: "◎ 포토존에서 골인",
    bubble: "오이쉬이!",
    className: "command-goal",
    words: Object.freeze(["오이쉬이", "오이시이", "오이시", "오이쉬", "맛있어", "오이쉬여"]),
    // "오이쉬이"의 "쉬" 발음이 "시/쉐/셔"로 잘못 받아쓰기되는 경우까지 허용한다.
    // "이"는 필수로 남겨 "오시다"처럼 흔한 단어와 겹치지 않게 한다.
    patterns: Object.freeze([/(?:오|어)이(?:쉬|시|쉐|셔)이?/]),
  }),
]);

// command 키로 빠르게 찾기 위한 색인.
const COMMAND_BY_KEY = Object.freeze(
  COMMAND_DICT.reduce((map, entry) => {
    map[entry.command] = entry;
    return map;
  }, {}),
);
