/*
 * A(비주얼) 전용 — 창 크기에 맞춰 앱 셸 폭을 계산한다.
 *
 * 가로폭만 기준으로 16:9를 키우면 넓고 낮은 창에서 조작부가 화면 밖으로 밀린다.
 * 실제 부가 UI 높이를 제외한 공간에 게임을 맞춘다.
 */

class ViewportFitter {
  constructor(dom, geometry) {
    this.appShell = dom.appShell;
    this.gameContainer = dom.gameContainer;
    this.aspect = geometry.canvas.width / geometry.canvas.height;
    this.maxWidth = geometry.canvas.width;
    this.handleResize = () => this.fit();
  }

  fit() {
    if (!this.appShell || !this.gameContainer) return;
    this.appShell.style.width = "";

    // 폭을 바꾸면 부가 UI 높이도 바뀌므로 두 번 반복해 수렴시킨다.
    for (let pass = 0; pass < 2; pass += 1) {
      const nonGameHeight = this.appShell.scrollHeight - this.gameContainer.offsetHeight;
      const availableGameHeight = Math.max(180, window.innerHeight - nonGameHeight - 4);
      const fittedWidth = Math.min(
        this.maxWidth,
        window.innerWidth - 32,
        availableGameHeight * this.aspect,
      );
      this.appShell.style.width = `${Math.max(320, fittedWidth)}px`;
    }
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
