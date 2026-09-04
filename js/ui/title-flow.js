/* 기능(B) — 최초 타이틀 화면에서 기존 메인/설정 화면으로 진입한다. */

class TitleFlow {
  constructor(dom, setupFlow, soundBus) {
    this.ui = dom;
    this.setupFlow = setupFlow;
    this.soundBus = soundBus;
    this.ui.titleStartButton?.addEventListener("click", () => this.startInitialSetup());
    this.ui.titleStartButton?.focus();
  }

  startInitialSetup() {
    if (!this.ui.titleScreen || this.ui.titleScreen.classList.contains("hidden")) return;

    this.soundBus.resume();
    this.ui.titleScreen.classList.add("hidden");
    this.ui.titleScreen.setAttribute("aria-hidden", "true");
    this.setupFlow.beginCalibration("main");
  }
}

const titleFlow = new TitleFlow(UI, modalFlow, audioBus);
