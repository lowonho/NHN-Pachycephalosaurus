/* 기록실의 밈 기록. 아이콘은 관련 미니게임에서 직접 가져오므로 여기서 중복 관리하지 않습니다. */
(function (global) {
  const records = [
    ["geoje-yaho", "거제 야호", ["e1"]],
    ["mecha-chameleon", "메챠 카멜레온", ["e3"]],
    ["bamti-tiger", "밤티 호랑이", ["e4"]],
    ["milano-winter-olympics", "밀라노 동계 올림픽", ["e10"]],
    ["spider-man", "스파이더맨", ["e8"]],
    ["dujjonku", "두쫀쿠", ["e5"]],
    ["wakbbuball", "왁뿌볼", ["e2"]],
    ["world-cup", "월드컵", ["e7"]],
    ["spinning-cat", "회전 고양이", ["e6"]],
  ];

  global.MEME_RECORDS = Object.freeze(records.map(([id, title, stageIds], index) => Object.freeze({
    id,
    number: String(index + 1).padStart(2, "0"),
    title,
    stageIds: Object.freeze([...stageIds]),
  })));
})(globalThis);
