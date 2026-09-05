import { MINI } from './minigame-kit.js';

export const E5_SLINGSHOT = {
  // Late full pulls still reach the far roof on an arc, but low shots fall short.
  tuning: { force: 8.8, decay: .05, minPower: .76, gravity: 640, maxPull: 112, cooldown: 1.5, targetHP: 100, woodHP: 60, woodHitMax: 40, jointStiffness: .2, pierceSpeed: 580, piercePower: .86, toppleAngle: .62, toppleHold: .18 },
  /* 그림의 표시 크기. 판정(Matter 강체)은 그대로 두고 표시만 원본 비율에 가깝게 키운다 —
     기둥 하나가 12px 라고 웨이퍼를 12px 로 눌러 그리면 무늬가 뭉개진다.
     빠진 값은 판정 크기를 그대로 쓰고, bottom 이면 그림 아랫변을 판정 사각형 아랫변에 맞춘다.
     지붕은 위에 얹은 크림과 딸기까지 한 장이라 가운데를 맞추면 처마가 내려앉아 보인다. */
  art: {
    pillarLong: { w: 16 }, pillarMedium: { w: 19 }, pillarShort: {},
    floorWide: { h: 17 }, floorSmall: { h: 24 },
    roof: { w: 114, h: 60, bottom: true },
    target: { w: 40, h: 38 }, targetHit: { w: 44, h: 38 },
  },
  /* 무대의 세로 기준선은 조리대 상판 y=507 이다 — 물체가 놓이는 면이자 바닥 강체(y=527, 두께 40)의 윗면이고,
     과자집의 발과 고무줄 기준점(164, 418)도 여기에 맞춰 잡혀 있다. 상판은 필드 아래(579)를 넘겨 깔아
     앞면이 화면 밖으로 잘려 나간다. 무대를 위아래로 옮길 때는 새총·과자집·바닥을 같은 값만큼 함께 옮겨야
     포물선과 난이도가 그대로다. tests/e5-slingshot-check.js 의 좌표도 같은 값만큼 따라와야 한다. */
  build() {
    MINI.init(this, 0xd9bc7a);
    this.state = { shots: 0, cooldown: 0, waiting: false, drag: null, balls: [], targets: [], timbers: [], crumbs: [], feedback: '', feedbackAge: 0, combo: 0, pendingFinish: 0, frozenRemaining: 0, finishText: '' };
    const M = Phaser.Physics.Matter.Matter;
    this.slingWorld = M.Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 8 });
    this.slingWorld.gravity.y = .64;
    M.Composite.add(this.slingWorld.world, M.Bodies.rectangle(480, 527, 2200, 40, { isStatic: true, friction: .65 }));
    // role 은 매니페스트(assets/minigames/manifest.js)의 e5 그림 이름이다. 그림이 없으면
    // 아래 render 가 옛 진저브레드 도형으로 대신 그린다.
    const timber = (x, y, w, h, role, roof = false) => {
      const options = { density: .0019, friction: .55, frictionStatic: .75, frictionAir: .018, restitution: .02 };
      const body = roof ? M.Bodies.trapezoid(x, y, w, h, .35, options) : M.Bodies.rectangle(x, y, w, h, options);
      const wood = { x: x - w / 2, y: y - h / 2, w, h, hp: E5_SLINGSHOT.tuning.woodHP, body, angle: 0, flash: 0, roof, role, wood: true, joints: [] };
      body.plugin.timber = wood; this.state.timbers.push(wood); M.Composite.add(this.slingWorld.world, body);
    };
    // Separate load-bearing posts and floors form rooms around the cookie residents.
    for (let col = 0; col < 2; col++) {
      const cx = 680 + col * 116;
      timber(cx - 43, 471, 12, 72, 'pillarLong'); timber(cx + 43, 471, 12, 72, 'pillarLong');
      timber(cx, 429, 108, 12, 'floorSmall');
      timber(cx - 43, 393, 12, 60, 'pillarMedium'); timber(cx + 43, 393, 12, 60, 'pillarMedium');
      // 지붕 바로 밑에는 얇은 층(floorWide)을, 눈에 잘 띄는 가운데 층에는 두꺼운 케이크(floorSmall)를 쓴다.
      timber(cx, 357, 108, 12, 'floorWide'); timber(cx, 339, 110, 24, 'roof', true);
      const parts = this.state.timbers.slice(-7);
      parts.forEach((part, index) => { part.house = col; part.foundation = index < 2; });
      const join = (a, b, x, y) => {
        const joint = M.Constraint.create({
          bodyA: a?.body, pointA: a ? { x: x - a.body.position.x, y: y - a.body.position.y } : { x, y },
          bodyB: b.body, pointB: { x: x - b.body.position.x, y: y - b.body.position.y },
          length: 0, stiffness: E5_SLINGSHOT.tuning.jointStiffness, damping: .2,
        });
        a?.joints.push(joint); b.joints.push(joint); M.Composite.add(this.slingWorld.world, joint);
      };
      // Timber joints hold the house until repeated impacts break a load-bearing piece.
      for (const side of [0, 1]) {
        const x = cx + (side ? 43 : -43);
        join(null, parts[side], x, 507);
        join(parts[side], parts[2], x, 435);
        join(parts[2], parts[3 + side], x, 423);
        join(parts[3 + side], parts[5], x, 363);
        join(parts[5], parts[6], x, 351);
      }
      for (let row = 0; row < 2; row++) {
        const w = 34, h = 36, x = cx - w / 2, y = (row ? 423 : 507) - h;
        const body = M.Bodies.rectangle(cx, y + h / 2, w, h, {
          density: .0015, friction: .48, frictionStatic: .7, frictionAir: .004, restitution: .06,
        });
        const target = { x, y, w, h, hp: 100, flash: 0, angle: 0, body, originX: cx, originY: y + h / 2, unstable: 0 };
        body.plugin.cookie = target; this.state.targets.push(target); M.Composite.add(this.slingWorld.world, body);
      }
    }
    this.slingImpacts = [];
    M.Events.on(this.slingWorld, 'collisionStart', event => {
      for (const pair of event.pairs) {
        const bullet = pair.bodyA.plugin.shot || pair.bodyB.plugin.shot;
        if (bullet && (pair.bodyA.isStatic || pair.bodyB.isStatic)) bullet.groundAge ??= 0;
        const target = pair.bodyA.plugin.cookie || pair.bodyB.plugin.cookie || pair.bodyA.plugin.timber || pair.bodyB.plugin.timber;
        const cookie = pair.bodyA.plugin.cookie || pair.bodyB.plugin.cookie;
        const wood = pair.bodyA.plugin.timber || pair.bodyB.plugin.timber;
        if (!bullet && cookie && wood && cookie.hp > 0) {
          const va = pair.bodyA.plugin.beforeVelocity || { x: 0, y: 0 };
          const vb = pair.bodyB.plugin.beforeVelocity || { x: 0, y: 0 };
          const normal = pair.collision.normal;
          const impactSpeed = Math.abs((va.x - vb.x) * normal.x + (va.y - vb.y) * normal.y);
          if (impactSpeed > 80) this.slingImpacts.push({ target: cookie, crush: impactSpeed });
        }
        if (bullet && target && target.hp > 0 && !bullet.hit.has(target)) {
          bullet.hit.add(target);
          this.slingImpacts.push({ bullet, target, vx: bullet.vx, vy: bullet.vy });
        }
      }
    });

    // 움직이지 않는 소품은 한 번만 깔고 render 에서 건드리지 않는다.
    // 깊이를 나눠 두는 이유는 HUD 때문이다. ink(안내문·진행 막대·조준선)는 깊이 0 이라
    // 조리대를 -1 에 두어야 화면 아래 글씨가 상판 그림에 가리지 않는다. 배경은 그보다 아래다.
    const scenery = (role, x, y, w, h) => {
      if (!this.textures.exists('e5:' + role)) return null;
      return this.add.image(x, y, 'e5:' + role).setDisplaySize(w, h).setDepth(-1).setMask(this.ink.mask);
    };
    this.backdrop?.setDepth(-2);
    // 상판 윗변(y=507)이 물체가 놓이는 면이다. 아래로는 필드 끝(579)을 넘겨 623 까지 깔아
    // 상판 앞면이 화면 밖에서 잘리게 둔다 — 조리대가 화면 앞으로 튀어나온 것처럼 보인다.
    scenery('table', MINI.FIELD.cx, 565, MINI.FIELD.w, 116);
    for (let col = 0; col < 2; col++) scenery('brick', 680 + col * 116, 523, 116, 32);
    scenery('brickStar', 300, 494, 28, 27);
    scenery('brickStar', 884, 492, 32, 31);
    // 새총 몸통. 고무줄이 없는 그림이라 줄은 render 가 선으로 그리는데, 그 선이 ink(깊이 0)라
    // 몸통도 같은 -1 에 두어야 쉬고 있을 때의 짧은 줄이 몸통에 가리지 않는다.
    scenery('slingshot', 160, 446, 96, 124);
    // 부서지는 연출(균열·번쩍임·부스러기)을 그리는 레이어. 과자집 그림보다 위(깊이 1)여야 보인다 —
    // ink 는 배우 스프라이트보다 먼저 만들어져 아래에 깔리므로, 조각 한가운데 그리면 그림에 가린다.
    // 스프라이트를 tint 로 물들이는 방법은 못 쓴다. index.html 을 파일로 직접 열면 Phaser.CANVAS 로
    // 뜨는데(js/archive/game.mjs) 캔버스 렌더러는 tint 를 조용히 무시한다.
    this.debris = this.add.graphics().setDepth(1).setMask(this.ink.mask);
    this.add.text(160, 534, '두쫀쿠', { fontFamily: 'Arial', fontSize: '14px', color: '#e7d09d' }).setOrigin(.5);

    this.instruction.setText('');
  },
  power() { return Math.max(E5_SLINGSHOT.tuning.minPower, 1 - this.state.shots * this.penalty(E5_SLINGSHOT.tuning.decay)); },
  pointerDown(x, y) {
    if (this.state.waiting || this.state.cooldown || this.state.drag || Math.hypot(x - 164, y - 418) > 55) return;
    this.state.drag = { x: 164, y: 418 };
    this.sfx('sfxE5RubberStretch');
    E5_SLINGSHOT.pointerMove.call(this, x, y);
  },
  pointerMove(x, y) {
    if (!this.state.drag) return;
    const dx = x - 164, dy = y - 418, scale = Math.min(1, E5_SLINGSHOT.tuning.maxPull / Math.max(1, Math.hypot(dx, dy)));
    this.state.drag = { x: 164 + dx * scale, y: 418 + dy * scale };
  },
  pointerUp() {
    const s = this.state, d = s.drag, t = E5_SLINGSHOT.tuning;
    if (!d) return;
    s.drag = null;
    if (Math.hypot(d.x - 164, d.y - 418) < 8) return;
    const power = E5_SLINGSHOT.power.call(this);
    s.balls.push({ x: d.x, y: d.y, vx: (164 - d.x) * t.force * power, vy: (418 - d.y) * t.force * power, power, age: 0, hit: new Set(), id: s.shots, squash: 0, trail: [] });
    const shot = s.balls[s.balls.length - 1], M = Phaser.Physics.Matter.Matter;
    shot.body = M.Bodies.circle(shot.x, shot.y, 12, {
      density: .014, friction: .35, frictionAir: 0, restitution: .3,
      collisionFilter: { category: 2, mask: 1 },
    });
    shot.body.plugin.shot = shot;
    M.Body.setVelocity(shot.body, { x: shot.vx / 60, y: shot.vy / 60 });
    M.Composite.add(this.slingWorld.world, shot.body);
    s.shots++; this.actions++; s.cooldown = t.cooldown; s.waiting = true; s.combo = 0; this.sfx('sfxE5Release');
  },
  cancelInput() { this.state.drag = null; },
  damage(target, amount, collapse = false) {
    if (target.hp <= 0) return;
    this.sfx('sfxDubaiStretch');
    target.hp = Math.max(0, target.hp - amount); target.flash = .18;
    if (target.wood) {
      const t = E5_SLINGSHOT.tuning;
      for (const joint of target.joints) joint.stiffness = Math.min(joint.stiffness, t.jointStiffness * (.25 + .75 * target.hp / t.woodHP));
    }
    const s = this.state, broken = target.hp === 0;
    // Cosmetic randomness never changes damage or collision results.
    if (this.settings.effects) for (let i = 0; i < (broken ? 14 : 5); i++) {
      // 부서질 때는 부스러기를 더 굵게 튀긴다 — 과자 그림 위로도 알아볼 만큼.
      s.crumbs.push({ x: target.x + target.w / 2, y: target.y + target.h / 2,
        vx: MINI.rand(-170, 170), vy: MINI.rand(-230, -55), age: 0, size: MINI.rand(broken ? 3 : 2, broken ? 9 : 6),
        color: i % 3 ? 0xd9a15e : 0xfff3e2 });
    }
    if (broken) {
      if (target.wood) {
        const M = Phaser.Physics.Matter.Matter;
        // Loss of a ground-floor support releases the frame instead of hanging it
        // from the opposite post. Gravity and the shot's momentum drive the fall.
        const released = target.foundation ? s.timbers.filter(part => part.house === target.house) : [target];
        for (const part of released) {
          for (const joint of part.joints) M.Composite.remove(this.slingWorld.world, joint);
          part.joints.length = 0;
          M.Sleeping.set(part.body, false);
        }
        // A broken post must stop carrying the floor: keeping its full-size body
        // made the released house balance on an invisible intact support.
        M.Body.scale(target.body, .7, .28);
        target.w *= .7; target.h *= .28;
        target.body.friction = .35; target.body.frictionStatic = .45;
      }
      // Only timber stays as rubble. Defeated cookies no longer block the next shot.
      target.body.collisionFilter.category = 4;
      if (target.wood) {
        s.feedback = '와사삭! 과자 기둥이 부서졌다'; s.feedbackAge = .8; return;
      }
      Phaser.Physics.Matter.Matter.Composite.remove(this.slingWorld.world, target.body);
      const spriteKey = 'target' + s.targets.indexOf(target);
      this.assetSprites.get(spriteKey)?.destroy(); this.assetSprites.delete(spriteKey);
      s.combo++; s.feedback = collapse ? '와르르! 중심이 무너졌다' : s.combo > 1 ? s.combo + '개 연속 파괴!' : '바삭! 두딱쿠 파괴';
      s.feedbackAge = 1.1;
      if (this.settings.shake) this.cameras.main.shake(70, .002);
    } else { s.feedback = '기우뚱! 모서리를 노려보세요'; s.feedbackAge = .65; }
  },
  update(dt) {
    const s = this.state, t = E5_SLINGSHOT.tuning;
    s.cooldown = Math.max(0, s.cooldown - dt); s.feedbackAge = Math.max(0, s.feedbackAge - dt);
    const M = Phaser.Physics.Matter.Matter;
    for (const ball of s.balls) {
      ball.vx = ball.body.velocity.x * 60; ball.vy = ball.body.velocity.y * 60;
    }
    for (const body of M.Composite.allBodies(this.slingWorld.world)) {
      body.plugin.beforeVelocity = { x: body.velocity.x * 60, y: body.velocity.y * 60 };
    }
    M.Engine.update(this.slingWorld, dt * 1000);
    for (const impact of this.slingImpacts) {
      if (impact.crush) {
        E5_SLINGSHOT.damage.call(this, impact.target, impact.crush * .8, true); continue;
      }
      const { bullet, target, vx, vy } = impact;
      const speed = Math.hypot(vx, vy);
      const strong = bullet.power >= t.piercePower && speed >= t.pierceSpeed;
      const damage = target.wood ? Math.min(t.woodHitMax, Math.max(speed >= 220 ? 30 : 8, speed * .075)) : strong ? 100 : Math.min(28, speed * .035);
      E5_SLINGSHOT.damage.call(this, target, damage);
      const pierce = strong && target.hp <= 0;
      bullet.squash = .2;
      if (pierce) {
        M.Body.setVelocity(bullet.body, { x: vx * .78 / 60, y: vy * .78 / 60 });
        M.Body.setVelocity(target.body, { x: vx * .22 / 60, y: -2 });
        s.feedback = '쫀득 관통!'; s.feedbackAge = 1;
      }
    }
    this.slingImpacts.length = 0;
    for (const ball of s.balls) {
      ball.age += dt; ball.squash = Math.max(0, ball.squash - dt);
      if (ball.groundAge !== undefined) ball.groundAge += dt;
      ball.x = ball.body.position.x; ball.y = ball.body.position.y;
      ball.vx = ball.body.velocity.x * 60; ball.vy = ball.body.velocity.y * 60;
      const spent = ball.body.isSleeping || (ball.hit.size > 0 && Math.hypot(ball.vx, ball.vy) < 100);
      ball.spentAge = spent ? (ball.spentAge || 0) + dt : 0;
      if (this.settings.effects) {
        ball.trail.unshift({ x: ball.x, y: ball.y }); ball.trail.length = Math.min(12, ball.trail.length);
      }
    }
    for (const o of [...s.targets, ...s.timbers]) {
      o.flash = Math.max(0, o.flash - dt);
      o.x = o.body.position.x - o.w / 2; o.y = o.body.position.y - o.h / 2; o.angle = o.body.angle;
      if (o.hp <= 0) continue;
      const tilt = Math.abs(Math.atan2(Math.sin(o.angle), Math.cos(o.angle)));
      if (o.wood) {
        // Damaged foundations yield permanently once they buckle, instead of
        // ground constraints pulling the leaning frame upright again.
        if (o.foundation && o.hp <= t.woodHP / 2 && o.joints.length && tilt > .22) {
          E5_SLINGSHOT.damage.call(this, o, o.hp, true);
        }
        continue;
      }
      const displaced = Math.abs(o.body.position.x - o.originX) > 36 || o.body.position.y - o.originY > 35;
      // A brief wobble is safe; sustained tipping or falling off the tower counts as collapse.
      o.unstable = tilt > t.toppleAngle || displaced ? o.unstable + dt : 0;
      if (o.unstable >= t.toppleHold) E5_SLINGSHOT.damage.call(this, o, 100, true);
    }
    s.crumbs = s.crumbs.filter(c => {
      c.age += dt; c.vy += 580 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      return c.age < .75;
    });
    s.balls = s.balls.filter(b => {
      // Keep the first impact, but do not wait for a floor-bound ball to finish rolling.
      const keep = b.x < 980 && b.x > -30 && b.y < 596 && !(b.groundAge >= .12) && !(b.spentAge >= .18);
      if (!keep) { M.Composite.remove(this.slingWorld.world, b.body); this.assetSprites.get('ball' + b.id)?.destroy(); this.assetSprites.delete('ball' + b.id); }
      return keep;
    });
    if (s.waiting && s.cooldown <= 1e-9) {
      s.cooldown = 0;
      s.waiting = false; s.feedback = '다음 두쫀쿠 준비!'; s.feedbackAge = .7;
    }
    const left = s.targets.filter(o => o.hp > 0).length;
    this.anomaly = '고무줄 장력 ' + Math.round(E5_SLINGSHOT.power.call(this) * 100) + '% · ' + (E5_SLINGSHOT.power.call(this) <= .8 ? '높게 띄워 지붕 공략' : '기둥을 노려보세요');
    this.risk = (1 - E5_SLINGSHOT.power.call(this)) * 180;
    // 목표를 채운 순간 시간은 그대로 멈추되, 마지막 한 발이 부순 결과(조각 흩날림 등)를
    // 1초 더 보여준 뒤에 클리어 처리한다 — 즉시 결과창을 띄우면 그 장면을 놓친다.
    if (!left && s.pendingFinish === 0) {
      s.pendingFinish = 1; s.frozenRemaining = this.remaining;
      s.finishText = s.shots + '발로 두딱쿠 4개 파괴';
    }
    if (s.pendingFinish > 0) {
      this.remaining = s.frozenRemaining;
      s.pendingFinish = Math.max(0, s.pendingFinish - dt);
      if (s.pendingFinish === 0) this.finish(true, s.finishText);
    }
  },
  /* role 은 매니페스트의 e5 그림 이름이다. 두쫀쿠는 상태별로(proud/tense/launch/split),
     두딱깡은 성한 것과 맞은 것(target/targetHit)으로 갈린다.
     그림이 없으면 두쫀쿠 계열은 초콜릿 공, 두딱깡 계열은 과자 상자로 대신 그린다. */
  cookie(role, key, x, y, w, h, angle = 0) {
    if (this.textures.exists('e5:' + role)) { MINI.actor(this, role, key, x, y, w, h, angle); return; }
    const g = this.ink; g.save(); g.translateCanvas(x, y); g.rotateCanvas(angle);
    if (!role.startsWith('target')) {
      g.fillStyle(0x543427).fillEllipse(0, 0, w, h);
      g.fillStyle(0x88553a).fillEllipse(-w * .08, -h * .09, w * .85, h * .78);
      g.fillStyle(0xaab56d).fillEllipse(w * .12, h * .06, w * .49, h * .56);
      for (let i = 0; i < 7; i++) g.lineStyle(1.4, i % 2 ? 0xd4c289 : 0x728844).lineBetween(-w * .1 + i * w * .05, -h * .13, -w * .02 + i * w * .05, h * .25);
      g.fillStyle(0xc09464, .8).fillCircle(-w * .22, -h * .22, 2).fillCircle(-w * .28, h * .1, 1.6);
    } else {
      g.fillStyle(0x482c24).fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      g.fillStyle(0x9a6848).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 8, 5);
      g.fillStyle(0xc29461).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * .34, 3);
      g.fillStyle(0x8e9d58).fillRect(-w / 2 + 3, h * .08, w - 6, 5);
      for (let i = 0; i < 5; i++) g.fillStyle(0x583d2b).fillCircle(-w * .31 + i * w * .15, -h * .23 + (i % 2) * 5, 2);
    }
    g.restore();
  },
  render() {
    const s = this.state, d = s.drag ?? { x: 164, y: 418 }, power = E5_SLINGSHOT.power.call(this), t = E5_SLINGSHOT.tuning;
    const broken = s.targets.filter(o => o.hp <= 0).length;
    const field = this.ink;
    MINI.frame(this);
    this.debris.clear();
    this.instruction.setText('파괴 ' + broken + ' / 4 · 장력 ' + Math.round(power * 100) + '%' + (s.waiting ? ' · 다음 발사 ' + s.cooldown.toFixed(1) + '초' : ''));
    // Warm pastry counter, trays and reserves keep the play field readable.
    // 조리대 그림이 있으면 build 가 깔아 둔 상판과 초콜릿 받침이 이 자리를 대신한다.
    if (!this.textures.exists('e5:table')) {
      MINI.box(this, 22, 480, 916, 34, 0x372923);
      MINI.box(this, 22, 507, 916, 9, 0xb98e62);
      MINI.box(this, MINI.FIELD.x, 516, MINI.FIELD.w, MINI.FIELD.bottom - 516, 0x372923);
      for (let i = 0; i < 2; i++) MINI.box(this, 626 + i * 116, 507, 108, 5, 0xf0c9a0);
    }
    if (!this.textures.exists('e5:slingshot')) {
      MINI.line(this, 146, 483, 137, 394, 0xa78260, 14);
      MINI.line(this, 146, 440, 184, 393, 0xa78260, 12);
    }
    MINI.line(this, 137, 396, d.x, d.y, 0x6c4630, 7);
    MINI.line(this, 137, 396, d.x, d.y, 0xe9c18c, 3);
    MINI.line(this, 184, 393, d.x, d.y, 0xe9c18c, 4);
    const pull = Math.hypot(d.x - 164, d.y - 418) / t.maxPull;
    // 당기는 동안에는 힘을 주는 얼굴로 바뀌고, 발사 방향으로 몸을 돌린다.
    // 두쫀쿠는 판정(반지름 12 원)보다 크게 그린다 — 새총과 과자집 옆에서 알아볼 만한 크기로.
    if (!s.waiting && s.cooldown === 0) E5_SLINGSHOT.cookie.call(this, s.drag ? 'tense' : 'proud', 'ready', d.x, d.y, 40 + pull * 15, 40 - pull * 8, s.drag ? Math.atan2(418 - d.y, 164 - d.x) : 0);
    else MINI.hideActor(this, 'ready');
    if (s.drag) {
      let x = d.x, y = d.y, vx = (164 - d.x) * t.force * power, vy = (418 - d.y) * t.force * power;
      for (let frame = 0; frame < 36; frame++) {
        vy += t.gravity / 120; x += vx / 120; y += vy / 120;
        const hit = [...s.targets, ...s.timbers].some(o => o.hp > 0 && MINI.hit({ x: x - 12, y: y - 12, w: 24, h: 24 }, o));
        if (hit || y > 493) break;
        if (x > 950 || x < 20) break;
        if (frame % 6 === 0) MINI.circle(this, x, y, 3, 0xffe9bc, Math.max(.3, .9 * (1 - frame / 44)));
      }
      MINI.box(this, 88, 318, 126, 8, 0x4c3d30);
      MINI.box(this, 88, 318, 126 * pull, 8, pull > .8 ? 0xc7d981 : 0xe3bc7d);
    }
    s.timbers.forEach((wood, index) => {
      const g = this.ink, body = wood.body;
      // 부러진 기둥은 짧은 웨이퍼 조각으로 갈아 끼운다. 판정은 damage 가 이미 줄여 놓았고,
      // 층과 지붕은 자기 그림 그대로 납작해진다 — 웨이퍼 조각으로 바꾸면 딸기 케이크가 사라져 보인다.
      const role = wood.hp <= 0 && wood.role.startsWith('pillar') ? 'pillarShort' : wood.role;
      const drawn = this.textures.exists('e5:' + role);
      // 그림이 차지하는 사각형. 파손 연출도 판정이 아니라 이 사각형에 맞춰야 조각을 정확히 덮는다.
      // 부러진 조각은 판정이 원래 높이의 28%까지 얇아진다. 너무 얇으면 보이지 않아 5px 를 밑돌지 않게 한다.
      const spec = drawn ? E5_SLINGSHOT.art[role] ?? {} : {};
      const artW = spec.w ?? wood.w, artH = Math.max(spec.h ?? wood.h, drawn ? 5 : 0);
      // 아랫변을 맞추는 그림(지붕)은 기운 각도만큼 중심도 같이 돌려 준다.
      const dy = spec.bottom ? wood.h / 2 - artH / 2 : 0;
      if (drawn) {
        MINI.actor(this, role, 'wood' + index,
          body.position.x - dy * Math.sin(body.angle), body.position.y + dy * Math.cos(body.angle), artW, artH, body.angle);
      } else {
        // 과자집: 진저브레드 기둥에 아이싱을 두르고 지붕은 딸기 아이싱으로 덮는다.
        // 색과 장식만 바뀌고 몸체·판정은 그대로다.
        g.fillStyle(wood.hp <= 0 ? 0x9a6a3c : wood.roof ? 0xe4728f : 0xd39a55).fillPoints(body.vertices, true);
        g.lineStyle(2, wood.roof ? 0xfff3e2 : 0x9c6330).strokePoints(body.vertices, true);
      }
      g.save(); g.translateCanvas(body.position.x, body.position.y); g.rotateCanvas(body.angle);
      // 아이싱 장식은 옛 도형에만 있던 것이라 그림이 깔리면 그리지 않는다.
      if (!drawn && !wood.roof) {
        const vertical = wood.h > wood.w;
        // 가장자리를 따라 짜 놓은 하얀 아이싱
        for (const sign of [-1, 1]) {
          if (vertical) MINI.line(this, sign * (wood.w / 2 - 2), -wood.h / 2 + 4, sign * (wood.w / 2 - 2), wood.h / 2 - 4, 0xfff3e2, 2);
          else MINI.line(this, -wood.w / 2 + 4, sign * (wood.h / 2 - 2), wood.w / 2 - 4, sign * (wood.h / 2 - 2), 0xfff3e2, 2);
        }
        // 알사탕 장식은 기둥 길이에 맞춰 고르게 박는다.
        const span = vertical ? wood.h : wood.w, beads = Math.max(2, Math.round(span / 20));
        for (let i = 0; i < beads; i++) {
          const at = ((i + .5) / beads - .5) * (span - 10);
          MINI.circle(this, vertical ? 0 : at, vertical ? at : 0, 2.4, i % 2 ? 0x6fd3c0 : 0xff85b3);
        }
      } else if (!drawn) {
        // 처마를 타고 흘러내린 아이싱과 젤리 장식
        MINI.line(this, -32, -4, 32, -4, 0xfff3e2, 3);
        MINI.line(this, -44, 5, 44, 5, 0xfff3e2, 3);
        [-33, -11, 11, 33].forEach((sx, i) => MINI.circle(this, sx, 5, 3, i % 2 ? 0x8ce0c8 : 0xffd166));
      }
      g.restore();
      // 맞은 티(번쩍임·균열·내구도 막대)는 조각 그림 위(debris)에 같은 자리로 겹쳐 그린다.
      const fx = this.debris;
      fx.save(); fx.translateCanvas(body.position.x, body.position.y); fx.rotateCanvas(body.angle);
      if (this.settings.effects && wood.flash) {
        fx.fillStyle(0xfff3e2, wood.flash * 3).fillRoundedRect(-artW / 2, dy - artH / 2, artW, artH, Math.min(5, artW / 3, artH / 3));
      }
      // 이미 부러진 조각은 그림부터 부서진 모습이라 균열과 막대를 겹치지 않는다.
      if (wood.hp > 0 && wood.hp < t.woodHP) {
        fx.lineStyle(2, 0x30251d).lineBetween(-4, -5, 5, 5);
        if (wood.hp < t.woodHP / 2) {
          fx.lineStyle(2, 0x30251d).lineBetween(5, 5, -4, 13);
          fx.lineStyle(2, 0x30251d).lineBetween(-3, -4, 4, -12);
        }
        // 막대는 판정이 아니라 그림 윗변 위에 띄운다 — 층과 지붕은 그림이 판정보다 커서 안에 묻힌다.
        const barY = dy - artH / 2 - 5;
        fx.fillStyle(0x38271f).fillRoundedRect(-artW / 2, barY, artW, 3, 1);
        fx.fillStyle(wood.hp < t.woodHP / 2 ? 0xee9267 : 0xe5c17d)
          .fillRoundedRect(-artW / 2, barY, artW * Math.max(0, wood.hp) / t.woodHP, 3, 1);
      }
      fx.restore();
    });
    s.targets.forEach((o, i) => {
      if (o.hp <= 0) { MINI.hideActor(this, 'target' + i); return; }
      // 한 번이라도 맞으면 부스러기가 튄 두딱깡 그림으로 바뀐다.
      const role = o.hp < t.targetHP ? 'targetHit' : 'target';
      const spec = this.textures.exists('e5:' + role) ? E5_SLINGSHOT.art[role] : null;
      const w = spec?.w ?? o.w, h = spec?.h ?? o.h;
      E5_SLINGSHOT.cookie.call(this, role, 'target' + i, o.x + o.w / 2, o.y + o.h / 2, w, h, o.angle);
      // 맞은 티는 두딱깡 그림 위(debris)에 겹쳐 그린다. 다만 균열 선은 그림이 없을 때만 —
      // targetHit 그림이 이미 깨진 모습이라 위에 검은 선을 또 그으면 지저분해진다.
      const fx = this.debris;
      fx.save(); fx.translateCanvas(o.x + o.w / 2, o.y + o.h / 2); fx.rotateCanvas(o.angle);
      if (!spec && o.hp < t.targetHP) {
        fx.lineStyle(3, 0x38281f).lineBetween(0, -o.h / 2 + 3, -10, -5);
        fx.lineStyle(3, 0x38281f).lineBetween(-10, -5, 8, 5);
        fx.lineStyle(3, 0x38281f).lineBetween(8, 5, -3, o.h / 2 - 3);
      }
      if (this.settings.effects && o.flash) {
        fx.fillStyle(0xffedbe, o.flash * 3).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(5, w / 3, h / 3));
      }
      fx.restore();
    });
    for (const b of s.balls) {
      for (let i = 0; i < b.trail.length; i += 2) MINI.circle(this, b.trail[i].x, b.trail[i].y, 5 - i * .25, 0xbac480, .22 * (1 - i / 12));
      // 날아가는 동안은 신난 얼굴이고, 무언가에 맞은 뒤에는 반으로 갈라진 채 구른다.
      E5_SLINGSHOT.cookie.call(this, b.hit.size ? 'split' : 'launch', 'ball' + b.id, b.x, b.y, 36 + b.squash * 30, 36 - b.squash * 20, Math.atan2(b.vy, b.vx));
    }
    // 부스러기도 debris 에 그린다 — ink 에 그리면 튀어나온 것들이 과자집 그림 뒤에 깔려 반쯤 사라진다.
    for (const c of s.crumbs) {
      this.debris.fillStyle(c.color, 1 - c.age / .75).fillRoundedRect(c.x, c.y, c.size, c.size, Math.min(5, c.size / 3));
    }
    MINI.meter(this, broken / 4);
  },
  dispose() {
    if (!this.slingWorld) return;
    const M = Phaser.Physics.Matter.Matter;
    M.Events.off(this.slingWorld); M.Composite.clear(this.slingWorld.world, false);
    M.Engine.clear(this.slingWorld); this.slingWorld = null; this.slingImpacts = [];
  },
};
