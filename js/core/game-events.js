/*
 * 이벤트 계약 — 기능(B) · 비주얼(A) · 이미지(C1) · 사운드(C2) 트랙의 경계.
 *
 * 규칙
 * 1. 기능 코드는 gameEvents.emit()만 호출한다. 연출·사운드를 직접 호출하지 않는다.
 * 2. 아트/사운드 코드는 gameEvents.on()으로 구독만 한다. 물리 값을 바꾸지 않는다.
 * 3. 이 파일의 이벤트 이름과 payload 형태는 전원 합의 없이 변경하지 않는다(동결).
 *
 * 조작 방식과 게임 내용을 다시 정하는 중이라, 지금은 어느 게임에나 필요한
 * 뼈대 이벤트(수명주기 · 스테이지 흐름 · 타이머 · 사운드)만 남아 있다.
 * 입력 이벤트(옛 COMMAND_* / PLAYER_*)는 조작이 정해질 때 여기에 다시 추가한다.
 */

const GAME_EVENTS = Object.freeze({
  // 씬 수명주기
  SCENE_CREATE: "scene:create", // { scene } — 뷰가 표시 객체를 만드는 시점
  SCENE_SHUTDOWN: "scene:shutdown", // { scene }

  // 스테이지 흐름
  STAGE_START: "stage:start", // { stageId? }
  STAGE_PAUSE: "stage:pause", // {}
  STAGE_RESUME: "stage:resume", // {}
  STAGE_CLEAR: "stage:clear", // { elapsed, stageId? }
  STAGE_FAIL: "stage:fail", // { stageId? }
  /* 제한시간 안에서 죽고 다시 소환될 때. 스테이지는 끝나지 않는다. */
  STAGE_RESPAWN: "stage:respawn", // { stageId? }

  // 외부 요청(UI → 씬)
  REQUEST_START: "request:start", // { stageId }
  REQUEST_RESTART: "request:restart", // {}
  REQUEST_CONTINUE: "request:continue", // 성공 기록 등록 후 다음 스토리 슬롯으로
  REQUEST_PAUSE: "request:pause", // {}
  REQUEST_RESUME: "request:resume", // {}
  /* QA 모드가 현재 미니게임을 접고 검수 목록으로 돌아갈 때 사용한다. */
  REQUEST_STAGE_SELECT: "request:stage-select", // {}
  REQUEST_MAIN_MENU: "request:main-menu", // {}

  // 타이머
  TIMER_TICK: "timer:tick", // { remainingMs } — 매 프레임, payload 재사용됨
  TIMER_WARNING: "timer:warning", // {} — 임계 진입 시 1회만
  TOTAL_TIMER_TICK: "timer:total", // 호환 이름: 현재 스테이지·막·기억·기록 스냅샷
  RUN_RESET: "run:reset", // 새 3막 진행 상태 초기화
  RUN_END: "run:end", // { ending: "shared" }

  // 사운드
  AUDIO_VOLUME_CHANGED: "audio:volume-changed", // { master, bgm, sfx, muted }
});

class GameEventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const listeners = this.handlers.get(event);
    if (!listeners) return;
    // 구독자 한 명이 던진 예외가 나머지 트랙을 멈추지 않게 격리한다.
    listeners.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[gameEvents] "${event}" 구독자 오류`, error);
      }
    });
  }

  clear() {
    this.handlers.clear();
  }
}

const gameEvents = new GameEventBus();
