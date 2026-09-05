import assert from 'node:assert/strict';
import { createStackState, dropStack, stepStack, nextStackBlock, stackMargin } from '../js/archive/stack-core.mjs';
import { MEMORY_FRAGMENTS, touchesFragment } from '../js/archive/fragments.mjs';
import { STAGES } from '../js/archive/data.mjs';
import { createProgressStore } from '../js/archive/progress.mjs';
assert.deepEqual(STAGES.map(s => s.id), ['maze','gravity','bounce','friction','stack']);
for (const hz of [40,60,120]) for (const memory of [false,true]) {
  const s=createStackState(); let collected=false, elapsed=0, cleared=false;
  while(elapsed<20.26) {
    if(!s.dropping && s.blocks.length<6) {
      const target=memory ? (!s.blocks.length ? 514 : 490) : 480;
      s.direction=Math.abs(s.x-target)<=120/hz+0.01?null:s.x<target?'right':'left';
      if(!s.direction) dropStack(s);
    }
    const previous={...s}; const r=stepStack(s,1/hz);elapsed+=1/hz;
    collected ||= touchesFragment(MEMORY_FRAGMENTS.stack,s,previous);
    assert.equal(r.failed,false);
    if(r.landed && s.blocks.length<6) nextStackBlock(s);
    if(r.cleared){cleared=true;break;}
  }
  assert.ok(cleared);assert.equal(collected,memory);
  console.log(`${hz}Hz ${memory?'memory':'basic'} stack ${elapsed.toFixed(2)}s`);
}
assert.ok(stackMargin([{x:515,w:90,mass:1},{x:550,w:90,mass:1.45},{x:585,w:90,mass:1.9}])<0);
const storage={getItem:()=>JSON.stringify({version:1,records:{maze:'FULLY RESTORED',gravity:'PARTIALLY RESTORED',recoil:'FULLY RESTORED',rotation:'FULLY RESTORED'}})};
const progress=createProgressStore(STAGES.map(s=>s.id),storage);
assert.equal(progress.summary().totalRecords,5);assert.equal(progress.summary().recoveryRate,30);
console.log('Five-stage save migration and mass-weighted instability passed.');
const rushed=createStackState();
let failed=false;
for(let i=0;i<1200;i++) {
  dropStack(rushed);
  const result=stepStack(rushed,1/60);
  if(result.failed){failed=true;break;}
  if(result.landed) nextStackBlock(rushed);
}
assert.ok(failed, 'Repeated drops without aligning the moving crane must fail');

