/*
 * QA 모드 상태 — 검수용 뒷문의 스위치 하나, 제한시간 하나, 그림 세트 고르기 하나.
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

  /*
   * 겉으로는 한 스테이지지만 안에서 그림 세트가 갈리는 것들. 열쇠는 스테이지 id 이고,
   * 값의 id 는 엔진이 텍스처 이름 앞에 붙이는 딱지 그대로다(e1_gravityDash.js 의 ART_SETS).
   *
   * 이 목록은 QA 패널만 본다. 도감·기록·막별 선정은 여전히 스테이지 10개만 세므로,
   * 플레이어에게는 세트가 갈려도 같은 한 판이다. 개발자만 세트를 골라 따로 연다.
   */
  const STAGE_ART_SETS = {
    e1: [
      { id: '', label: '기본' },
      { id: 'woni-', label: 'WONI' },
    ],
  };

  global.ARCHIVE_QA = {
    DEFAULT_TIME_LIMIT,
    MIN_TIME_LIMIT,
    MAX_TIME_LIMIT,
    STAGE_ART_SETS,
    active: false,
    timeLimit: DEFAULT_TIME_LIMIT,
    /* QA 패널이 세트를 골라 두는 곳. { 스테이지 id: 세트 id } 이고, 비어 있으면 무작위다. */
    artSet: {},
  };

  /* 스테이지 한 판의 제한시간(초). 엔진·HUD·기록이 모두 이 하나를 본다. */
  global.archiveStageTimeLimit = function archiveStageTimeLimit(stageDefault = DEFAULT_TIME_LIMIT) {
    const qa = global.ARCHIVE_QA;
    if (!qa || !qa.active || !Number.isFinite(qa.timeLimit)) return stageDefault;
    return Math.min(MAX_TIME_LIMIT, Math.max(MIN_TIME_LIMIT, qa.timeLimit));
  };

  /*
   * 이번 판에 쓸 그림 세트. QA 모드에서 골라 둔 세트가 있으면 그것을, 아니면 무작위다.
   * 고른 세트가 엔진이 아는 목록에 없으면(그림을 지웠거나 이름이 바뀌었으면) 무작위로 돌아간다 —
   * QA 설정 때문에 판이 그림 없이 도는 일은 없어야 한다.
   */
  global.archiveStageArtSet = function archiveStageArtSet(stageId, sets = ['']) {
    const list = Array.isArray(sets) && sets.length ? sets : [''];
    const qa = global.ARCHIVE_QA;
    const chosen = qa && qa.active ? qa.artSet?.[stageId] : null;
    if (chosen != null && list.includes(chosen)) return chosen;
    return list[Math.floor(Math.random() * list.length)];
  };
})(globalThis);
