/*
 * C1(이미지) 전용 — 스프라이트 애니메이션 정의.
 *
 * 현재 캐릭터가 이모지라 등록할 애니메이션이 없다.
 * assets/images/characters/ 에 스프라이트시트를 넣고 image-manifest의
 * SPRITESHEET_MANIFEST에 등록한 뒤, 아래에 애니메이션을 추가한다.
 */

function registerSpriteAnimations(scene) {
  const has = (key) => scene.textures.exists(key);

  // ── 예시 (스프라이트시트를 넣은 뒤 주석 해제) ──────────────────────
  // if (has(TEXTURE_KEYS.player.run) && !scene.anims.exists("player-run")) {
  //   scene.anims.create({
  //     key: "player-run",
  //     frames: scene.anims.generateFrameNumbers(TEXTURE_KEYS.player.run, { start: 0, end: 5 }),
  //     frameRate: 12,
  //     repeat: -1,
  //   });
  // }

  void has;
}
