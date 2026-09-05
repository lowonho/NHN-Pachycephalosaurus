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
 * 2:26 예산과 복구 기록이 여기서 초기화된다(protocolSelect.reset()).
 */

class MainMenuFlow {
  constructor(events, dom, soundBus, settings, cutscene, protocolSelect) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.settings = settings;
    this.cutscene = cutscene;
    this.protocolSelect = protocolSelect;

    this.ui.mainPlayButton?.addEventListener("click", () => this.playIntro());
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());

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
    this.ui.mainMenu?.setAttribute("inert", "");
    this.cutscene.play({ onDone: () => this.protocolSelect.open() });
  }

  /* 프로토콜 선택의 "뒤로" — 판을 접고 메인 화면으로 돌아온다. */
  closeStageSelect() {
    this.protocolSelect.close();
    this.protocolSelect.reset();
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.mainPlayButton?.focus();
  }

  /* 스테이지 목록은 엔진이 준비되면 game.js가 넘겨 준다. */
  setStages(stages) {
    this.protocolSelect.setStages(stages);
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
);
