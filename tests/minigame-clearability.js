(() => {
  const scene = archivePhaserGame.scene.getScene('archive-game');
  archivePhaserGame.loop.sleep(); archiveGameBridge.active = false; modalFlow.close();
  const results = [];
  let outcome;
  const listener = event => { outcome = event.detail; };
  window.addEventListener('archive-stage-end', listener);
  const load = id => { outcome = null; scene.loadStage(id); scene.startStage(); scene.settings = { shake: false, effects: false }; };
  const advance = (seconds, control = () => {}) => {
    for (let i = 0; i < Math.ceil(seconds * 120) && scene.playable(); i++) { control(i); scene.update(0, 1000 / 120); }
  };
  const save = id => results.push({ id, success: outcome?.success ?? false, elapsed: scene.elapsed, actions: scene.actions, state: JSON.parse(JSON.stringify(scene.state, (key, value) => ['obstacles','points','balls','targets'].includes(key) ? undefined : value)) });
  load('e1');
  const flippedGates = new Set();
  advance(20.3, () => {
    const s = scene.state;
    // 다음 묶음 110px 앞에서 반전해 느리게 따라오는 가시/블록보다 먼저 벽을 옮깁니다.
    const next = scene.hurdles.find(h => h.x - s.x > -15);
    if (next && next.x - s.x < 110 && !flippedGates.has(next.x)) { flippedGates.add(next.x); scene.primaryAction(); }
  }); save('e1');
  load('e2'); scene.directionPress('right');
  advance(20.3, () => {
    const s = scene.state;
    const p = scene.platforms.find(p => s.checkpoint === p.x + 50);
    if (s.grounded && p && s.x >= p.x + p.w - 16 && p !== scene.platforms.at(-1)) scene.primaryAction();
  }); save('e2');
  load('e3');
  let lastDrop = -10;
  advance(20.3, () => { if (Math.abs(scene.state.x - 480) < 3 && scene.elapsed - lastDrop > .7 && scene.state.height < scene.stageGame.tuning.targetHeight) { scene.primaryAction(); lastDrop = scene.elapsed; } });
  save('e3');
  load('e4');
  advance(20.3, () => {
    const s = scene.state, next = s.dirs[s.segment + 1];
    if (!next || s.retry) return;
    const a = s.points[s.segment], b = s.points[s.segment + 1];
    if (Math.hypot(b.x-a.x,b.y-a.y) - s.progress < 10) { scene.touch.clear(); scene.directionPress(next); }
  }); save('e4');
  load('e5');
  const chooseShot = () => {
    const s = scene.state, power = scene.stageGame.power.call(scene); let best = null;
    for (let angle = .18; angle < 1.35; angle += .025) for (let pull = 66; pull <= 112; pull += 2) {
      let x = 164-Math.cos(angle)*pull, y = 382+Math.sin(angle)*pull;
      let vx = Math.cos(angle)*pull*8.4*power, vy = -Math.sin(angle)*pull*8.4*power;
      let score = 0; const hits = new Set();
      for(let frame = 0; frame < 280; frame++) {
        vy += 640/120; x += vx/120; y += vy/120;
        if(y > 457 || x > 960) break;
        s.targets.forEach((o,i) => {
          if(o.hp<=0 || hits.has(i) || x+12<o.x || x-12>o.x+o.w || y+12<o.y || y-12>o.y+o.h) return;
          const damage = Math.max(6,Math.hypot(vx,vy)*.1*power);
          score += Math.min(o.hp,damage) + (damage>=o.hp ? 50 : 0); hits.add(i); vx *= .73; vy -= 60;
        });
      }
      if(!best || score>best.score) best={score,x:164-Math.cos(angle)*pull,y:382+Math.sin(angle)*pull};
    }
    return best;
  };
  while(scene.playable() && scene.elapsed < 19) {
    const aim=chooseShot(); scene.pointerAction(164,382); scene.stageGame.pointerMove.call(scene,aim.x,aim.y); scene.stageGame.pointerUp.call(scene); advance(2.5);
  }
  advance(2); save('e5');
  load('e6');
  advance(20.3, frame => {
    if (frame % 16 !== 0) return; // 사람도 입력 가능한 133ms 간격으로만 조작.
    const s = scene.state, ahead = s.x + 70;
    const index = scene.gates.findIndex(g => g.x > ahead);
    const next = scene.gates[index] ?? {x: 4400, y: 315};
    const previous = scene.gates[Math.max(0,index - 1)] ?? {x: 0, y: 323};
    const fraction = Math.max(0, Math.min(1, (ahead - previous.x)/(next.x-previous.x || 1)));
    const desired = previous.y+(next.y-previous.y)*fraction;
    const vy = Math.max(-190,Math.min(190,(desired-s.y)*3));
    const hold = s.vy > vy;
    if(hold && !scene.touch.has('action')) { scene.touch.add('action'); scene.primaryAction(); }
    if(!hold) scene.touch.delete('action');
  }); save('e6');
  // A real random roulette round can lose; verify the actual resting wedge judges both outcomes.
  load('e7'); scene.state.rotation = -Math.PI/2 - .2; scene.state.spinning=true; scene.state.speed=.0001; scene.state.deceleration=8;
  advance(.02); save('e7');
  load('e9');
  const dx=scene.target.x-scene.state.x, dy=scene.target.y-scene.state.y, distance=Math.hypot(dx,dy);
  const pull=Math.sqrt(2*220*distance)/5.7;
  scene.pointerAction(scene.state.x,scene.state.y); scene.stageGame.pointerMove.call(scene,scene.state.x-dx/distance*pull,scene.state.y-dy/distance*pull); scene.stageGame.pointerUp.call(scene);
  advance(20.3); save('e9');
  window.removeEventListener('archive-stage-end', listener);
  const failures = results.filter(result => !result.success);
  if (failures.length) throw new Error(`Clearability failed: ${JSON.stringify(failures)}`);
  return results;
})()
