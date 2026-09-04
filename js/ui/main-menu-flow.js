/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 피치 조정(중간음 측정) → 거제 야호 스테이지
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

    this.ui.mainPlayButton?.addEventListener("click", () => this.startGame());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());
    this.ui.settingsMicButton?.addEventListener("click", () => this.recalibrate());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());

    this.open();
  }

  open() {
    this.setupFlow.close();
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  /* 게임 시작 → 피치 조정 UI. 스테이지는 측정이 끝난 뒤 modal-flow가 연다. */
  startGame() {
    this.soundBus.resume();
    this.close();
    this.setupFlow.beginCalibration("stage", this.stageId);
  }

  /* 설정의 "음성 입력 감도" 버튼 — 설정과 메인을 함께 닫고 중간음을 다시 잰다. */
  recalibrate() {
    this.soundBus.resume();
    this.settings.prepareRecalibration();
    this.close();
    this.setupFlow.beginCalibration("main");
  }
}

const mainMenuFlow = new MainMenuFlow(gameEvents, UI, modalFlow, audioBus, settingsFlow);
