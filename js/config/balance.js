/*
 * 기능(B) 전용 — 물리·타이밍 밸런스.
 * 이 값을 바꾸면 클리어 난이도가 변한다. 아트/사운드는 참조만 하고 수정하지 않는다.
 *
 * 옛 스테이지(음성 조작)의 이동 속도·점프력·피치 임계값은 게임을 새로 정하면서 걷어냈다.
 * 20.26초 제한만은 프로젝트 주제라 그대로 둔다.
 */

const BALANCE = Object.freeze({
  stage: Object.freeze({
    timeMs: 20260,
    warningMs: 5000, // 남은 시간이 이 아래로 내려가면 TIMER_WARNING 1회 발행
    resultDelayMs: 500,
  }),

  /*
   * Phaser Arcade의 기본 중력. 게임이 정해지면 여기에 이동 속도·점프력을 다시 채운다.
   * Matter가 필요한 게임이면 씬 단위로 물리 엔진을 바꾸고 이 값은 무시한다.
   */
  physics: Object.freeze({
    gravityY: 2325,
  }),
});
