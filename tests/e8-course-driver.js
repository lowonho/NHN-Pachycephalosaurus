// Input-only web transfers, sampled every 50ms. No position or velocity edits.
window.driveE8 = (seconds = 20.3, { reactionFrames = 6, releaseAngle = .55, catchDistance = Infinity } = {}) => {
 const scene = archivePhaserGame.scene.getScene('archive-game'), log=[];
 for(let frame=0; frame<Math.ceil(seconds*120) && scene.playable(); frame++) {
  const s=scene.state;
  if(frame % reactionFrames === 0 && !s.retry) {
   if(s.rope) {
    if(s.rope.starter) { scene.touch.add('action'); scene.primaryAction(); }
    if(s.rope.theta >= releaseAngle && s.rope.omega > 0) scene.touch.delete('action');
   } else {
    const a=scene.stageGame.candidate.call(scene);
    if(a && Math.hypot(a.x-s.x,a.y-s.y)<catchDistance && !s.visited.includes(a.index)) {
     scene.touch.add('action'); scene.primaryAction();
     log.push({anchor:a.index,at:scene.elapsed,x:s.x,y:s.y,speed:s.speed,multiplier:s.multiplier});
    }
   }
  }
  scene.update(0,1000/120);
 }
 return log;
};
