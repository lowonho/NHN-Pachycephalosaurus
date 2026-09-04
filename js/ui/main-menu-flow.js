/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 스테이지 선택 → 피치 조정(중간음 측정) → 선택한 스테이지
 * 순서이고, "게임 시작"이 그 첫 단계를 연다.
 *
 * 설정 화면은 settings-flow가 통째로 들고 있다. 여기서는 열고 닫는 신호만 보낸다.
 */

class MainMenuFlow {
  constructor(events, dom, setupFlow, soundBus, settings) {
    this.events = events;
    this.ui = dom;
    this.setupFlow = setupFlow;
    this.soundBus = soundBus;
    this.settings = settings;
    this.stageId = "geoje";

    this.ui.mainPlayButton?.addEventListener("click", () => this.openStageSelect());
    this.ui.stageGeojeButton?.addEventListener("click", () => this.selectStage("geoje"));
    this.ui.stageDujjonkuButton?.addEventListener("click", () => this.selectStage("dujjonku"));
    this.ui.stageSelectConfirmButton?.addEventListener("click", () => this.startGame());
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());
    this.ui.settingsMicButton?.addEventListener("click", () => this.recalibrate());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());

    // 피치 조정 중에도 메인 화면은 모달 뒤에 남아 있다. 실제로 스테이지가 열릴 때 비운다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());

    this.open();
  }

  open() {
    this.setupFlow.close();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  /* 게임 시작 → 스테이지 선택. 메인 화면은 접고 선택 화면만 남긴다. */
  openStageSelect() {
    this.soundBus.resume();
    this.close();
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.ui.stageGeojeButton?.focus();
  }

  closeStageSelect() {
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.mainPlayButton?.focus();
  }

  selectStage(stageId) {
    this.stageId = stageId;
    const geojeSelected = stageId === "geoje";
    this.ui.stageGeojeButton?.classList.toggle("selected", geojeSelected);
    this.ui.stageGeojeButton?.setAttribute("aria-pressed", String(geojeSelected));
    this.ui.stageDujjonkuButton?.classList.toggle("selected", !geojeSelected);
    this.ui.stageDujjonkuButton?.setAttribute("aria-pressed", String(!geojeSelected));
  }

  /*
   * 선택 완료 → 피치 조정 UI. 선택 화면만 닫는다 — 피치 조정은 메인 화면 위에
   * 덮이고, 메인 화면은 측정이 끝나 스테이지가 열릴 때(REQUEST_START) 비워진다.
   */
  startGame() {
    this.soundBus.resume();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.setupFlow.beginCalibration("stage", this.stageId);
  }

  /* 설정의 "음성 입력 감도" 버튼 — 설정 화면 위에 그대로 덮어서 중간음을 다시 잰다. */
  recalibrate() {
    this.soundBus.resume();
    this.settings.prepareRecalibration();
    this.setupFlow.beginCalibration("settings");
  }
}

const mainMenuFlow = new MainMenuFlow(gameEvents, UI, modalFlow, audioBus, settingsFlow);
