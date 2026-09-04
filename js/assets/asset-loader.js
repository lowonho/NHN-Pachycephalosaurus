/* global Phaser */
/*
 * 기능(B) — 매니페스트를 순회해 Phaser 로더에 넘긴다.
 * 어떤 파일을 넣을지는 C1/C2가 각자 매니페스트에서 정한다. 이 파일은 건드리지 않는다.
 */

function preloadGameAssets(scene) {
  IMAGE_MANIFEST.forEach((entry) => scene.load.image(entry.key, entry.path));

  SPRITESHEET_MANIFEST.forEach((entry) =>
    scene.load.spritesheet(entry.key, entry.path, entry.frameConfig),
  );

  AUDIO_MANIFEST.forEach((entry) => scene.load.audio(entry.key, entry.paths));

  // 파일이 없어도 스테이지는 프리미티브 폴백으로 계속 진행한다.
  scene.load.on("loaderror", (file) => {
    console.warn(`[assets] 로드 실패 — "${file.key}" (${file.src})`);
  });
}

/*
 * 물리 전용 텍스처. 눈에 보이지 않으며 충돌 판정에만 쓰인다.
 * 아트 에셋과 무관하므로 기능 트랙이 관리한다.
 */
function createPhysicsTextures(scene) {
  const { player } = STAGE_GEOMETRY;

  if (!scene.textures.exists("physicsPixel")) {
    const pixel = scene.make.graphics({ x: 0, y: 0, add: false });
    pixel.fillStyle(0xffffff, 1);
    pixel.fillRect(0, 0, 2, 2);
    pixel.generateTexture("physicsPixel", 2, 2);
    pixel.destroy();
  }

  if (!scene.textures.exists("playerPhysics")) {
    const body = scene.make.graphics({ x: 0, y: 0, add: false });
    body.fillStyle(0xffffff, 1);
    body.fillRect(0, 0, player.width, player.height);
    body.generateTexture("playerPhysics", player.width, player.height);
    body.destroy();
  }
}
