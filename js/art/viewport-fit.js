/*
 * A(비주얼) 전용 — 앱 셸을 항상 브라우저 뷰포트 전체에 맞춘다.
 * Phaser Scale.FIT이 이 영역 안에서 16:9 캔버스를 최대 크기로 계산한다.
 */

class ViewportFitter {
  constructor(dom, geometry) {
    this.appShell = dom.appShell;
    this.gameContainer = dom.gameContainer;
    this.handleResize = () => this.fit();
  }

  fit() {
    if (!this.appShell || !this.gameContainer) return;
    this.appShell.style.width = "100%";
    this.appShell.style.height = `${window.innerHeight}px`;
  }

  start() {
    this.fit();
    window.addEventListener("resize", this.handleResize);
    document.fonts?.ready.then(this.handleResize);
  }

  stop() {
    window.removeEventListener("resize", this.handleResize);
  }
}

const viewportFitter = new ViewportFitter(UI, STAGE_GEOMETRY);
