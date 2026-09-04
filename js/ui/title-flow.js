/* 기능(B) — 최초 타이틀 화면에서 기존 메인/설정 화면으로 진입한다. */

class TitleFlow {
  constructor(dom, nextFlow) {
    this.ui = dom;
    this.nextFlow = nextFlow;
    this.ui.titleStartButton?.addEventListener("click", () => this.enterMain());
    this.ui.titleStartButton?.focus();
  }

  enterMain() {
    if (!this.ui.titleScreen || this.ui.titleScreen.classList.contains("hidden")) return;

    this.ui.titleScreen.classList.add("hidden");
    this.ui.titleScreen.setAttribute("aria-hidden", "true");
    this.ui.appShell?.removeAttribute("inert");
    this.nextFlow.open();
    this.ui.primaryButton?.focus();
  }
}

const titleFlow = new TitleFlow(UI, mainMenuFlow);
