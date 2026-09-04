/* global Phaser */

const GAME_ASSETS = Object.freeze({
  backgrounds: Object.freeze({
    geojeSea: "assets/images/backgrounds/geoje-sea.png",
  }),
});

function preloadGameAssets(scene) {
  scene.load.image("geojeSea", GAME_ASSETS.backgrounds.geojeSea);
}
