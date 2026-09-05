(async () => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  const checks = [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (value, label, detail = '') => {
    if (!value) throw Error(`${label}${detail ? `: ${detail}` : ''}`);
    checks.push(label);
  };
  const load = id => {
    scene.stopGame();
    scene.loadStage(id);
    scene.startStage();
    scene.settings = { shake: false, effects: false };
    archiveAudio.stopSfx();
  };
  const played = async (key, label) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const sounds = archiveAudio.sfxPools.get(key) ?? [];
      if (sounds.some(sound => sound.currentTime > 0 || sound.error)) break;
      await delay(50);
    }
    const pool = archiveAudio.sfxPools.get(key) ?? [];
    const state = pool.map(sound => ({ paused: sound.paused, time: sound.currentTime, volume: sound.volume, error: sound.error?.code ?? null }));
    assert(archiveAudio.lastSfx.has(key) && state.some(sound => sound.time > 0 && sound.volume > 0 && !sound.error), label, JSON.stringify(state));
  };

  archivePhaserGame.loop.sleep();
  archiveGameBridge.active = false;
  audioBus.setMuted(false);
  audioBus.setChannelMuted('sfx', false);
  audioBus.setVolume('master', Math.max(.8, audioBus.volumes.master));
  audioBus.setVolume('sfx', Math.max(.9, audioBus.volumes.sfx));

  load('e1'); scene.primaryAction(); await played('sfxE1GravityFlip', 'E1 gravity flip');

  load('e2'); scene.primaryAction(); await played('sfxE2WaxJump', 'E2 jump');
  archiveAudio.stopSfx();
  const originalRandom = Math.random;
  Math.random = () => .1; scene.stageGame.playWaxCrack.call(scene, 'land', 620);
  await played('sfxE2WaxCrack1', 'E2 landing crack 1');
  archiveAudio.stopSfx();
  Math.random = () => .9; scene.stageGame.playWaxCrack.call(scene, 'land', 620);
  await played('sfxE2WaxCrack2', 'E2 landing crack 2');
  Math.random = originalRandom;
  archiveAudio.stopSfx();
  const crumble = scene.platforms.find(platform => platform.kind === 'crumble');
  crumble.crumbleLeft = .001; scene.stageGame.update.call(scene, .01);
  await played('sfxE2WaxDrop', 'E2 platform crumble');

  load('e3'); scene.primaryAction();
  assert(archiveAudio.lastSfx.has('action'), 'E3 original drop tone');
  archiveAudio.stopSfx();
  const body = scene.people[0], Matter = Phaser.Physics.Matter.Matter;
  Matter.Body.translate(body, { x: 0, y: 2000 }); scene.stageGame.cullFallen.call(scene);
  await played('sfxE3PersonFall', 'E3 bottom fall whistle');
  archiveAudio.stopSfx();
  scene.state.height = scene.stageGame.tuning.targetHeight; scene.stageGame.updateCountdown.call(scene, .1);
  await played('sfxE3SuccessCount', 'E3 goal hold count');

  load('e4'); scene.touch.add('right'); scene.stageGame.update.call(scene, .05);
  await played('sfxE4Walk1', 'E4 footstep 1');
  archiveAudio.stopSfx(); scene.state.footstepLeft = 0; scene.stageGame.update.call(scene, .05);
  await played('sfxE4Walk2', 'E4 footstep 2');
  assert(!archiveAudio.lastSfx.has('sfxE4Brake'), 'E4 braking stays silent');
  archiveAudio.stopSfx(); scene.touch.clear(); scene.elapsed = 4; scene.stageGame.update.call(scene, .01);
  await played('sfxE4TigerSlow', 'E4 tiger walk loop');
  archiveAudio.stopSfx(); scene.state.tiger.soundGait = null; scene.elapsed = 8; scene.stageGame.update.call(scene, .01);
  await played('sfxE4TigerFast', 'E4 tiger run loop');

  load('e5'); scene.stageGame.pointerDown.call(scene, 164, 418);
  await played('sfxE5RubberStretch', 'E5 slingshot stretch');
  archiveAudio.stopSfx(); scene.stageGame.pointerMove.call(scene, 85, 465); scene.stageGame.pointerUp.call(scene);
  await played('sfxE5Release', 'E5 slingshot release');
  archiveAudio.stopSfx(); Math.random = () => .1; scene.stageGame.damage.call(scene, scene.state.timbers[0], 20);
  await played('sfxE5Broken1', 'E5 target hit 1');
  archiveAudio.stopSfx(); Math.random = () => .9; scene.stageGame.damage.call(scene, scene.state.targets[0], 20);
  await played('sfxE5Broken2', 'E5 target hit 2');
  Math.random = originalRandom;
  assert(!archiveAudio.lastSfx.has('sfxDubaiStretch'), 'E5 obsolete hit sound stays unused');

  load('e6'); scene.primaryAction(); await played('sfxE6Lift1', 'E6 lift 1');
  archiveAudio.stopSfx(); scene.primaryAction(); await played('sfxE6Lift2', 'E6 lift 2');

  load('e7'); scene.stageGame.pointerDown.call(scene, 620, 321);
  scene.stageGame.pointerMove.call(scene, 480, 461); scene.stageGame.pointerUp.call(scene);
  await played('sfxE7Start', 'E7 roulette start');
  archiveAudio.stopSfx(); scene.stageGame.update.call(scene, .01); scene.stageGame.update.call(scene, .1);
  await played('sfxE7Tick', 'E7 roulette tick');

  load('e8'); scene.state.rope.starter = false; scene.primaryAction();
  await played('sfxE8WebAttach', 'E8 web attach');

  load('e10'); scene.primaryAction(); await played('sfxE10Jump', 'E10 jump 1');
  archiveAudio.stopSfx();
  for (let i = 0; i < 140 && !scene.state.grounded; i++) scene.stageGame.update.call(scene, 1 / 120);
  assert(scene.state.grounded, 'E10 first jump lands');
  scene.primaryAction(); await played('sfxE10Jump', 'E10 jump 2');
  archiveAudio.stopSfx();
  scene.stageGame.enterDigit.call(scene, '1');
  await played('sfxE10TouchNumber', 'E10 number touch');
  assert((archiveAudio.sfxPools.get('sfxE10TouchNumber') ?? []).some(sound => sound._archiveGain === .62), 'E10 number touch uses balanced volume');
  archiveAudio.stopSfx(); scene.state.input = '';
  scene.stageGame.enterDigit.call(scene, '0'); scene.stageGame.enterDigit.call(scene, '0');
  scene.stageGame.enterDigit.call(scene, '0'); scene.stageGame.enterDigit.call(scene, '0');
  await played('sfxE10DigitWrong', 'E10 wrong code');
  assert(archiveAudio.lastSfx.has('sfxE10TouchNumber'), 'E10 wrong fourth number also plays touch sound');
  assert((archiveAudio.sfxPools.get('sfxE10DigitWrong') ?? []).some(sound => sound._archiveGain === .34), 'E10 wrong-code volume is reduced');
  load('e10'); archiveAudio.stopSfx(); scene.state.input = scene.state.target.slice(0, 3);
  scene.stageGame.enterDigit.call(scene, scene.state.target[3]);
  await played('sfxE10TouchNumber', 'E10 correct fourth number touch');
  assert(scene.mode === 'done', 'E10 correct fourth number still clears after touch sound');
  load('e10'); archiveAudio.stopSfx(); Object.assign(scene.state, { x: 925, vx: 300 }); scene.stageGame.update.call(scene, .05);
  assert(!archiveAudio.lastSfx.has('sfxPenaltyHit'), 'E10 wall bounce stays silent');

  scene.stopGame(); scene.loadStage('e1'); archiveAudio.stopSfx(); scene.startStage();
  await played('sfxClick', 'Common stage start click');
  archiveAudio.stopSfx(); scene.bump();
  await played('sfxPenaltyHit', 'Common collision penalty');
  archiveAudio.stopSfx(); gameEvents.emit(GAME_EVENTS.STAGE_RESPAWN, {});
  await played('sfxCharacterRevival', 'Common revival');
  archiveAudio.stopSfx(); gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {});
  await played('sfxTimerWarning', 'Common timer warning');
  load('e1'); scene.finish(true); await played('sfxStageClear', 'Common stage clear');
  load('e1'); scene.finish(false); await played('sfxStageFail', 'Common stage fail');

  archivePhaserGame.loop.wake();
  return checks;
})()
