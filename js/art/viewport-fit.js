/*
 * A(비주얼) 전용 — 앱 셸 크기와 게임 카메라의 DOM UI 안전 영역을 계산한다.
 * Phaser 캔버스의 1920 × 1080 내부 좌표는 바꾸지 않는다.
 */

class ViewportFitter {
  constructor(dom, geometry) {
    this.appShell = dom.appShell;
    this.gameContainer = dom.gameContainer;
    this.geometry = geometry;
    this.topOverlays = [dom.systemStatus, dom.helpToggle, dom.helpCopy, dom.pauseButton];
    this.bottomOverlays = [dom.pitchPanel, dom.commandDeck];
    this.cameraSafeArea = {
      top: 120,
      bottom: 920,
      centerY: geometry.camera.fallbackCenterY,
    };
    this.lastSafeAreaMeasure = 0;
    this.handleResize = () => this.fit();
  }

  fit() {
    if (!this.appShell || !this.gameContainer) return;
    this.appShell.style.width = "100%";
    this.appShell.style.height = `${window.innerHeight}px`;
    this.lastSafeAreaMeasure = 0;
    requestAnimationFrame(() => this.measureCameraSafeArea());
  }

  isVisible(element) {
    if (!element || element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  measureCameraSafeArea() {
    const canvas = this.gameContainer?.firstElementChild;
    if (!canvas || canvas.tagName !== "CANVAS") return this.cameraSafeArea;

    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return this.cameraSafeArea;

    const scaleY = this.geometry.canvas.height / canvasRect.height;
    const padding = 18 * scaleY;
    let safeTop = 0;
    let safeBottom = this.geometry.canvas.height;

    this.topOverlays.forEach((element) => {
      if (!this.isVisible(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= canvasRect.top || rect.top >= canvasRect.bottom) return;
      safeTop = Math.max(safeTop, (rect.bottom - canvasRect.top) * scaleY + padding);
    });

    this.bottomOverlays.forEach((element) => {
      if (!this.isVisible(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= canvasRect.top || rect.top >= canvasRect.bottom) return;
      safeBottom = Math.min(safeBottom, (rect.top - canvasRect.top) * scaleY - padding);
    });

    safeTop = Phaser.Math.Clamp(safeTop, 0, this.geometry.canvas.height);
    safeBottom = Phaser.Math.Clamp(safeBottom, safeTop, this.geometry.canvas.height);
    const minimumHeight = this.geometry.player.height + 24;
    const centerY = safeBottom - safeTop >= minimumHeight
      ? (safeTop + safeBottom) / 2
      : this.geometry.camera.fallbackCenterY;

    this.cameraSafeArea = { top: safeTop, bottom: safeBottom, centerY };
    this.lastSafeAreaMeasure = performance.now();
    return this.cameraSafeArea;
  }

  getCameraSafeArea() {
    if (performance.now() - this.lastSafeAreaMeasure > 250) {
      return this.measureCameraSafeArea();
    }
    return this.cameraSafeArea;
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
