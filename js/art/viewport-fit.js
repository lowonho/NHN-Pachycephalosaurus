/*
 * A(비주얼) 전용 — 화면 비율이 바뀌어도 UI 비율은 그대로 유지한다.
 *
 * 모든 DOM UI는 STAGE_GEOMETRY.canvas(1920×1080) 설계 좌표계 위에 px로 그린다.
 * 여기서 계산한 --ui-scale 한 값으로 그 설계 화면을 통째로 균일 확대·축소하므로
 * 창이 넓어지든 좁아지든 UI가 늘어나거나 눌리거나 밖으로 삐져나가지 않는다.
 *
 * 배율 식(min(가로비, 세로비))은 Phaser Scale.FIT이 캔버스에 쓰는 것과 같다.
 * 그래서 HUD 레이어가 레터박스된 캔버스에 픽셀 단위로 정확히 겹친다.
 */

class ViewportFitter {
  constructor(dom, geometry) {
    this.appShell = dom.appShell;
    this.gameContainer = dom.gameContainer;
    this.design = geometry.canvas;
    this.handleResize = () => this.fit();
  }

  fit() {
    const scale = Math.min(
      window.innerWidth / this.design.width,
      window.innerHeight / this.design.height
    );
    document.documentElement.style.setProperty("--ui-scale", String(scale));

    if (!this.appShell || !this.gameContainer) return;
    this.appShell.style.width = "100%";
    this.appShell.style.height = `${window.innerHeight}px`;
  }

  start() {
    this.fit();
    window.addEventListener("resize", this.handleResize);
    window.visualViewport?.addEventListener("resize", this.handleResize);
    document.fonts?.ready.then(this.handleResize);
  }

  stop() {
    window.removeEventListener("resize", this.handleResize);
    window.visualViewport?.removeEventListener("resize", this.handleResize);
  }
}

const viewportFitter = new ViewportFitter(UI, STAGE_GEOMETRY);
