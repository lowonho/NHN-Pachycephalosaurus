/*
 * 이벤트 계약 — 기능(B) · 비주얼(A) · 이미지(C1) · 사운드(C2) 트랙의 경계.
 *
 * 규칙
 * 1. 기능 코드는 gameEvents.emit()만 호출한다. 연출·사운드를 직접 호출하지 않는다.
 * 2. 아트/사운드 코드는 gameEvents.on()으로 구독만 한다. 물리 값을 바꾸지 않는다.
 * 3. 이 파일의 이벤트 이름과 payload 형태는 전원 합의 없이 변경하지 않는다(동결).
 */

const GAME_EVENTS = Object.freeze({
  // 씬 수명주기
  SCENE_CREATE: "scene:create", // { scene } — 뷰가 표시 객체를 만드는 시점
  SCENE_SHUTDOWN: "scene:shutdown", // { scene }

  // 스테이지 흐름
  STAGE_START: "stage:start", // { voiceEnabled }
  STAGE_PAUSE: "stage:pause", // {}
  STAGE_RESUME: "stage:resume", // { voiceEnabled }
  STAGE_CLEAR: "stage:clear", // { elapsed }
  STAGE_FAIL: "stage:fail", // {}

  // 외부 요청(UI → 씬)
  REQUEST_START: "request:start", // { voiceEnabled }
  REQUEST_RESTART: "request:restart", // {}
  REQUEST_PAUSE: "request:pause", // {}
  REQUEST_RESUME: "request:resume", // {}
  REQUEST_MAIN_MENU: "request:main-menu", // {}

  // 타이머
  TIMER_TICK: "timer:tick", // { remainingMs } — 매 프레임, payload 재사용됨
  TIMER_WARNING: "timer:warning", // {} — 임계 진입 시 1회만

  // 명령
  COMMAND_RECOGNIZED: "command:recognized", // { command, level, source }
  COMMAND_REJECTED: "command:rejected", // { command, reason }

  // 플레이어
  PLAYER_SYNC: "player:sync", // { x, y, velocityX } — 매 프레임, payload 재사용됨
  PLAYER_JUMP: "player:jump", // { level, direction }
  PLAYER_LAND: "player:land", // {}
  PLAYER_HIT_OBSTACLE: "player:hit-obstacle", // { side }

  // 음성 입력
  VOICE_PITCH: "voice:pitch", // { hz, semitones, level } — 매 프레임, payload 재사용됨
  VOICE_TOO_QUIET: "voice:too-quiet", // {}
  MIC_CONNECTED: "mic:connected", // {}
  MIC_CALIBRATED: "mic:calibrated", // { pitch, samples }
  MIC_FAILED: "mic:failed", // { message }

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
