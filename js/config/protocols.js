/*
 * 프로토콜 목록 — 프로토콜 선택 화면(모니터)이 그리는 타일 7개.
 *
 * 왜 엔진 목록(js/archive/data.mjs의 STAGES)을 그대로 안 쓰는가.
 *   그쪽은 ES 모듈이라 Phaser 씬이 뜬 뒤에야 game.js를 거쳐 도착한다.
 *   엔진이 늦게 뜨거나(에셋 로딩) 아예 못 뜨면(index.html을 file://로 열면
 *   모듈이 CORS로 막힌다) 모니터가 "불러오는 중"인 채로 남는다.
 *   메뉴가 어떤 기록을 복구할 수 있는지는 엔진이 뜨기 전에도 알 수 있어야 한다.
 *
 * 그래서 타일에 필요한 세 가지(id · 번호 · 이름)만 여기 둔다.
 * 엔진이 뜨면 목표·이상·조작 문구까지 들어 있는 STAGES로 갈아 끼운다
 * (js/game.js → mainMenuFlow.setStages).
 *
 * id와 번호는 js/archive/data.mjs의 STAGES와 같아야 한다 — 타일을 누를 때
 * 넘기는 id가 곧 엔진이 여는 스테이지다.
 */

const PROTOCOLS = Object.freeze([
  Object.freeze({ id: "maze", number: "01", title: "가속 미로" }),
  Object.freeze({ id: "gravity", number: "02", title: "중력 타워" }),
  Object.freeze({ id: "bounce", number: "03", title: "탄성 우회" }),
  Object.freeze({ id: "recoil", number: "04", title: "반동 사격장" }),
  Object.freeze({ id: "friction", number: "05", title: "무마찰 배송" }),
  Object.freeze({ id: "darkness", number: "06", title: "소실 회랑" }),
  Object.freeze({ id: "rotation", number: "07", title: "각속도 잠금" }),
]);
