(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep();
  archiveGameBridge.active = false;
  const checks = [];
  const assert = (value, label) => { if (!value) throw Error(label); checks.push(label); };
  const load = () => {
    scene.loadStage('e10'); scene.startStage();
    scene.settings = { shake: false, effects: true };
  };
  const advance = seconds => {
    for (let i = 0; i < Math.ceil(seconds * 120); i++) scene.update(0, 1000 / 120);
  };
  load();
  assert(scene.skater && scene.skater.texture.key === 'e10:glide', 'e10: supplied local sheet loads as the player');
  assert(scene.textures.get('e10:glide').has('pose-3') && scene.textures.get('e10:jump').has('pose-7'), 'e10: both sheet rows are sliced into 12 complete frames');
  assert(scene.skater.displayWidth === scene.skater.displayHeight, 'e10: square source cells preserve the original pose proportions');
  const lastPose = scene.textures.get('e10:jump').get('pose-7');
  assert(lastPose.cutX === 1920 && lastPose.cutY === 640 && lastPose.cutWidth === 640 && lastPose.cutHeight === 640,
    'e10: high-resolution sheet reaches the full last pose without old 160px cropping');
  assert(scene.skater.displayHeight === 96 && scene.skater.originY === .95,
    'e10: larger skater keeps the source skate baseline');
  scene.directionPress('right'); advance(.22);
  assert(scene.skater.flipX && scene.state.iceMarks.length > 0, 'e10: right input mirrors the left-facing source and leaves blade marks');
  scene.directionRelease('right');
  scene.primaryAction(); advance(.03);
  assert(scene.skater.texture.key === 'e10:jump' && scene.skater.frame.name === 'pose-0', 'e10: physical jump begins with the takeoff pose');
  advance(.14);
  const spinFrame = scene.skater.frame.name;
  assert(['pose-2', 'pose-3', 'pose-4', 'pose-5'].includes(spinFrame), 'e10: airborne player enters rotation poses');
  advance(.05);
  assert(scene.skater.frame.name !== spinFrame, 'e10: rotation advances during actual flight');
  const pausedAt = scene.elapsed, pausedFrame = scene.skater.frame.name;
  archiveGame.pause(true); advance(.3);
  assert(scene.elapsed === pausedAt && scene.skater.frame.name === pausedFrame, 'e10: pause freezes animation and physics together');
  archiveGame.pause(false);
  for (let i = 0; i < 120 && !scene.state.grounded; i++) advance(1 / 120);
  assert(scene.state.grounded && scene.skater.frame.name === 'pose-6' && scene.state.iceChips.length > 0, 'e10: ground contact opens the landing pose and emits ice chips');
  assert(scene.skater.y === 474, 'e10: landing anchors skates to the unchanged ground collision height');
  advance(.3);
  assert(scene.skater.texture.key === 'e10:glide', 'e10: landing animation returns to skating');
  scene.settings.effects = false; advance(.02);
  assert(!scene.state.iceChips.length && !scene.state.iceMarks.length, 'e10: effects setting clears optional ice particles and marks');
  const oldSkater = scene.skater;
  load();
  assert(!scene.children.exists(oldSkater) && scene.skater !== oldSkater && scene.state.jumpAt === -1 && !scene.state.iceMarks.length,
    'e10: retry removes the prior sprite and resets visual state');
  scene.directionPress('right');
  scene.state.friction = scene.stageGame.tuning.minFriction;
  advance(.6);
  scene.directionRelease('right');
  const coastX = scene.state.x, coastSpeed = scene.state.vx;
  const coastFrames = new Set();
  for (let i = 0; i < 24; i++) { advance(1 / 120); coastFrames.add(scene.skater.frame.name); }
  assert(scene.state.x > coastX && scene.state.vx > 0 && scene.state.vx < coastSpeed
    && coastFrames.size === 1 && coastFrames.has('pose-0'),
    'e10: releasing input holds the standing pose while momentum continues and slows');
  scene.directionPress('right');
  const pushFrames = new Set();
  for (let i = 0; i < 36; i++) { advance(1 / 120); pushFrames.add(scene.skater.frame.name); }
  assert(pushFrames.size > 1, 'e10: pressing direction again resumes leg animation');
  scene.loadStage('e9');
  assert(!scene.children.list.some(child => child.texture?.key === 'e10:glide'), 'e10: switching games removes the skater');
  return checks;
})()
