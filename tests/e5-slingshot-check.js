(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  const M = Phaser.Physics.Matter.Matter;
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const load = () => { scene.loadStage('e5'); scene.startStage(); scene.settings = { effects: true, shake: false }; };
  const advance = seconds => { for (let i = 0; i < seconds * 120 && scene.playable(); i++) scene.update(0, 1000 / 120); };
  const impact = (power, speed) => {
    while (scene.state.waiting && scene.playable()) advance(1 / 120);
    assert(scene.playable(), 'Scene settles before time runs out');
    scene.pointerAction(164, 418); scene.stageGame.pointerMove.call(scene, 64, 462); scene.stageGame.pointerUp.call(scene);
    const shot = scene.state.balls[scene.state.balls.length - 1], target = scene.state.timbers[0];
    shot.power = power;
    M.Body.setPosition(shot.body, { x: target.x - 15, y: target.y + 12 });
    M.Body.setVelocity(shot.body, { x: speed / 60, y: 0 });
    return { shot, target };
  };
  load(); advance(2);
  assert(scene.state.targets.length === 4 && scene.state.timbers.length === 14, 'Four residents live inside two two-storey timber houses');
  assert(scene.state.targets.every(o => o.hp === 100) && scene.state.timbers.every(o => Math.abs(o.angle) < .04), 'Houses remain stable without input');
  const roofY = scene.state.timbers[6].body.position.y;
  const postX = scene.state.timbers[0].body.position.x;
  let hit = impact(1, 400); advance(.025);
  assert(hit.target.hp > 0 && hit.target.hp < scene.stageGame.tuning.woodHP, 'First moderate impact cracks wood without piercing');
  advance(1);
  assert(scene.state.targets.every(o=>o.hp===100), 'Residents survive the first post impact');
  assert(hit.target.joints.length > 0, 'Joints retain the structure while timber is intact');
  assert(hit.target.joints.every(j=>j.stiffness < scene.stageGame.tuning.jointStiffness), 'Damage progressively softens the joints');
  const jointCount = M.Composite.allConstraints(scene.slingWorld.world).length;
  hit = impact(.95, 800); advance(.04);
  assert(hit.target.hp === 0, 'Second solid hit breaks the softened post');
  assert(M.Composite.allConstraints(scene.slingWorld.world).length < jointCount, 'Broken post releases its structural joints');
  assert(scene.state.timbers.slice(0, 7).every(o => o.joints.length === 0), 'Broken foundation releases the entire house frame');
  assert(scene.state.timbers.slice(7).every(o => o.joints.length > 0), 'Other house keeps its structural joints');
  advance(2);
  assert(scene.state.timbers[6].body.position.y > roofY + 8 || Math.abs(scene.state.timbers[6].angle) > .1, 'Repeated post impacts destabilize the upper structure');
  assert(M.Composite.allBodies(scene.slingWorld.world).includes(hit.target.body), 'Broken timber remains as physical rubble');
  assert(hit.target.body.bounds.max.y - hit.target.body.bounds.min.y < 55, 'Broken post no longer remains a full-height support');
  const oldWorld = scene.slingWorld;
  load();
  assert(M.Composite.allBodies(oldWorld.world).length === 0, 'Restart disposes previous physics world');
  scene.state.timbers[0].hp = 30;
  hit = impact(1, 850); advance(.025);
  assert(hit.target.hp === 0 && hit.shot.body.velocity.x > 0, 'Strong shot pierces already weakened wood');
  load(); advance(2);
  hit = impact(1, 850); advance(1);
  assert(hit.target.hp === 0 && hit.target.joints.length === 0, 'Strong base hit buckles the damaged post instead of springing upright');
  load(); advance(1);
  const base = scene.state.targets[0];
  M.Body.setAngle(base.body, .15); advance(.06);
  assert(base.hp === 100, 'Small brief wobble is not counted as collapse');
  const post = scene.state.timbers[0];
  scene.stageGame.damage.call(scene, post, 30);
  assert(post.hp === 30, 'A moderate solid hit leaves half the post strength');
  scene.stageGame.damage.call(scene, post, 30);
  assert(post.hp === 0, 'Two moderate solid hits destroy the post');
  scene.stageGame.damage.call(scene, base, 100);
  assert(!M.Composite.allBodies(scene.slingWorld.world).includes(base.body), 'Destroyed cookie is removed from physics');
  assert(!scene.assetSprites.has('target0'), 'Destroyed cookie leaves no actor sprite');
  load();
  scene.pointerAction(164, 418); scene.stageGame.pointerMove.call(scene, -1000, 1000);
  assert(Math.hypot(scene.state.drag.x - 164, scene.state.drag.y - 418) <= scene.stageGame.tuning.maxPull + .001, 'Pull length is capped');
  scene.clearInput(); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.shots === 0, 'Cancelled aim does not fire');
  impact(.55, 450);
  scene.pausedByMenu = true; const x = scene.state.balls[0].body.position.x; scene.update(0, 500);
  assert(scene.state.balls[0].body.position.x === x, 'Pause freezes physical bodies');
  load();
  scene.state.shots = 10;
  assert(scene.stageGame.power.call(scene) < scene.stageGame.tuning.piercePower, 'Late shots cannot use early piercing power');
  load();
  scene.pointerAction(164,418); scene.stageGame.pointerMove.call(scene,64,462); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.waiting, 'Launch immediately locks reloading');
  scene.pointerAction(164,418);
  assert(scene.state.drag === null && scene.state.shots === 1, 'Input cannot prepare another shot during motion');
  advance(1.4);
  assert(scene.state.waiting, 'Cannot reload before 1.5 seconds');
  scene.pausedByMenu = true;
  const remaining = scene.state.cooldown; scene.update(0, 500);
  assert(scene.state.cooldown === remaining, 'Pause freezes reload countdown');
  scene.pausedByMenu = false;
  const movingBall = scene.state.balls[0];
  if (movingBall) {
    M.Body.setPosition(movingBall.body, { x: 300, y: 216 });
    M.Body.setVelocity(movingBall.body, { x: 3, y: -3 });
  }
  advance(.1);
  assert(!scene.state.waiting, 'Reload unlocks at 1.5 seconds regardless of motion');
  scene.pointerAction(164,418);
  assert(Boolean(scene.state.drag), 'Next shot accepts input as soon as it is ready');
  load();
  assert(!scene.state.waiting && scene.state.cooldown === 0, 'Restart clears the pending reload');
  const lateShot = angle => {
    load(); scene.state.shots = 8;
    // Last-house scenario: the closer house have already been cleared.
    for (const wood of scene.state.timbers.slice(0, 7)) { wood.hp = 0; M.Composite.remove(scene.slingWorld.world, wood.body); }
    for (const cookie of scene.state.targets.slice(0, 2)) { cookie.hp = 0; M.Composite.remove(scene.slingWorld.world, cookie.body); }
    const pull = scene.stageGame.tuning.maxPull;
    scene.pointerAction(164, 418);
    scene.stageGame.pointerMove.call(scene, 164 - Math.cos(angle) * pull, 418 + Math.sin(angle) * pull);
    scene.stageGame.pointerUp.call(scene);
    return scene.state.balls[0];
  };
  load();
  scene.pointerAction(164,418); scene.stageGame.pointerMove.call(scene,64,462); scene.stageGame.pointerUp.call(scene);
  const floorBall = scene.state.balls[0];
  M.Body.setPosition(floorBall.body, { x: 300, y: 491 });
  M.Body.setVelocity(floorBall.body, { x: 3, y: 2 });
  advance(.2);
  assert(scene.state.balls.length === 0 && !M.Composite.allBodies(scene.slingWorld.world).includes(floorBall.body), 'Ground impact removes the rolling ball within 0.2 seconds');
  advance(1.3);
  assert(!scene.state.waiting, 'A missed ground shot reloads after 1.5 seconds');
  load();
  scene.pointerAction(164,418); scene.stageGame.pointerMove.call(scene,64,462); scene.stageGame.pointerUp.call(scene);
  const apexBall = scene.state.balls[0];
  M.Body.setPosition(apexBall.body, { x: 300, y: 266 });
  M.Body.setVelocity(apexBall.body, { x: 0, y: 0 });
  advance(.2);
  assert(scene.state.balls.includes(apexBall), 'A slow untouched ball at its apex is not discarded');
  apexBall.hit.add(scene.state.timbers[0]); M.Sleeping.set(apexBall.body,true);
  advance(.2);
  assert(scene.state.balls.length === 0, 'A spent resting projectile is removed promptly');
  let late = lateShot(.15);
  while (scene.playable() && late.age < 2 && late.y < 492) advance(1 / 120);
  assert(late.x < 660 && late.hit.size === 0, 'Late low shot falls short of the last house');
  late = lateShot(.78);
  let downwardRoofHit = false;
  for (let i = 0; i < 300 && scene.playable(); i++) {
    const descending = late.vy > 0;
    const hitCount = late.hit.size;
    advance(1 / 120);
    if (descending && late.hit.size > hitCount && [...late.hit].some(o => o.roof)) downwardRoofHit = true;
  }
  assert(downwardRoofHit, 'Late lofted shot still reaches the last roof');
  assert(scene.state.timbers.slice(7).some(o => o.hp < scene.stageGame.tuning.woodHP), 'Low-tension roof hit physically damages the house');
  // 마지막 0.06초에 목표를 모두 파괴해도 1초 결과 연출 때문에 기록 시간이 제한을
  // 넘어가서는 안 된다. 그러면 기록 저장 예외 뒤에 결과창 없이 mode만 done으로 남는다.
  load();
  let lateClear = null;
  const onLateClear = event => { lateClear = event.detail; };
  window.addEventListener('archive-stage-end', onLateClear);
  scene.elapsed = scene.timeLimit - .06; scene.remaining = .06; scene.accumulator = 0;
  scene.state.targets.forEach(target => { target.hp = 0; M.Composite.remove(scene.slingWorld.world, target.body); });
  advance(1.2);
  window.removeEventListener('archive-stage-end', onLateClear);
  assert(scene.mode === 'done' && lateClear?.success && lateClear.elapsed <= scene.timeLimit
    && Math.abs(lateClear.elapsed - scene.state.frozenElapsed) < .00001,
  'A clear in the final fraction of a second keeps a valid record time and reaches stage end');
  scene.stopGame();
  assert(scene.slingWorld === null, 'Leaving scene disposes physics');
  return { passed: checks.length, checks };
})()
