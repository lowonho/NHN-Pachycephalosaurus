/*
 * 기능(B) — 헤더의 시스템 상태 표시.
 * 상태 문구는 content/strings.ko.js에서만 가져온다.
 */

class HudStatus {
  constructor(events, dom, strings) {
    this.dot = dom.statusDot;
    this.label = dom.statusLabel;
    this.strings = strings.status;

    events.on(GAME_EVENTS.MIC_CONNECTED, () => this.set(true, this.strings.measuring));
    events.on(GAME_EVENTS.MIC_CALIBRATED, ({ pitch }) =>
      this.set(true, this.strings.calibrated(Math.round(pitch))),
    );
    events.on(GAME_EVENTS.MIC_FAILED, ({ message }) => this.set(false, message));
    events.on(GAME_EVENTS.STAGE_CLEAR, ({ elapsed }) => this.set(true, this.strings.clear(elapsed)));
    events.on(GAME_EVENTS.STAGE_FAIL, () => this.set(false, this.strings.timeOver));
  }

  set(active, label) {
    this.dot?.classList.toggle("active", active);
    if (this.label && label) this.label.textContent = label;
  }
}

const hudStatus = new HudStatus(gameEvents, UI, STRINGS);
