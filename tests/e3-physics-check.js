(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  const M = Phaser.Physics.Matter.Matter;
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false; modalFlow.close();
  const checks = [], measurements = {};
  const assert = (value, name) => { if (!value) throw Error(`E3: ${name}`); checks.push(name); };
  const load = () => { scene.loadStage('e3'); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const step = seconds => { for (let i = 0; i < Math.ceil(seconds * 120); i++) scene.update(0, 1000 / 120); };
  const spawn = (x, y = 200, pose = 0) => {
    const body = scene.stageGame.createPerson.call(scene, x, y, pose);
    M.Composite.add(scene.stackWorld.world, body); scene.people.push(body); scene.stackBodyById.set(body.id, body);
    return body;
  };
  load();
  const center = spawn(480);
  assert(center.angularVelocity === 0, 'No artificial spin is added when a person is created');
  step(2.4);
  measurements.centerAngle = center.angle;
  assert(scene.stackGrounded.has(center.id), 'Mannequin finds physical support after landing');
  M.Body.setAngularVelocity(center, .1); scene.stageGame.measureTower.call(scene);
  assert(!scene.stackStable.has(center.id) && scene.state.height > 0, 'Supported rocking body still contributes height');
  assert(center.plugin.e3.towerTouched, 'A body is marked after first joining the supported tower');
  const goalTop = scene.stageGame.tuning.baseY - scene.stageGame.tuning.targetHeight - 4;
  M.Body.translate(center, { x: 0, y: goalTop - center.bounds.min.y });
  M.Engine.update(scene.stackWorld, 1000 / 120);
  scene.state.heightHoldArmed = true;
  scene.stageGame.measureTower.call(scene);
  assert(!scene.stackGrounded.has(center.id) && scene.state.height >= scene.stageGame.tuning.targetHeight,
    'A previously supported moving body keeps scoring while it remains above the line');
  const originalFinish = scene.finish, finishCalls = [];
  scene.finish = (success, detail) => finishCalls.push({ success, detail });
  scene.state.held = 0;
  for (let i = 0; i < Math.ceil((scene.stageGame.tuning.hold + .1) * 120); i++) {
    M.Body.setPosition(center, { x: 480 + Math.sin(i / 10) * 18, y: center.position.y + goalTop - center.bounds.min.y });
    M.Body.setVelocity(center, { x: Math.cos(i / 10) * .8, y: 0 });
    M.Body.setAngularVelocity(center, .08);
    scene.stageGame.update.call(scene, 1 / 120);
  }
  scene.finish = originalFinish;
  assert(finishCalls.some(call => call.success), 'Movement above the line for two seconds clears the stage');
  assert(center.parts.length > 8 && Number.isFinite(center.inertia) && center.inverseInertia > 0, 'Arms, torso, head and legs form a rotating compound body');
  load();
  // Just past the pedestal edge, wherever the pedestal currently ends.
  const edgeX = 480 + scene.stageGame.tuning.baseWidth / 2 + 9;
  const edge = spawn(edgeX); step(1);
  measurements.edgeAngle = edge.angle; measurements.edgeY = edge.position.y;
  assert(Math.abs(edge.angle) > .4 && !scene.stackGrounded.has(edge.id) && edge.position.y > scene.stageGame.tuning.floorY,
    'Off-center contact tips the mannequin off the pedestal');
  assert(scene.people.includes(edge) && !edge.isStatic, 'A tipped mannequin keeps falling as a free body');
  // There is no floor: whoever misses the pedestal drops past the screen and is gone for good.
  step(1.5);
  assert(!scene.people.includes(edge) && !scene.stackBodyById.has(edge.id) && !scene.stackGrounded.has(edge.id),
    'A mannequin that falls below the screen is removed from the world');
  const missed = spawn(edgeX + 70, 240, 1); step(3);
  assert(!scene.people.includes(missed) && scene.people.length === 0 && scene.state.height === 0, 'Nothing piles up beside the pedestal to stack on');
  load();
  const floating = spawn(480, 120); M.Body.setVelocity(floating, { x: 0, y: 0 });
  scene.stageGame.measureTower.call(scene);
  assert(scene.state.height === 0 && scene.state.held === 0, 'Unsupported body at rest in air cannot score height');
  load();
  scene.state.x = edgeX; scene.primaryAction(); step(.5); scene.state.x = edgeX + 7; scene.primaryAction();
  const speed = scene.stageGame.speed.call(scene); step(4);
  assert(scene.state.drops === 2 && scene.stageGame.speed.call(scene) === speed, 'A collapse still counts every drop, so the rail keeps its speed');
  load();
  const dropAngle = scene.state.nextAngle, dropX = scene.state.x, dropY = scene.state.spawnY;
  scene.primaryAction();
  const dropped = scene.people[0], origin = dropped.plugin.e3.origin;
  assert(Math.abs(dropAngle) === Math.PI / 2 && dropped.angle === dropAngle, 'Sideways preview is dropped at the same angle');
  assert(Math.hypot(dropped.position.x + origin.x * Math.cos(dropAngle) - origin.y * Math.sin(dropAngle) - dropX, dropped.position.y + origin.x * Math.sin(dropAngle) + origin.y * Math.cos(dropAngle) - dropY) < .001, 'Rotated body does not jump away from preview position');
  assert(scene.state.nextAngle !== dropAngle, 'Next person arrives with a different orientation');
  step(.2);
  const before = JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle })));
  archiveGame.pause(true); scene.update(0, 1500);
  assert(before === JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle }))), 'Pause freezes falling body and rotation');
  archiveGame.pause(false); step(.3);
  assert(before !== JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle }))), 'Resume continues physical fall');
  // The baked metcha poses drive both the collider and the picture, so check them together.
  const poses = scene.stageGame.poses;
  assert(poses.length === 8 && poses.every(p => scene.textures.exists(`e3:${p.id}`)), 'All eight baked pose images are loaded');
  assert(poses.every(p => p.parts.length >= 8 && p.parts.every(([, , w, h]) => w > 0 && h > 0)), 'Every pose carries solid rectangles cut from its own alpha');
  scene.stageGame.render.call(scene);
  const sprite = scene.assetSprites.get('person0');
  const dropped0 = poses[scene.people[0].plugin.e3.poseIndex];
  assert(sprite?.texture.key === `e3:${dropped0.id}`, 'Pose image is used by the real render path');
  assert(Math.abs(sprite.displayWidth - dropped0.width * scene.state.zoom) < .001 && Math.abs(sprite.displayHeight - dropped0.height * scene.state.zoom) < .001, 'Image is shown at the baked size, so picture and collider share one scale');
  const body = scene.people[0]; M.Body.setAngle(body, .63); scene.stageGame.render.call(scene);
  const o = body.plugin.e3.origin;
  const expected = scene.stageGame.project.call(scene, body.position.x + o.x * Math.cos(body.angle) - o.y * Math.sin(body.angle), body.position.y + o.x * Math.sin(body.angle) + o.y * Math.cos(body.angle));
  assert(Math.hypot(sprite.x - expected.x, sprite.y - expected.y) < .001 && Math.abs(sprite.rotation - body.angle) < .00001, 'Asset pivots around physical center of mass without drifting');
  scene.state.nextPose = 2; scene.stageGame.render.call(scene);
  const preview = scene.assetSprites.get('preview');
  assert(preview?.texture.key === `e3:${poses[2].id}` && Math.abs(preview.rotation - scene.state.nextAngle) < .00001, 'Preview shows the upcoming pose at its drop angle');
  // The goal marker is pinned to the right end of the success line and keeps its size as the view zooms out.
  const marker = scene.assetSprites.get('goalMark');
  const goalY = scene.stageGame.project.call(scene, 0, scene.stageGame.tuning.baseY - scene.stageGame.tuning.targetHeight).y;
  assert(marker?.texture.key === 'e3:line' && marker.visible, 'Success line marker uses the line asset');
  const dashTo = scene.stageGame.project.call(scene, scene.stageGame.tuning.railRight, 0).x;
  assert(marker.x === dashTo + scene.stageGame.tuning.markerGap && marker.x > dashTo && Math.abs(marker.y - goalY) < .001, 'Marker sits on the success line, to the right of its dashes');
  scene.state.zoom = .5; scene.stageGame.render.call(scene);
  const zoomedGoalY = scene.stageGame.project.call(scene, 0, scene.stageGame.tuning.baseY - scene.stageGame.tuning.targetHeight).y;
  assert(Math.abs(marker.y - zoomedGoalY) < .001 && Math.abs(marker.displayHeight - scene.stageGame.tuning.markerHeight) < .001, 'Marker follows the line but is not scaled by the camera zoom');
  scene.state.zoom = 1;
  // A pose without a picture hides the previous skin instead of leaving it behind.
  poses.push({ id: 'missing', name: '없음', width: 40, height: 40, parts: [[0, 0, 40, 40]] });
  scene.state.nextPose = poses.length - 1; scene.stageGame.render.call(scene);
  assert(preview && !preview.visible, 'Pose with no image hides the previous skin before falling back to shapes');
  poses.pop(); scene.state.nextPose = 0;
  const world = scene.stackWorld;
  scene.stopGame();
  assert(world.world.bodies.length === 0 && !world.events.collisionStart?.length && scene.stackBodyById.size === 0, 'Leaving e3 disposes bodies, collision listeners and maps');
  // Left/right input turns the waiting person instead of moving it: a tap steps, a hold keeps turning.
  load();
  const stepRad = scene.stageGame.tuning.spinStep * Math.PI / 180;
  const spinBase = scene.state.nextAngle;
  archiveGame.press('left');
  assert(Math.abs(scene.state.nextAngle - (spinBase - stepRad)) < 1e-9, 'A tap on the left turns the waiting person by one step');
  archiveGame.release('left'); step(.3);
  assert(scene.state.nextAngle === spinBase - stepRad, 'A released key stops turning it');
  archiveGame.press('right'); step(.4);
  const turnedBy = scene.state.nextAngle - (spinBase - stepRad);
  archiveGame.release('right');
  assert(turnedBy > stepRad * 1.5 && turnedBy <= stepRad + scene.stageGame.tuning.spinSpeed * Math.PI / 180 * .45, 'Holding the key keeps turning it, at the tuned speed');
  const aimed = scene.state.nextAngle;
  scene.primaryAction();
  assert(scene.people[0].angle === aimed, 'The person is dropped at the angle the player aimed for');
  assert(scene.state.nextAngle === scene.stageGame.tuning.dropAngles[1] * Math.PI / 180, 'The next person arrives at its own angle, not the aimed one');
  assert(Math.abs(scene.state.nextAngle) <= Math.PI, 'Turning keeps the shown angle inside half a turn');
  // The rail's own speed rides along with the drop, so a fast pass throws the person sideways.
  load();
  const railSpeed = scene.stageGame.speed.call(scene);
  scene.state.direction = 1; scene.state.x = 480;
  scene.primaryAction();
  const thrown = scene.people[0], startX = thrown.position.x;
  // Measure the drift the player actually sees (pixels per second), not Matter's internal units.
  step(.1);
  const drift = (thrown.position.x - startX) / .1;
  measurements.carriedDriftPerSecond = drift;
  measurements.railSpeed = railSpeed;
  assert(thrown.position.y < scene.stageGame.tuning.baseY, 'The measured drift happens while the body is still falling');
  assert(Math.abs(drift - railSpeed * scene.stageGame.tuning.carryMomentum) < railSpeed * .1, 'A dropped person keeps flying at the speed the rail was moving');
  load();
  scene.state.direction = -1; scene.state.x = 480; scene.state.drops = 6;
  scene.primaryAction();
  const fast = scene.people[0], fastStartX = fast.position.x;
  step(.1);
  const fastDrift = (fast.position.x - fastStartX) / .1;
  measurements.fastDriftPerSecond = fastDrift;
  assert(fastDrift < 0, 'The drift follows whichever way the rail was heading');
  assert(Math.abs(fastDrift) > Math.abs(drift) * 1.5, 'A rail sped up by earlier drops throws the person harder');
  // Cadence of the stand-in player below. The metcha poses are far slimmer than the old squat
  // mannequins, so a tower needs about a second to settle before the next body lands on it;
  // dropping faster than this just knocks over what is already standing.
  const DROP_GAP = 1;
  // A dropped person keeps the rail's sideways speed, so the stand-in player leads its aim by the
  // distance the body covers while it falls, the same way a person has to. The pedestal is wide,
  // so it aims like a person too: within about 20px of the middle, not to the pixel.
  const onTarget = () => {
    const t = scene.stageGame.tuning, s = scene.state, rail = scene.stageGame.speed.call(scene);
    const flight = Math.sqrt(2 * Math.max(40, t.baseY - s.height - s.spawnY) / (t.gravity * 1000));
    return Math.abs(s.x + s.direction * rail * t.carryMomentum * flight - 480) < Math.max(20, rail / 90);
  };
  // Break a real tower during its countdown: partial hold must not carry over.
  load();
  let lastPartial = -10;
  for (let i = 0; i < 2400 && scene.playable() && scene.state.held < 1; i++) {
    if (onTarget() && scene.elapsed - lastPartial > DROP_GAP && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); lastPartial = scene.elapsed; }
    scene.update(0, 1000 / 120);
  }
  assert(scene.state.held >= 1 && scene.state.held < scene.stageGame.tuning.hold && scene.playable(), 'Reaching target for one second does not clear');
  const partialHold = scene.state.held;
  archiveGame.pause(true); scene.update(0, 1500);
  assert(scene.state.held === partialHold, 'Pause freezes the target-height countdown');
  archiveGame.pause(false);
  scene.people.forEach(body => M.Body.translate(body, { x: 2200, y: 0 })); step(.1);
  assert(scene.state.held === 0 && scene.state.height === 0 && scene.playable(), 'Loss of supported target height resets countdown');
  // Prepare a real-input tower for the focused visual preview.
  load();
  let last = -10;
  for (let i = 0; i < 2432 && scene.playable(); i++) {
    if (onTarget() && scene.elapsed - last > DROP_GAP && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); last = scene.elapsed; }
    scene.update(0, 1000 / 120);
  }
  measurements.clearTime = scene.elapsed;
  measurements.drops = scene.state.drops;
  measurements.touchedAtClear = scene.people.filter(body => body.plugin.e3.towerTouched).length;
  assert(scene.mode === 'done' && scene.state.held >= scene.stageGame.tuning.hold
    && scene.state.held < scene.stageGame.tuning.hold + .02
    && scene.state.height >= scene.stageGame.tuning.targetHeight && measurements.touchedAtClear >= 3,
  'Rotated people clear only after the configured continuous hold at target within 20.26 seconds');
  return { passed: checks.length, checks, measurements };
})()
