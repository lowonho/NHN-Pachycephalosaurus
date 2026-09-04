/* global Phaser */
/*
 * 기능(B) — 부트스트랩.
 *
 * 이 파일이 하는 일은 Phaser 게임을 만들고, DOM 위젯을 연결하고, 정리하는 것뿐이다.
 * 색·좌표·문구·사운드는 각 트랙의 파일에 있다.
 */

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: STAGE_GEOMETRY.canvas.width,
  height: STAGE_GEOMETRY.canvas.height,
  transparent: false,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: BALANCE.physics.gravityY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [StageScene],
});

// 도움말 토글 — 펼치면 부가 UI 높이가 변하므로 레이아웃을 다시 계산한다.
UI.helpToggle?.addEventListener("click", () => {
  const expanded = UI.helpToggle.getAttribute("aria-expanded") === "true";
  UI.helpToggle.setAttribute("aria-expanded", String(!expanded));
  UI.helpCopy.hidden = expanded;
  viewportFitter.fit();
});

viewportFitter.start();

window.addEventListener("beforeunload", () => {
  viewportFitter.stop();
  voiceController.destroy();
  audioBus.destroy();
  game.destroy(true);
});
