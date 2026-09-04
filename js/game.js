/* global Phaser */
/*
 * 기능(B) — 부트스트랩.
 *
 * 이 파일이 하는 일은 Phaser 게임을 만들고, DOM 위젯을 연결하고, 정리하는 것뿐이다.
 * 색·좌표·문구·사운드는 각 트랙의 파일에 있다.
 *
 * 게임 내용을 다시 정하는 중이라 지금 등록된 씬은 빈 PlaceholderScene 하나뿐이고,
 * 스테이지로 들어가는 경로는 전부 막혀 있다(스테이지 카드 3장 모두 준비 중).
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
  scene: [PlaceholderScene],
});

viewportFitter.start();

window.addEventListener("beforeunload", () => {
  viewportFitter.stop();
  audioBus.destroy();
  game.destroy(true);
});
