/*
 * QA 모드 상태 — 검수용 뒷문의 스위치 하나와 제한시간 하나.
 *
 * 여는 방법은 js/ui/qa-mode.js에 있다(메인 화면 "2026 ARCHIVE"를 빠르게 10번).
 * 값을 여기 전역에 두는 이유는 엔진과 UI가 같은 숫자를 봐야 해서다 —
 * 엔진(js/archive/game.mjs)은 file://에서도 도는 클래식 번들로 따로 빌드되므로
 * import로 나눠 쓸 수 없다.
 *
 * QA 모드 밖에서는 스테이지 기본값(20.26초)을 쓴다. 이 파일이 통째로 없거나
 * 로드에 실패해도 스테이지 기본 제한시간으로 돈다(archiveStageTimeLimit 참고).
 */
(function (global) {
  /* 프로젝트 주제인 20.26초. 별도 제한시간이 없는 스테이지의 기본값이다. */
  const DEFAULT_TIME_LIMIT = 20.26;

  /*
   * 조정 가능한 범위. 아래로는 스테이지가 시작하자마자 끝나지 않을 만큼,
   * 위로는 어려운 구간을 충분히 반복 검수할 수 있을 만큼만 열어 둔다.
   */
  const MIN_TIME_LIMIT = 1;
  const MAX_TIME_LIMIT = 120;

  global.ARCHIVE_QA = {
    DEFAULT_TIME_LIMIT,
    MIN_TIME_LIMIT,
    MAX_TIME_LIMIT,
    active: false,
    timeLimit: DEFAULT_TIME_LIMIT,
  };

  /* 스테이지 한 판의 제한시간(초). 엔진·HUD·기록이 모두 이 하나를 본다. */
  global.archiveStageTimeLimit = function archiveStageTimeLimit(stageDefault = DEFAULT_TIME_LIMIT) {
    const qa = global.ARCHIVE_QA;
    if (!qa || !qa.active || !Number.isFinite(qa.timeLimit)) return stageDefault;
    return Math.min(MAX_TIME_LIMIT, Math.max(MIN_TIME_LIMIT, qa.timeLimit));
  };
})(globalThis);
