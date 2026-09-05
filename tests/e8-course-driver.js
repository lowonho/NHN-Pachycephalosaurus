// Real stage inputs only; decisions are sampled every 50ms by default.
window.driveE8 = (seconds = 20.3, { reactionFrames = 6, jumpLead = .16, hookDelay = .3, releaseAt = .4 } = {}) => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  let jumpAt = -10, attemptedHook = false, lastGrounded = true;
  const log = [];
  for (let frame = 0; frame < Math.ceil(seconds * 120) && scene.playable(); frame++) {
    const s = scene.state;
    if (frame % reactionFrames === 0) {
      if (s.grounded) {
        scene.touch.delete('action'); attemptedHook = false;
        if (!lastGrounded) log.push({ landed: s.roofIndex, at: scene.elapsed, x: s.x, deaths: s.deaths });
        const roof = scene.roofs[s.roofIndex];
        if (s.roofIndex < scene.roofs.length - 1 && roof.x + roof.w - s.x < s.speed * jumpLead && !s.retry) {
          scene.touch.add('action'); scene.primaryAction(); jumpAt = scene.elapsed;
        }
      } else if (!attemptedHook) {
        scene.touch.delete('action');
        if (scene.elapsed - jumpAt >= hookDelay) {
          scene.touch.add('action'); scene.primaryAction(); attemptedHook = true;
          log.push({ hook: s.rope?.anchor ?? null, at: scene.elapsed, x: s.x, y: s.y, length: s.rope?.length });
        }
      } else if (s.rope && s.x > scene.anchors[s.rope.anchor].x + s.rope.length * releaseAt) {
        scene.touch.delete('action');
      }
      lastGrounded = s.grounded;
    }
    scene.update(0, 1000 / 120);
  }
  return log;
};
