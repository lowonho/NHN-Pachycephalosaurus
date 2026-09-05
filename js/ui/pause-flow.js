/*
 * 기능(B) — 일시정지 버튼과 일시정지 화면.
 *
 * 멈추는 자리가 두 곳이다. 창은 하나(#pause-modal)를 나눠 쓴다.
 *   플레이 중  스크린 안 HUD의 일시정지 버튼 · Esc → 엔진까지 멈춘다(REQUEST_PAUSE).
 *   브리핑 중  모니터 밖 PAUSE 버튼 · Esc → 멈출 게임이 없으므로 화면만 덮는다.
 *
 * 브리핑에는 되돌아갈 목록이 없다(js/ui/protocol-select-flow.js). 그래서 화면을
 * 물리는 Esc 대신 여기로 들어오고, "메인 화면으로"가 그 자리를 대신한다.
 */

class PauseFlow {
  constructor(events, dom, soundBus, settings) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.settings = settings;
    this.active = false;
    this.paused = false;
    // 브리핑 위에서 멈춘 상태. 엔진은 아직 시작조차 하지 않았다.
    this.menuPaused = false;

    this.ui.pauseButton?.addEventListener("click", () => {
      if (this.active && !this.paused) this.events.emit(GAME_EVENTS.REQUEST_PAUSE, {});
    });

    /* 모니터 밖 PAUSE — 브리핑에서만 서 있다(showScreen이 숨긴다). */
    this.ui.protocolPauseButton?.addEventListener("click", () => {
      if (this.active) {
        if (!this.paused) this.events.emit(GAME_EVENTS.REQUEST_PAUSE, {});
        return;
      }
      this.pauseMenu();
    });

    this.ui.resumeButton?.addEventListener("click", () => {
      if (this.paused) this.events.emit(GAME_EVENTS.REQUEST_RESUME, {});
      else this.resumeMenu();
    });
    /* 설정 — 메인 화면에서 뜨는 그 창이다. 닫으면 이 버튼으로 손가락이 돌아온다. */
    this.ui.pauseSettingsButton?.addEventListener("click", () => {
      if (!this.paused && !this.menuPaused) return;
      this.settings.open({ returnFocus: this.ui.pauseSettingsButton });
    });
    this.ui.pauseMainButton?.addEventListener("click", () => {
      if (this.paused || this.menuPaused) this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
    });

    this.events.on(GAME_EVENTS.STAGE_START, () => this.onStageStart());
    this.events.on(GAME_EVENTS.STAGE_PAUSE, () => this.onPaused());
    this.events.on(GAME_EVENTS.STAGE_RESUME, () => this.onResumed());
    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.onStageEnd());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.onStageEnd());
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.onMainMenu());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.onMainMenu());

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      /*
       * 브리핑의 Esc는 protocol-select-flow가 먼저 잡아 여기로 넘긴다(preventDefault).
       * 설정 창이 떠 있으면 Esc는 그 창을 닫는 키다 — 뒤의 판까지 건드리면 안 된다.
       */
      if (event.defaultPrevented || this.settings.isOpen()) return;
      if (this.menuPaused) {
        this.resumeMenu();
        return;
      }
      if (!this.active) return;
      this.events.emit(this.paused ? GAME_EVENTS.REQUEST_RESUME : GAME_EVENTS.REQUEST_PAUSE, {});
    });
  }

  /* ── 브리핑 위에서 멈추기 ────────────────────────────────────────── */

  pauseMenu() {
    if (this.paused || this.menuPaused) return;
    this.menuPaused = true;
    // 뒤의 브리핑은 보이되 만질 수 없어야 한다(탭 순서에서도 빠진다).
    this.ui.protocolBrief?.setAttribute("inert", "");
    if (this.ui.protocolPauseButton) this.ui.protocolPauseButton.hidden = true;
    if (this.ui.pauseCopy) this.ui.pauseCopy.textContent = "프로토콜 브리핑에서 멈춰 있습니다.";
    this.ui.pauseModal?.classList.remove("hidden");
    this.ui.resumeButton?.focus();
  }

  resumeMenu() {
    if (!this.menuPaused) return;
    this.menuPaused = false;
    this.ui.pauseModal?.classList.add("hidden");
    this.ui.protocolBrief?.removeAttribute("inert");
    if (this.ui.protocolPauseButton) this.ui.protocolPauseButton.hidden = false;
    this.ui.protocolBriefStartButton?.focus();
  }

  /* ── 플레이 중 멈추기 ────────────────────────────────────────────── */

  onStageStart() {
    this.active = true;
    this.paused = false;
    this.clearMenuPause();
    this.ui.pauseButton.hidden = false;
    this.ui.pauseModal?.classList.add("hidden");
  }

  onPaused() {
    this.paused = true;
    this.ui.pauseButton.hidden = true;
    if (this.ui.pauseCopy) this.ui.pauseCopy.textContent = "타이머와 게임 진행이 멈춰 있습니다.";
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
    this.clearMenuPause();
    this.ui.pauseButton.hidden = true;
    this.ui.pauseModal?.classList.add("hidden");
  }

  onMainMenu() {
    this.onStageEnd();
    this.soundBus.stopPlayback();
  }

  /* 멈춘 채로 화면이 바뀌어도 브리핑이 잠긴 채 남지 않게 한다. */
  clearMenuPause() {
    this.menuPaused = false;
    this.ui.protocolBrief?.removeAttribute("inert");
  }
}

const pauseFlow = new PauseFlow(gameEvents, UI, audioBus, settingsFlow);
