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
    const image = b.image;
    for (const slot of b.footprint) {
      const wall = game.tileRect(slot.col, slot.row);
      assert(scene.state.tiles[slot.row][slot.col] === 1 && slot.x >= wall.x && slot.y >= wall.y
        && slot.x+grid.wall <= wall.x+wall.w && slot.y+grid.wall <= wall.y+wall.h, 'Each building footprint cell stays inside existing walls');
    }
    assert(image.displayWidth <= b.w && image.displayHeight <= b.h && Math.abs(image.scaleX-image.scaleY) < 1e-8, 'Building fits its footprint without distortion');
  }
  game.render.call(scene);
  assert(JSON.stringify(scene.state.tiles) === tiles && scene.village.buildings.map(b=>b.role).join(',') === variants, 'Rendering preserves maze and building variants');
  const cam = scene.cameras.main;
  for (const role of ['tileRoof', 'tileRoofAlt', 'thatch', 'thatchAlt']) {
    const texture = scene.textures.get('e4:'+role);
    assert(texture.has('art'), 'Asset art frame loaded');
  }
  const extent = game.tileRect(grid.cols-1,grid.rows-1);
  assert(grid.x >= cam.scrollX && grid.y >= cam.scrollY && grid.x+extent.x+extent.w <= cam.scrollX+960/cam.zoom && grid.y+extent.y+extent.h <= cam.scrollY+540/cam.zoom, 'Entire maze is inside camera');
  assert(new Set(scene.village.buildings.map(b => b.role)).size === 4, 'All four supplied roof variants appear and remain stable');
  const king = scene.village.goalCharacter, tiger = scene.tigerSprite;
  const actor = scene.village.actor;
  assert(actor && scene.textures.get('e4:playerUp').has('motion-2')
    && scene.textures.get('e4:playerDown').has('motion-2'), 'Supplied character front/back motion sheets load');
  let actorScale;
  for (const [direction, left, role, rotation] of [
    ['up', false, 'playerUp', 0], ['down', false, 'playerDown', 0],
    ['right', false, 'playerUp', Math.PI/2], ['right', true, 'playerUp', -Math.PI/2],
  ]) {
    for (const [phase, frame] of [[0, 0], [1, 1], [2, 2], [3, 1]]) {
      Object.assign(scene.village, { direction, facingLeft: left, walkPhase: phase }); game.render.call(scene);
      assert(actor.texture.key === `e4:${role}` && actor.frame.name === `motion-${frame}`
        && Math.abs(actor.rotation-rotation) < .001 && !actor.flipX, 'Character uses the correct sheet, 1-2-3-2 pose and direction');
      actorScale ??= actor.scaleX;
      assert(actor.scaleX === actorScale && actor.scaleY === actorScale
        && actor.x === scene.state.x+grid.x && actor.y === scene.state.y+grid.y,
        'Character preserves scale and torso position across poses and directions');
      const source = actor.texture.getSourceImage(), frameData = actor.frame;
      assert(frameData.cutX >= 0 && frameData.cutY >= 0 && frameData.cutX+frameData.cutWidth <= source.width
        && frameData.cutY+frameData.cutHeight <= source.height, 'Character crop stays inside the source PNG');
    }
  }
  assert(Math.abs(actorScale*582 - 44*grid.passageX/64) < .01, 'Character retains a proportional 44px baseline');
  assert(king && tiger && scene.textures.get('e4:tiger').has('motion-2') && scene.textures.get('e4:goalCharacter').has('motion-1'), 'Actual alpha-bounded tiger and king motion frames load');
  assert(Math.abs(Math.max(king.displayWidth, king.displayHeight) - 44 * grid.passageX/64) < .01, 'King uses a proportional 44px baseline');
  assert(Math.abs(Math.max(tiger.displayWidth, tiger.displayHeight) - grid.passageX) < .01, 'Tiger uses a 64px baseline including the tail');
  assert(tiger.originY < .4 && game.chase.bodyRadius === 10, 'Tiger pivots on its torso and collision excludes the tail');
  const pose = king.frame.name, kingX = king.x, kingY = king.y;
  scene.elapsed += .81; game.render.call(scene);
  assert(king.frame.name !== pose && king.x === kingX && king.y === kingY, 'King slowly alternates frames at a stable goal position');
  for (const [phase, expected] of [[0, 0], [1, 1], [2, 2], [3, 1]]) {
    scene.state.tiger.phase = phase; game.render.call(scene);
    assert(tiger.frame.name === `motion-${expected}` && Math.abs(tiger.originY * tiger.height - 229) < .01,
      'Tiger uses 1-2-3-2 frames without moving its torso pivot');
  }
  // 긴 건물 그림은 아직 없으므로 검사용 2×1 / 1×2 텍스처로 배치 규칙만 검증한다.
  for (const [role, w, h] of [['inn', 128, 64], ['longHouse', 64, 128]]) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').fillRect(0, 0, w, h); scene.textures.addCanvas(`e4:${role}`, canvas);
  }
  try {
    scene.loadStage('e4');
    const used = new Set(), longKinds = new Set();
    for (const b of scene.village.buildings) {
      if (b.footprint.length > 1) longKinds.add(b.role);
      assert(b.w * b.h === b.footprint.length * grid.wall ** 2 && b.footprint.length <= 2, 'Building occupies exactly one or two existing wall slots');
      for (const slot of b.footprint) {
        const key = `${slot.x},${slot.y}`, wall = game.tileRect(slot.col, slot.row);
        assert(!used.has(key), 'Building footprints never overlap'); used.add(key);
        assert(scene.state.tiles[slot.row][slot.col] === 1 && slot.x >= wall.x && slot.y >= wall.y
          && slot.x + grid.wall <= wall.x + wall.w && slot.y + grid.wall <= wall.y + wall.h, 'Long building never takes space from a passage');
      }
    }
    assert(longKinds.has('inn') && longKinds.has('longHouse'), 'Horizontal and vertical two-slot building placement both work');
  } finally {
    scene.loadStage('e10'); scene.textures.remove('e4:inn'); scene.textures.remove('e4:longHouse');
  }
  return 'PASS: four real roof assets, torso-aligned tiger motion, king animation, unchanged maze, two-slot footprint safety';
})()
