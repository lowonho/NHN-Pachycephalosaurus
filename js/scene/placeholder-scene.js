/* global Phaser */
/*
 * 기능(B) — 자리를 지키는 빈 씬.
 *
 * 이전 스테이지(거제 야호 · 두쫀쿠)를 걷어낸 자리다. 새 게임을 정하면 이 파일을
 * 실제 씬으로 바꾸거나, 옆에 새 씬을 만들고 js/game.js의 scene 목록에 추가한다.
 *
 * 지금 이 씬이 하는 일은 두 가지뿐이다.
 *   1) 에셋 매니페스트를 로드해 로더 경로가 살아 있는지 확인한다.
 *   2) SCENE_CREATE를 발행해 사운드 버스가 Phaser 씬에 붙게 한다(볼륨 설정이 동작해야 한다).
 */

class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super("PlaceholderScene");
  }

  preload() {
    preloadGameAssets(this);
  }

  create() {
    // audio-bus가 이 이벤트로 씬을 붙잡는다. 설정 화면의 볼륨이 실제로 먹으려면 필요하다.
    gameEvents.emit(GAME_EVENTS.SCENE_CREATE, { scene: this });

    const { width, height } = STAGE_GEOMETRY.canvas;
    this.add
      .text(width / 2, height / 2, "STAGE 준비 중", {
        fontFamily: THEME.font.display,
        fontSize: "64px",
        color: THEME.css.textDim,
      })
      .setOrigin(0.5);
  }

  shutdown() {
    gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, { scene: this });
  }
}
