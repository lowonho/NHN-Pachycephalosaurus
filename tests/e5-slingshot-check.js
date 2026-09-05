(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  const M = Phaser.Physics.Matter.Matter;
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const load = () => { scene.loadStage('e5'); scene.startStage(); scene.settings = { effects: true, shake: false }; };
  const advance = seconds => { for (let i = 0; i < seconds * 120 && scene.playable(); i++) scene.update(0, 1000 / 120); };
  const impact = (power, speed) => {
    scene.pointerAction(164, 382); scene.stageGame.pointerMove.call(scene, 64, 426); scene.stageGame.pointerUp.call(scene);
    const shot = scene.state.balls[0], target = scene.state.timbers[0];
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
  let hit = impact(.55, 450); advance(.025);
  assert(hit.target.hp > 0 && hit.target.hp < 65, 'Weak shot hits the post without instantly deleting it');
  advance(2);
  assert(Math.abs(hit.target.body.position.x - postX) > 5, 'Shot physically pushes the supporting post');
  assert(scene.state.timbers[6].body.position.y > roofY + 8 || Math.abs(scene.state.timbers[6].angle) > .1, 'Moving the post destabilizes the upper structure');
  assert(scene.state.targets.some(o => o.hp < 100), 'Falling building damages the cookie residents');
  assert(M.Composite.allBodies(scene.slingWorld.world).includes(hit.target.body), 'Timber remains as physical rubble');
  const oldWorld = scene.slingWorld;
  load();
  assert(M.Composite.allBodies(oldWorld.world).length === 0, 'Restart disposes previous physics world');
  hit = impact(1, 850); advance(.025);
  assert(hit.target.hp === 0 && hit.shot.body.velocity.x > 0, 'Strong initial shot pierces and keeps travelling');
  load(); advance(1);
  const base = scene.state.targets[0];
  M.Body.setAngle(base.body, .15); advance(.06);
  assert(base.hp === 100, 'Small brief wobble is not counted as collapse');
  load();
  scene.pointerAction(164, 382); scene.stageGame.pointerMove.call(scene, -1000, 1000);
  assert(Math.hypot(scene.state.drag.x - 164, scene.state.drag.y - 382) <= scene.stageGame.tuning.maxPull + .001, 'Pull length is capped');
  scene.clearInput(); scene.stageGame.pointerUp.call(scene);
  assert(scene.state.shots === 0, 'Cancelled aim does not fire');
  impact(.55, 450);
  scene.pausedByMenu = true; const x = scene.state.balls[0].body.position.x; scene.update(0, 500);
  assert(scene.state.balls[0].body.position.x === x, 'Pause freezes physical bodies');
  load();
  scene.state.shots = 10;
  assert(scene.stageGame.power.call(scene) < scene.stageGame.tuning.piercePower, 'Late shots cannot use early piercing power');
  const lateShot = angle => {
    load(); scene.state.shots = 8;
    // Last-house scenario: the closer house have already been cleared.
    for (const wood of scene.state.timbers.slice(0, 7)) { wood.hp = 0; M.Composite.remove(scene.slingWorld.world, wood.body); }
    for (const cookie of scene.state.targets.slice(0, 2)) { cookie.hp = 0; M.Composite.remove(scene.slingWorld.world, cookie.body); }
    const pull = scene.stageGame.tuning.maxPull;
    scene.pointerAction(164, 382);
    scene.stageGame.pointerMove.call(scene, 164 - Math.cos(angle) * pull, 382 + Math.sin(angle) * pull);
    scene.stageGame.pointerUp.call(scene);
    return scene.state.balls[0];
  };
  let late = lateShot(.15);
  while (scene.playable() && late.age < 2 && late.y < 456) advance(1 / 120);
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
  assert(scene.state.timbers.slice(7).some(o => o.hp < 65), 'Low-tension roof hit physically damages the house');
  scene.stopGame();
  assert(scene.slingWorld === null, 'Leaving scene disposes physics');
  return { passed: checks.length, checks };
})()
