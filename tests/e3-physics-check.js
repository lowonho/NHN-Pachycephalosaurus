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
  assert(center.angularVelocity === 0, 'No artificial spin is added when a bent pose is created');
  step(2.4);
  measurements.centerAngle = center.angle;
  assert(scene.stackGrounded.has(center.id), 'Bent mannequin finds physical support after landing');
  M.Body.setAngularVelocity(center, .1); scene.stageGame.measureTower.call(scene);
  assert(!scene.stackStable.has(center.id) && scene.state.height > 0, 'Supported rocking body still contributes height');
  assert(center.parts.length > 8 && Number.isFinite(center.inertia) && center.inverseInertia > 0, 'Arms, torso, head and legs form a rotating compound body');
  load();
  const edge = spawn(558); step(3.5);
  measurements.edgeAngle = edge.angle; measurements.edgeY = edge.position.y;
  assert(Math.abs(edge.angle) > .4 && edge.position.y > 425, 'Off-center contact naturally topples mannequin onto floor');
  assert(scene.people.includes(edge) && !edge.isStatic, 'Toppled mannequin remains dynamic debris');
  const incoming = spawn(edge.position.x, 240, 1);
  let contactedDebris = false;
  const observeContact = event => { contactedDebris ||= event.pairs.some(p => [p.collision.parentA.id,p.collision.parentB.id].includes(incoming.id) && [p.collision.parentA.id,p.collision.parentB.id].includes(edge.id)); };
  M.Events.on(scene.stackWorld, 'collisionStart', observeContact); step(2.8);
  M.Events.off(scene.stackWorld, 'collisionStart', observeContact);
  assert(scene.stackGrounded.has(incoming.id), 'New mannequin finds support after falling onto debris');
  assert(contactedDebris, 'Debris collides with subsequently dropped bodies');
  load();
  const floating = spawn(480, 120); M.Body.setVelocity(floating, { x: 0, y: 0 });
  scene.stageGame.measureTower.call(scene);
  assert(scene.state.height === 0 && scene.state.held === 0, 'Unsupported body at rest in air cannot score height');
  load();
  scene.state.x = 558; scene.primaryAction(); step(.5); scene.state.x = 565; scene.primaryAction();
  const speed = scene.stageGame.speed.call(scene); step(4);
  assert(scene.state.drops === 2 && scene.stageGame.speed.call(scene) === speed && scene.people.length === 2, 'Collapse retains every person and accumulated speed');
  load();
  scene.primaryAction(); step(.2);
  const before = JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle })));
  archiveGame.pause(true); scene.update(0, 1500);
  assert(before === JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle }))), 'Pause freezes falling body and rotation');
  archiveGame.pause(false); step(.3);
  assert(before !== JSON.stringify(scene.people.map(b => ({ p: b.position, a: b.angle }))), 'Resume continues physical fall');
  // Synthetic skin checks exercise the real texture branch, including pose replacement and pivot.
  const skin = document.createElement('canvas'); skin.width = 94; skin.height = 88;
  skin.getContext('2d').fillRect(20, 10, 50, 60);
  scene.textures.addCanvas('e3:person_crouch', skin);
  scene.stageGame.render.call(scene);
  const sprite = scene.assetSprites.get('person0');
  assert(sprite?.texture.key === 'e3:person_crouch', 'Pose-specific asset is used by real render path');
  const body = scene.people[0]; M.Body.setAngle(body, .63); scene.stageGame.render.call(scene);
  const o = body.plugin.e3.origin;
  const expected = scene.stageGame.project.call(scene, body.position.x + o.x * Math.cos(body.angle) - o.y * Math.sin(body.angle), body.position.y + o.x * Math.sin(body.angle) + o.y * Math.cos(body.angle));
  assert(Math.hypot(sprite.x - expected.x, sprite.y - expected.y) < .001 && Math.abs(sprite.rotation - body.angle) < .00001, 'Asset pivots around physical center of mass without drifting');
  scene.state.nextPose = 0; scene.stageGame.render.call(scene);
  const preview = scene.assetSprites.get('preview');
  scene.state.nextPose = 1; scene.stageGame.render.call(scene);
  assert(preview && !preview.visible, 'Missing next-pose asset hides previous skin before fallback');
  const world = scene.stackWorld;
  scene.stopGame();
  assert(world.world.bodies.length === 0 && !world.events.collisionStart?.length && scene.stackBodyById.size === 0, 'Leaving e3 disposes bodies, collision listeners and maps');
  scene.textures.remove('e3:person_crouch');
  // Break a real tower during its countdown: partial hold must not carry over.
  load();
  let lastPartial = -10;
  for (let i = 0; i < 2400 && scene.playable() && scene.state.held < 1; i++) {
    if (Math.abs(scene.state.x - 480) < 3 && scene.elapsed - lastPartial > .7 && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); lastPartial = scene.elapsed; }
    scene.update(0, 1000 / 120);
  }
  assert(scene.state.held >= 1 && scene.playable(), 'Reaching target for one second does not clear');
  const partialHold = scene.state.held;
  archiveGame.pause(true); scene.update(0, 1500);
  assert(scene.state.held === partialHold, 'Pause freezes the three-second countdown');
  archiveGame.pause(false);
  scene.people.forEach(body => M.Body.translate(body, { x: 2200, y: 0 })); step(.1);
  assert(scene.state.held === 0 && scene.state.height === 0 && scene.playable(), 'Loss of supported target height resets countdown');
  // Prepare a real-input tower for the focused visual preview.
  load();
  let last = -10;
  for (let i = 0; i < 2432 && scene.playable(); i++) {
    if (Math.abs(scene.state.x - 480) < 3 && scene.elapsed - last > .7 && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); last = scene.elapsed; }
    scene.update(0, 1000 / 120);
  }
  measurements.clearTime = scene.elapsed;
  measurements.drops = scene.state.drops;
  assert(scene.mode === 'done' && scene.state.held >= 3 && scene.state.held < 3.02 && scene.state.groundedCount >= 3, 'Bent poses clear only after three continuous seconds at target within 20.26 seconds');
  return { passed: checks.length, checks, measurements };
})()
