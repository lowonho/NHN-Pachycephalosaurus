// Play through real inputs: approach an edge, aim for the next landing, and brake in the air.
window.driveE2 = (seconds = 20.3, { reactionFrames = 1, edge = 8, allowAssist = true } = {}) => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  let target = 1, assist = false;
  for (let frame = 0; frame < Math.ceil(seconds * 120) && scene.playable(); frame++) {
    const s = scene.state, platforms = scene.platforms;
    if (frame % reactionFrames !== 0) { scene.update(0, 1000 / 120); continue; }
    scene.touch.clear();
    if (s.grounded) {
      const p = platforms[s.platformIndex];
      scene.touch.add('right');
      if (p && s.platformIndex < platforms.length - 1 && s.x >= p.x + p.w - edge) {
        target = s.platformIndex + 1;
        assist = allowAssist && scene.stageGame.jumpPower.call(scene) < 430;
        scene.primaryAction();
      }
    } else {
      const p = platforms[target];
      if (p) {
        const center = p.x + p.w / 2;
        if (s.x < center - 2) scene.touch.add('right');
        else if (s.x > center + 2) scene.touch.add('left');
        if (assist) scene.touch.add('up');
        if (Math.abs(s.x - center) < p.w * .25 && s.vy > 0 && s.y + 20 < p.y - 6) {
          scene.touch.delete('up'); scene.touch.add('down');
        }
      }
    }
    scene.update(0, 1000 / 120);
  }
};
