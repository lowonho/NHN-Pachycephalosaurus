(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active=false;
  const checks=[];
  const assert=(value,name)=>{if(!value)throw Error(name);checks.push(name);};
  const load=()=>{scene.loadStage('e9');scene.startStage();scene.settings={shake:false,effects:false};};
  const advance=seconds=>{for(let i=0;i<Math.ceil(seconds*120)&&scene.playable();i++)scene.update(0,1000/120);};
  const shoot=(x,y)=>{scene.pointerAction(scene.state.x,scene.state.y);scene.stageGame.pointerMove.call(scene,x,y);scene.stageGame.pointerUp.call(scene);};
  load();
  for(let shot=1;shot<=4;shot++) {
    shoot(scene.state.x-16,scene.state.y);advance(1.6);
    assert(scene.state.failures===shot&&!scene.state.moving&&scene.playable(), 'Miss '+shot+' returns an interactive stone');
  }
  const time=scene.remaining;advance(.1);
  assert(scene.remaining<time,'Timer continues after multiple throws');
  load();shoot(36,361);advance(3);
  assert(scene.state.failures===1&&!scene.state.moving&&scene.playable(),'Out-of-bounds first throw respawns');
  shoot(150,361);advance(1.6);
  assert(scene.state.failures===2,'Can throw again after out-of-bounds first throw');
  load();
  const dx=scene.target.x-scene.state.x,dy=scene.target.y-scene.state.y,distance=Math.hypot(dx,dy);
  const pull=Math.sqrt(2*scene.stageGame.friction.call(scene)*distance)/scene.stageGame.tuning.force;
  shoot(scene.state.x-dx/distance*pull,scene.state.y-dy/distance*pull);advance(5);
  assert(scene.mode==='done'&&scene.state.hold>=.2,'First successful throw completes normally');
  return checks;
})()
