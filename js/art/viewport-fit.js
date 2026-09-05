/*
 * A(비주얼) 전용 — 화면 비율이 바뀌어도 UI 비율은 그대로 유지한다.
 *
 * 모든 DOM UI는 STAGE_GEOMETRY.canvas(1920×1080) 설계 좌표계 위에 px로 그린다.
 * 여기서 계산한 --ui-scale 한 값으로 그 설계 화면을 통째로 균일 확대·축소하므로
 * 창이 넓어지든 좁아지든 UI가 늘어나거나 눌리거나 밖으로 삐져나가지 않는다.
 *
 * 플레이 화면도 이 설계 화면 안에 있다 — 모니터 스크린(1440×810) 안을 채우므로
 * 여기서 크기를 따로 계산하지 않는다(css/base.css의 .app-shell · .hud-layer).
 */

class ViewportFitter {
  constructor(geometry) {
    this.design = geometry.canvas;
    this.handleResize = () => this.fit();
  }

  fit() {
    const scale = Math.min(
      window.innerWidth / this.design.width,
      window.innerHeight / this.design.height
    );
    document.documentElement.style.setProperty("--ui-scale", String(scale));

    /*
     * 플레이 화면 크기는 여기서 만지지 않는다.
     * .app-shell은 모니터 스크린(.protocol-screen) 안을 채우는 절대 배치라
     * 크기를 CSS가 정한다(css/base.css). 창 픽셀로 덮어쓰면 스크린 밖으로 넘친다.
     */
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

const viewportFitter = new ViewportFitter(STAGE_GEOMETRY);
