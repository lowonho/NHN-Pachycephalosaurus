/* 기능(B) — 플레이 중 일시정지 버튼과 일시정지 화면을 관리한다. */

class PauseFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.active = false;
    this.paused = false;

    this.ui.pauseButton?.addEventListener("click", () => {
      if (this.active && !this.paused) this.events.emit(GAME_EVENTS.REQUEST_PAUSE, {});
    });
    this.ui.resumeButton?.addEventListener("click", () => {
      if (this.paused) this.events.emit(GAME_EVENTS.REQUEST_RESUME, {});
    });
    this.ui.pauseMainButton?.addEventListener("click", () => {
      if (this.paused) this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
    });

    this.events.on(GAME_EVENTS.STAGE_START, () => this.onStageStart());
    this.events.on(GAME_EVENTS.STAGE_PAUSE, () => this.onPaused());
    this.events.on(GAME_EVENTS.STAGE_RESUME, () => this.onResumed());
    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.onStageEnd());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.onStageEnd());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.onMainMenu());

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.active) return;
      this.events.emit(this.paused ? GAME_EVENTS.REQUEST_RESUME : GAME_EVENTS.REQUEST_PAUSE, {});
    });
  }

  onStageStart() {
    this.active = true;
    this.paused = false;
    this.ui.pauseButton.hidden = false;
    this.ui.pauseModal?.classList.add("hidden");
  }

  onPaused() {
    this.paused = true;
    this.ui.pauseButton.hidden = true;
    this.ui.pauseModal?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
    this.soundBus.pausePlayback();
    this.ui.resumeButton?.focus();
  }

  onResumed() {
    this.paused = false;
    this.ui.pauseModal?.classList.add("hidden");
    this.ui.appShell?.removeAttribute("inert");
    this.ui.pauseButton.hidden = false;
    this.soundBus.resumePlayback();
    this.ui.pauseButton?.focus();
  }

  onStageEnd() {
    this.active = false;
    this.paused = false;
    this.ui.pauseButton.hidden = true;
    this.ui.pauseModal?.classList.add("hidden");
  }

  onMainMenu() {
    this.onStageEnd();
    this.soundBus.stopPlayback();
  }
}

const pauseFlow = new PauseFlow(gameEvents, UI, audioBus);
