(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  scene.loadStage('e4'); scene.startStage();
  const game = scene.stageGame, grid = game.grid;
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  assert(grid.wall === 28 && grid.passageX === 66 && grid.passageY === 90 && game.tuning.radius === 10, 'Wider walls, passable lanes and original collision radius');
  assert(game.tuning.speed === 240 && game.tuning.maxSpeed === 800 && game.timeLimit === 20.26, 'Adjusted speed cap and original timer');
  const tiles = JSON.stringify(scene.state.tiles);
  const variants = scene.village.buildings.map(b => b.role).join(',');
  for (const b of scene.village.buildings) {
    const wall = game.tileRect(b.col,b.row), image = b.image;
    assert(scene.state.tiles[b.row][b.col] === 1 && b.x >= wall.x && b.y >= wall.y && b.x+b.w <= wall.x+wall.w && b.y+b.h <= wall.y+wall.h, 'Buildings stay inside existing collision walls');
    assert(image.displayWidth <= b.w && image.displayHeight <= b.h && Math.abs(image.scaleX-image.scaleY) < 1e-8, 'Building fits its footprint without distortion');
  }
  game.render.call(scene);
  assert(JSON.stringify(scene.state.tiles) === tiles && scene.village.buildings.map(b=>b.role).join(',') === variants, 'Rendering preserves maze and building variants');
  const cam = scene.cameras.main;
  for (const role of ['tileRoof']) {
    const texture = scene.textures.get('e4:'+role);
    assert(texture.has('art'), 'Asset art frame loaded');
  }
  const extent = game.tileRect(grid.cols-1,grid.rows-1);
  assert(grid.x >= cam.scrollX && grid.y >= cam.scrollY && grid.x+extent.x+extent.w <= cam.scrollX+960/cam.zoom && grid.y+extent.y+extent.h <= cam.scrollY+540/cam.zoom, 'Entire maze is inside camera');
  scene.stopGame();
  return 'PASS: village bounds, unchanged collision/tuning, stable variants, transparent roof and whole-map viewport';
})()
