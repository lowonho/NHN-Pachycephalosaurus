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
  const center = spawn(480); step(2.4);
  measurements.centerAngle = center.angle;
  assert(scene.stackStable.has(center.id), 'Centered mannequin settles on pedestal');
  assert(Math.abs(center.angle) < .08, 'Centered mannequin does not receive artificial rotation');
  assert(center.parts.length > 8 && Number.isFinite(center.inertia) && center.inverseInertia > 0, 'Arms, torso, head and legs form a rotating compound body');
  assert(!M.Query.point(center.parts.slice(1), { x: 480, y: center.bounds.max.y - 3 }).length, 'Gap between feet remains empty collision space');
  load();
  const edge = spawn(558); step(3.5);
  measurements.edgeAngle = edge.angle; measurements.edgeY = edge.position.y;
  assert(Math.abs(edge.angle) > .4 && edge.position.y > 425, 'Off-center contact naturally topples mannequin onto floor');
  assert(scene.people.includes(edge) && !edge.isStatic, 'Toppled mannequin remains dynamic debris');
  const oldAngle = edge.angle;
  const incoming = spawn(edge.position.x + 14, 240, 1); step(2.8);
  assert(scene.stackGrounded.has(incoming.id), 'New mannequin can rest on fallen debris');
  assert(Math.abs(edge.angle - oldAngle) > .002 || scene.stackWorld.pairs.list.some(p => p.isActive && [p.collision.parentA.id,p.collision.parentB.id].includes(incoming.id) && [p.collision.parentA.id,p.collision.parentB.id].includes(edge.id)), 'Debris participates in subsequent contacts');
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
  // Prepare a real-input tower for the focused visual preview.
  load();
  let last = -10;
  for (let i = 0; i < 1200 && scene.playable(); i++) {
    if (Math.abs(scene.state.x - 480) < 3 && scene.elapsed - last > .7 && scene.people.length < 3) { scene.primaryAction(); last = scene.elapsed; }
    scene.update(0, 1000 / 120);
  }
  measurements.clearTime = scene.elapsed;
  assert(scene.mode === 'done' && scene.state.held >= .7 && scene.state.stableCount >= 3, 'Three poses can form a supported stable tower within 20.26 seconds');
  return { passed: checks.length, checks, measurements };
})()
