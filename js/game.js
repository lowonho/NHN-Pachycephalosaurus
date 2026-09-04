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
  scene: [StageScene, DujjonkuScene],
});

// 두쫀쿠는 기존 Arcade Scene과 물리 시스템을 공유하지 않고 필요할 때만 시작한다.
gameEvents.on(GAME_EVENTS.REQUEST_START, ({ stageId } = {}) => {
  if (stageId !== "dujjonku") return;
  if (game.scene.isActive("StageScene")) game.scene.stop("StageScene");
  game.scene.start("DujjonkuScene", { autoStart: true });
});

// 자동화/개발 테스트 전용 진입점. 일반 URL에서는 실행되지 않는다.
const debugParams = new URLSearchParams(window.location.search);
if (debugParams.get("debugVoice") === "1" && debugParams.get("stage") === "dujjonku") {
  window.setTimeout(() => {
    UI.titleScreen?.classList.add("hidden");
    UI.mainMenu?.classList.add("hidden");
    UI.stageSelectScreen?.classList.add("hidden");
    UI.appShell?.removeAttribute("inert");
    gameEvents.emit(GAME_EVENTS.REQUEST_START, { stageId: "dujjonku" });
  }, 80);
} else if (debugParams.get("debugVoice") === "1" && debugParams.get("stage") === "geoje") {
  window.setTimeout(() => {
    UI.titleScreen?.classList.add("hidden");
    UI.mainMenu?.classList.add("hidden");
    UI.stageSelectScreen?.classList.add("hidden");
    UI.appShell?.removeAttribute("inert");
    gameEvents.emit(GAME_EVENTS.REQUEST_START, { stageId: "geoje" });
  }, 80);
}

viewportFitter.start();

window.addEventListener("beforeunload", () => {
  viewportFitter.stop();
  voiceController.destroy();
  audioBus.destroy();
  game.destroy(true);
});
