import assert from 'node:assert/strict';
import { advanceFrictionStop, settleFrictionStop } from '../js/archive/friction-stop.mjs';
for (const hz of [40, 60, 120]) {
  const s = { stopHold: 0, stopGrace: 0 };
  for (let i=0;i<hz/2;i++) advanceFrictionStop(s,0,0,1/hz);
  const held=s.stopHold;
  // A tiny correction used to erase the entire half-second in one frame.
  const correction=advanceFrictionStop(s,0,19,1/hz);
  assert.equal(correction.label,'BRAKE');
  assert.equal(s.stopHold,held);
  assert.equal(advanceFrictionStop(s,19,0,1/hz).label,'CENTER');
  assert.equal(s.stopHold,held);
  let result;
  for(let i=0;i<hz;i++) result=advanceFrictionStop(s,0,0,1/hz);
  assert.ok(result.complete);
  assert.equal(advanceFrictionStop(s,23,0,1/hz).complete,false);
  assert.equal(s.stopHold,0);
  s.stopHold=0.5;
  advanceFrictionStop(s,0,25,1/hz);
  assert.equal(s.stopHold,0);
  s.stopHold=0.5;
  for(let i=0;i<hz;i++) assert.equal(advanceFrictionStop(s,19,19,1/hz).complete,false);
  assert.equal(s.stopHold,0,'Sustained drifting does not preserve or complete a stop');
}
console.log('PASS | stop correction grace, genuine exits, braking feedback and 40/60/120Hz completion');
for (const hz of [40,60,120]) {
  for (const assist of [false,true]) {
    const s={ x:648, y:428, vx:22, vy:0, direction:null, stopHold:0, stopGrace:0 };
    let completed=false;
    for(let i=0;i<hz*2;i++) {
      s.vx=Math.max(0,s.vx-14/hz);
      if(assist) settleFrictionStop(s,{x:640,y:428},1/hz);
      s.x+=s.vx/hz;
      completed ||= advanceFrictionStop(s,Math.hypot(s.x-640,s.y-428),Math.hypot(s.vx,s.vy),1/hz).complete;
    }
    assert.equal(completed,assist,'Late low-friction arrival settles only with bay braking');
  }
}
for(const fields of [{vx:80},{direction:'right'},{x:665}]) {
  const s={x:640,y:428,vx:22,vy:0,direction:null,...fields};
  const before={...s};
  assert.equal(settleFrictionStop(s,{x:640,y:428},1/60),false);
  assert.deepEqual(s,before);
}
console.log('PASS | second-stop drift reproduced, low-speed settling, no fast-pass or input capture');
