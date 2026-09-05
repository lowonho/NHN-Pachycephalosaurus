(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false;
  const checks = [], transfers = [];
  const assert = (value, label) => { if (!value) throw Error(label); checks.push(label); };
  const load = () => { scene.loadStage('e8'); scene.startStage(); scene.settings = { shake:false, effects:false }; };
  load();
  const game = scene.stageGame, angle = game.tuning.startAngle;
  assert(Math.abs(scene.state.rope.theta + 1.0) < .001, 'First swing starts 57 degrees behind the anchor');
  const bottomSpeed = theta => {
    game.tuning.startAngle = theta; load();
    for(let i=0;i<240 && scene.state.rope.theta<0;i++) scene.update(0,1000/120);
    return Math.hypot(scene.state.vx,scene.state.vy);
  };
  let before, after;
  try { before = bottomSpeed(-.7); after = bottomSpeed(angle); }
  finally { game.tuning.startAngle = angle; }
  assert(after > before * 1.2, 'Larger starting arc adds at least 20 percent speed at the bottom');
  for(const releaseAngle of [.4,.45,.5,.55,.6,.65]) {
    load(); const log = driveE8(3,{reactionFrames:6,releaseAngle});
    assert(log.some(item=>item.anchor===1) && scene.state.deaths===0, 'First transfer succeeds without falling at release angle '+releaseAngle);
    transfers.push({releaseAngle,firstTransfer:log.find(item=>item.anchor===1)?.at});
  }
  for(const options of [{},{releaseAngle:.6},{reactionFrames:10,releaseAngle:.45},{reactionFrames:10,releaseAngle:.5}]) {
    load(); driveE8(20.3,options);
    assert(scene.mode==='done' && scene.state.x>=scene.goalX && scene.state.deaths===0, 'Full course clears without falls '+JSON.stringify(options));
  }
  load(); scene.state.checkpoint=1; game.fall.call(scene);
  assert(scene.state.rope.theta===-.7, 'Later checkpoint respawn keeps its existing angle');
  load();
  assert(scene.state.rope.theta===angle, 'Fresh attempt restores the wider start angle');
  return {checks,bottomSpeed:{before,after},transfers};
})()
