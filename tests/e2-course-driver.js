// Play through real A/D + Space inputs: approach an edge and aim for the next landing.
window.driveE2 = (seconds = 20.3, { reactionFrames = 1, edge = 2 } = {}) => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  let target = 1;
  for (let frame = 0; frame < Math.ceil(seconds * 120) && scene.playable(); frame++) {
    const s = scene.state, platforms = scene.platforms;
    if (frame % reactionFrames !== 0) { scene.update(0, 1000 / 120); continue; }
    scene.touch.clear();
    if (s.grounded) {
      const p = platforms[s.platformIndex];
      scene.touch.add('right');
      if (p && s.platformIndex < platforms.length - 1 && s.x >= p.x + p.w - edge) {
        target = s.platformIndex + 1;
        scene.primaryAction();
      }
    } else {
      const p = platforms[target];
      if (p) {
        const center = p.x + p.w / 2;
        if (s.x < center - 2) scene.touch.add('right');
        else if (s.x > center + 2) scene.touch.add('left');
      }
    }
    scene.update(0, 1000 / 120);
  }
};
