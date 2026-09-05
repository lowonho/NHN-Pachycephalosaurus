/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 컷신 → 프로토콜 선택 → 스테이지 → (결과) → 프로토콜 선택
 * 순서다.
 *
 * 설정 화면·컷신·프로토콜 선택은 각각 settings-flow · cutscene-flow ·
 * protocol-select-flow가 통째로 들고 있다. 여기서는 열라는 신호만 보내고,
 * 컷신이 끝났을 때 다음 화면(프로토콜 선택)만 정해 준다.
 *
 * 메인 화면으로 나가는 것은 곧 판을 접는 것이다 — 프로토콜 선택이 재는
 * 선택된 랜덤 5개와 이번 판의 클리어 현황을 초기화한다(protocolSelect.reset()).
 * 게임별 최고 기록은 다음 판에도 남는다.
 */

class MainMenuFlow {
  constructor(events, dom, soundBus, settings, cutscene, protocolSelect, codex) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.settings = settings;
    this.cutscene = cutscene;
    this.protocolSelect = protocolSelect;
    this.codex = codex;

    // 메인 화면으로 나갈지 되묻는 창이 떠 있는지.
    this.leaveAsked = false;

    this.ui.mainPlayButton?.addEventListener("click", () => this.playIntro());
    this.ui.mainCodexButton?.addEventListener("click", () => this.codex.toggle());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());

    /*
     * "◀ 메인메뉴로" — 바로 나가지 않는다. 판부터 멈추고 한 번 되묻는다.
     * 나가면 이번 판이 통째로 접히므로(reset) 잘못 누르면 되돌릴 길이 없다.
     */
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.askLeaveToMain());
    this.ui.leaveConfirmButton?.addEventListener("click", () => this.confirmLeaveToMain());
    this.ui.leaveCancelButton?.addEventListener("click", () => this.cancelLeaveToMain());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.leaveAsked) this.cancelLeaveToMain();
    });

    /*
     * 오른쪽 위 ON/OFF — 마스터 뮤트 하나를 설정 화면과 나눠 쓴다.
     * aria-pressed는 "눌러서 꺼 둔 상태"라 muted와 같은 뜻이다.
     */
    this.ui.mainSoundButton?.addEventListener("click", () => {
      this.soundBus.resume();
      this.soundBus.setMuted(!this.soundBus.muted);
      this.syncSound();
    });
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncSound());
    this.syncSound();

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());

    // 스테이지가 실제로 열릴 때 메인 화면을 비운다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());

    // 결과 화면에서 "프로토콜 선택으로" — 판은 이어 가고 화면만 되돌린다.
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.protocolSelect.open());

    this.open();
  }

  open() {
    // 컷신 도중에 메인 화면으로 돌아오는 경로가 생기면 컷신부터 걷어낸다.
    this.cutscene.close();
    // 도감은 메인 화면 위에만 뜬다 — 돌아올 때 열려 있으면 걷어낸다.
    this.codex.close({ restoreFocus: false });
    this.protocolSelect.close();
    this.protocolSelect.reset();
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  syncSound() {
    this.ui.mainSoundButton?.setAttribute("aria-pressed", String(this.soundBus.muted));
  }

  /*
   * 게임 시작 → 컷신 → 프로토콜 선택.
   * 컷신을 끝까지 봤든 SKIP했든 onDone 하나로 돌아오므로 다음 화면은 여기서만 정한다.
   * 컷신이 없는 화면(메인 화면 뒤)은 그동안 만질 수 없게 inert로 잠가 둔다.
   */
  playIntro() {
    this.soundBus.resume();
    this.protocolSelect.reset();
    this.ui.mainMenu?.setAttribute("inert", "");
    this.cutscene.play({
      auto: true,
      onDone: () => {
        this.protocolSelect.open();
      },
    });
  }

  /*
   * 프로토콜 선택의 "◀ 메인메뉴로" — 누르는 즉시 판을 멈추고 되묻는다.
   *
   * REQUEST_PAUSE는 진행 중인 판이 있을 때만 실제로 멈춘다(js/game.js의 pause).
   * 선택 화면에서는 멈출 것이 없어 아무 일도 일어나지 않으므로 그냥 보내도 안전하다.
   * 되묻는 동안 뒤의 프로토콜 선택 화면은 inert로 잠가 타일을 못 누르게 한다.
   */
  askLeaveToMain() {
    if (this.leaveAsked) return;
    this.leaveAsked = true;
    this.events.emit(GAME_EVENTS.REQUEST_PAUSE, {});
    this.ui.protocolDesktop?.setAttribute("inert", "");
    this.ui.leaveConfirmModal?.classList.remove("hidden");
    // 기본 손가락은 "계속하기"에 둔다 — 잘못 눌러 판이 날아가지 않게.
    this.ui.leaveCancelButton?.focus();
  }

  /* "계속하기" · Esc — 멈춘 판을 다시 돌리고 선택 화면으로 돌아간다. */
  cancelLeaveToMain() {
    if (!this.leaveAsked) return;
    this.leaveAsked = false;
    this.ui.leaveConfirmModal?.classList.add("hidden");
    this.ui.protocolDesktop?.removeAttribute("inert");
    this.events.emit(GAME_EVENTS.REQUEST_RESUME, {});
    this.ui.stageSelectBackButton?.focus();
  }

  /* "메인 화면으로" — 판을 접고 메인 화면으로 돌아온다. */
  confirmLeaveToMain() {
    if (!this.leaveAsked) return;
    this.leaveAsked = false;
    this.ui.leaveConfirmModal?.classList.add("hidden");
    this.ui.protocolDesktop?.removeAttribute("inert");
    // open()이 컷신·프로토콜 선택을 걷어내고 판을 초기화한다.
    this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
    this.ui.mainPlayButton?.focus();
  }

  /* 스테이지 목록은 엔진이 준비되면 game.js가 넘겨 준다. 도감도 같은 목록을 쓴다. */
  setStages(stages) {
    this.protocolSelect.setStages(stages);
    this.codex.setStages(stages);
  }

  /*
   * 한 스테이지가 끝나 ARCHIVE 복구 기록이 갱신됐을 때 game.js가 부른다.
   * 그 기록을 그리는 것은 프로토콜 선택 화면이므로 그대로 넘긴다.
   */
  renderStages() {
    this.protocolSelect.render();
  }
}

const mainMenuFlow = new MainMenuFlow(
  gameEvents,
  UI,
  audioBus,
  settingsFlow,
  cutsceneFlow,
  protocolSelectFlow,
  codexFlow,
);
