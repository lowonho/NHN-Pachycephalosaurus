/* global Phaser */

const DUJJONKU_TEXTURES = Object.freeze({
  projectile: "dujjonku-projectile",
  wood: "dujjonku-wood",
  stone: "dujjonku-stone",
  star: "dujjonku-star",
  monster: "dujjonku-monster",
});

function createDujjonkuTextures(scene) {
  if (scene.textures.exists(DUJJONKU_TEXTURES.projectile)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xf58aa8).fillCircle(34, 34, 30);
  g.fillStyle(0xffd9e3).fillCircle(24, 23, 8);
  g.fillStyle(0x6d3a4e).fillCircle(24, 34, 3).fillCircle(43, 34, 3);
  g.lineStyle(3, 0x6d3a4e).arc(34, 39, 9, 0.15, Math.PI - 0.15).strokePath();
  g.generateTexture(DUJJONKU_TEXTURES.projectile, 68, 68).clear();

  g.fillStyle(0xd99555).fillRoundedRect(2, 2, 116, 48, 10);
  g.lineStyle(4, 0x9f6139).strokeRoundedRect(2, 2, 116, 48, 10);
  g.lineStyle(2, 0xf4bd77).lineBetween(18, 10, 92, 39).lineBetween(54, 8, 105, 25);
  g.generateTexture(DUJJONKU_TEXTURES.wood, 120, 52).clear();

  g.fillStyle(0x9ba9ba).fillRoundedRect(2, 2, 86, 54, 11);
  g.lineStyle(4, 0x6f7785).strokeRoundedRect(2, 2, 86, 54, 11);
  g.lineStyle(2, 0xcbd4df).lineBetween(16, 15, 32, 8).lineBetween(53, 40, 72, 25);
  g.generateTexture(DUJJONKU_TEXTURES.stone, 90, 58).clear();

  g.fillStyle(0x7fc7ef).fillRoundedRect(2, 2, 68, 68, 14);
  g.lineStyle(4, 0x4d8fc9).strokeRoundedRect(2, 2, 68, 68, 14);
  g.fillStyle(0xffe16c).fillPoints([
    new Phaser.Geom.Point(36, 10), new Phaser.Geom.Point(43, 28),
    new Phaser.Geom.Point(63, 29), new Phaser.Geom.Point(47, 41),
    new Phaser.Geom.Point(53, 60), new Phaser.Geom.Point(36, 49),
    new Phaser.Geom.Point(19, 60), new Phaser.Geom.Point(25, 41),
    new Phaser.Geom.Point(9, 29), new Phaser.Geom.Point(29, 28),
  ], true);
  g.generateTexture(DUJJONKU_TEXTURES.star, 72, 72).clear();

  g.fillStyle(0xb8d96b).fillCircle(40, 41, 35);
  g.fillStyle(0xdaf29a).fillCircle(29, 30, 12);
  g.fillStyle(0x725070).fillCircle(28, 42, 3).fillCircle(51, 42, 3);
  g.lineStyle(3, 0x725070).arc(40, 50, 9, Math.PI + 0.25, Math.PI * 2 - 0.25).strokePath();
  g.fillStyle(0xf7b3c8).fillCircle(20, 51, 5).fillCircle(60, 51, 5);
  g.fillStyle(0x725070).fillTriangle(18, 17, 27, 5, 31, 20).fillTriangle(49, 20, 55, 5, 64, 18);
  g.generateTexture(DUJJONKU_TEXTURES.monster, 80, 78).destroy();
}

function addDujjonkuBlock(scene, type, x, y, options = {}) {
  const settings = {
    wood: { texture: DUJJONKU_TEXTURES.wood, hp: 52, density: 0.0009, restitution: 0.22, friction: 0.5 },
    stone: { texture: DUJJONKU_TEXTURES.stone, hp: 150, density: 0.0065, restitution: 0.04, friction: 0.82 },
    star: { texture: DUJJONKU_TEXTURES.star, hp: 78, density: 0.0018, restitution: 0.3, friction: 0.58 },
  }[type];
  const block = scene.matter.add.image(x, y, settings.texture, null, {
    density: settings.density,
    friction: settings.friction,
    frictionStatic: settings.friction + 0.18,
    frictionAir: type === "stone" ? 0.02 : 0.008,
    restitution: settings.restitution,
  });
  block.setDataEnabled();
  block.setData({
    kind: "block",
    blockType: type,
    hp: settings.hp,
    maxHp: settings.hp,
    destroyed: false,
    lastImpactAt: 0,
  });
  if (options.angle) block.setAngle(options.angle);
  if (options.scaleX || options.scaleY) block.setScale(options.scaleX || 1, options.scaleY || 1);
  return block;
}

function addDujjonkuMonster(scene, x, y) {
  const monster = scene.matter.add.image(x, y, DUJJONKU_TEXTURES.monster, null, {
    shape: { type: "circle", radius: 34 },
    density: 0.00135,
    friction: 0.58,
    frictionStatic: 0.76,
    frictionAir: 0.008,
    restitution: 0.34,
  });
  monster.setDataEnabled();
  monster.setData({ kind: "monster", hp: 68, destroyed: false });
  return monster;
}
