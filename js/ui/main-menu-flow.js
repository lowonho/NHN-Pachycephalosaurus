/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 오프닝 → 막별 기록 연결 → 스테이지 → 결과 → 다음 기록
 * 순서다.
 *
 * 설정 화면·컷신·프로토콜 브리핑은 각각 settings-flow · cutscene-flow ·
 * protocol-select-flow가 통째로 들고 있다. 여기서는 열라는 신호만 보내고,
 * 컷신이 끝났을 때 다음 화면(브리핑)만 정해 준다.
 *
 * 메인으로 나가도 막·스테이지·남은 기억·선정 목록은 저장되며 이어하기로 복귀한다.
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

    this.ui.mainPlayButton?.addEventListener("click", () => this.requestPlayIntro());
    this.ui.newRunConfirmButton?.addEventListener("click", () => {
      this.closeNewRunConfirm();
      this.playIntro();
    });
    this.ui.newRunCancelButton?.addEventListener("click", () => this.closeNewRunConfirm());
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.isNewRunConfirmOpen()) {
        event.preventDefault();
        this.closeNewRunConfirm();
      }
    });
    this.ui.mainContinueButton?.addEventListener("click", () => this.continueRun());
    /* 기록실은 밈 기록과 미니게임 도감이 있어 언제나 열린다. */
    this.ui.mainCodexButton?.addEventListener("click", () => this.codex.toggle());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());

    /*
     * 판을 떠나는 길은 일시정지 창의 "메인 화면으로" 하나다(js/ui/pause-flow.js).
     * 되묻지 않는다 — 막·남은 기억·선정된 게임은 저장돼 이어하기로 그대로 돌아온다.
     */

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
    this.events.on(GAME_EVENTS.RUN_RESET, () => this.renderAvailability());
    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.renderAvailability());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.renderAvailability());

    // 스테이지가 실제로 열릴 때 메인 화면을 비운다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());

    // 결과 화면에서 브리핑으로 — 판은 이어 가고 화면만 되돌린다.
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.protocolSelect.open());

    this.open();
  }

  open() {
    // 컷신 도중에 메인 화면으로 돌아오는 경로가 생기면 컷신부터 걷어낸다.
    this.cutscene.close();
    // 도감은 메인 화면 위에만 뜬다 — 돌아올 때 열려 있으면 걷어낸다.
    this.codex.close({ restoreFocus: false });
    this.protocolSelect.close();
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
    this.renderAvailability();
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  syncSound() {
    this.ui.mainSoundButton?.setAttribute("aria-pressed", String(this.soundBus.muted));
  }

  /*
   * "기록 접속"을 눌렀을 때의 입구. 지우고 다시 시작할 진행 중인 기록이 있으면
   * (이어하기가 켜질 조건과 같다) 한 번 되묻고, 없으면 곧장 시작한다.
   */
  requestPlayIntro() {
    if (window.archiveRun?.hasSave()) { this.openNewRunConfirm(); return; }
    this.playIntro();
  }

  openNewRunConfirm() {
    this.newRunConfirmReturnFocus = document.activeElement;
    this.ui.newRunConfirmModal?.classList.remove("hidden");
    this.ui.newRunConfirmButton?.focus();
  }

  closeNewRunConfirm() {
    this.ui.newRunConfirmModal?.classList.add("hidden");
    if (this.newRunConfirmReturnFocus?.isConnected) this.newRunConfirmReturnFocus.focus();
    this.newRunConfirmReturnFocus = null;
  }

  isNewRunConfirmOpen() {
    return Boolean(this.ui.newRunConfirmModal && !this.ui.newRunConfirmModal.classList.contains("hidden"));
  }

  /*
   * 게임 시작 → 컷신 → 프로토콜 브리핑.
   * 컷신을 끝까지 봤든 SKIP했든 onDone 하나로 돌아오므로 다음 화면은 여기서만 정한다.
   * 컷신이 없는 화면(메인 화면 뒤)은 그동안 만질 수 없게 inert로 잠가 둔다.
   */
  playIntro() {
    this.soundBus.resume();
    this.protocolSelect.reset();
    this.ui.mainMenu?.setAttribute("inert", "");
    const opening = SCENARIO_DATA.cutscenes.opening;
    this.cutscene.play({
      chapter: opening.chapter,
      script: opening.script,
      auto: opening.auto,
      onDone: () => {
        window.archiveRun?.markCutsceneSeen(opening.id);
        // 컷신 종료 암전 안에서 다음 화면을 바꾼다. 이미 본 게임이라 브리핑을
        // 건너뛰어도 암전을 한 번 더 겹치지 않는다.
        this.protocolSelect.open({ transitionCovered: true });
      },
    });
  }

  continueRun() {
    if (!window.archiveRun?.hasSave()) return;
    this.soundBus.resume();
    this.close();
    // 컷신이 끼는 전환은 그쪽이 알아서 암전을 감싼다. 여기서는 곧장 브리핑으로 갈 때만 감싼다.
    if (window.archiveRun.snapshot().transition) this.protocolSelect.continueStory();
    else sceneFade.cut(() => this.protocolSelect.open({ transitionCovered: true }));
  }

  renderAvailability() {
    const run = window.archiveRun?.snapshot();
    if (this.ui.mainContinueButton) this.ui.mainContinueButton.disabled = !run?.hasSave;
    /*
     * 기록실 버튼은 잠그지 않는다 — 밈 기록과 미니게임 도감은 첫 판 전에도 볼 것이 있다.
     */
  }


  /* 스테이지 목록은 엔진이 준비되면 game.js가 넘겨 준다. 도감도 같은 목록을 쓴다. */
  setStages(stages) {
    this.protocolSelect.setStages(stages);
    this.codex.setStages(stages);
    this.renderAvailability();
  }

  /*
   * 한 스테이지가 끝나 ARCHIVE 복구 기록이 갱신됐을 때 game.js가 부른다.
   * 그 기록을 그리는 것은 브리핑 화면이므로 그대로 넘긴다.
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
