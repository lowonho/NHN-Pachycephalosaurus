import { MINI } from './minigame-kit.js';

export const E3_HUMAN_STACK = {
  // 속도는 낙하 횟수만으로 증가합니다. 붕괴/바닥 접촉으로 되돌리지 않습니다.
  tuning: {
    speed: 225, speedGain: 38, maxSpeed: 795, dropCooldown: .34,
    targetHeight: 216, hold: 3,
    dropAngles: [90, -35, -90, 25, 145, -65, 180, 50],
    gravity: 1.35, friction: .58, frictionStatic: .88, frictionAir: .006,
    restitution: .045, density: .0022, carryMomentum: .075,
    settleSpeed: 18, settleAngularSpeed: .22, spawnClearance: 90,
    baseY: 425, baseWidth: 138, floorY: 477, debugPhysics: false,
  },
  // 좌표 원점은 골반 근처. 선분 [x1,y1,x2,y2,반지름]이 실제 캡슐 충돌체와
  // 기본 마네킹 그림의 공통 원본입니다. 자세는 고정되며 몸 전체는 자유롭게 회전합니다.
  poses: [
    { id: 'crouch', name: '버티기', width: 102, height: 96, head: [0, -28, 11], limbs: [
      [0, -10, 0, 8, 14], [-9, -10, -25, -19, 8], [-25, -19, -39, -7, 7],
      [9, -10, 25, -19, 8], [25, -19, 39, -7, 7],
      [-6, 9, -22, 20, 9], [-22, 20, -27, 32, 7],
      [6, 9, 22, 20, 9], [22, 20, 27, 32, 7],
      [-32, 34, -21, 34, 7], [21, 34, 32, 34, 7],
    ] },
    { id: 'wide', name: '팔 벌리기', width: 120, height: 104, head: [0, -30, 11], limbs: [
      [0, -12, 0, 8, 14], [-9, -12, -29, -11, 8], [-29, -11, -47, -20, 7],
      [9, -12, 29, -11, 8], [29, -11, 47, -20, 7],
      [-6, 9, -12, 23, 9], [-12, 23, -19, 39, 7],
      [6, 9, 12, 23, 9], [12, 23, 19, 39, 7],
      [-25, 41, -15, 41, 7], [15, 41, 25, 41, 7],
    ] },
    { id: 'reach', name: '만세', width: 96, height: 124, head: [0, -30, 11], limbs: [
      [0, -12, 0, 8, 14], [-9, -12, -25, -29, 8], [-25, -29, -31, -47, 7],
      [9, -12, 25, -29, 8], [25, -29, 31, -47, 7],
      [-6, 9, -18, 24, 9], [-18, 24, -24, 40, 7],
      [6, 9, 18, 24, 9], [18, 24, 24, 40, 7],
      [-30, 42, -19, 42, 7], [19, 42, 30, 42, 7],
    ] },
  ],
  build() {
    MINI.init(this, 0xe4eeec);
    const M = Phaser.Physics.Matter.Matter, t = E3_HUMAN_STACK.tuning;
    this.stackWorld = M.Engine.create({
      enableSleeping: false, positionIterations: 10, velocityIterations: 10,
    });
    this.stackWorld.gravity.y = t.gravity;
    this.stackGround = M.Bodies.rectangle(480, t.floorY + 14, 2400, 28, {
      isStatic: true, friction: t.friction, label: 'e3:floor',
    });
    this.stackBase = M.Bodies.rectangle(480, (t.baseY + t.floorY) / 2, t.baseWidth, t.floorY - t.baseY, {
      isStatic: true, friction: t.friction, label: 'e3:pedestal',
    });
    // 넓은 바닥이 잔해를 받습니다. 잔해를 지우거나 정적 물체로 고정하지 않습니다.
    M.Composite.add(this.stackWorld.world, [this.stackGround, this.stackBase]);
    this.state = {
      x: 270, direction: 1, drops: 0, cooldown: 0, held: 0, height: 0,
      bestHeight: 0, groundedCount: 0, stableCount: 0, zoom: 1,
      spawnY: 200, nextPose: 0, nextAngle: t.dropAngles[0] * Math.PI / 180, impacts: [], impactCooldown: 0,
    };
    this.people = [];
    this.stackBodyById = new Map();
    this.stackGrounded = new Set();
    this.stackStable = new Set();
    this.stackLabels = {
      next: this.add.text(917, 117, '', { fontFamily: 'Arial', fontSize: '16px', color: '#d9e9ef' }).setOrigin(1, .5),
      goal: this.add.text(0, 0, '목표 높이', { fontFamily: 'Arial', fontSize: '13px', color: '#a7ffc6' }).setOrigin(1, 1),
      hint: this.add.text(480, 166, '사람이 누운 방향을 보고 쌓기 · 목표 높이에서 3초 버티기', { fontFamily: 'Arial', fontSize: '14px', color: '#80a4b1' }).setOrigin(.5),
    };
    this.stackCollisionHandler = event => {
      for (const pair of event.pairs) {
        const a = pair.collision.parentA, b = pair.collision.parentB;
        if (!this.stackBodyById.has(a.id) && !this.stackBodyById.has(b.id)) continue;
        const normal = pair.collision.normal;
        const impact = Math.abs((a.velocity.x - b.velocity.x) * normal.x + (a.velocity.y - b.velocity.y) * normal.y);
        if (impact < 1.2) continue;
        const contact = pair.collision.supports[0];
        if (contact) this.state.impacts.push({ x: contact.x, y: contact.y, age: 0, strength: Math.min(1, impact / 8) });
        if (this.state.impactCooldown <= 0) {
          this.sfx('hit'); this.state.impactCooldown = .1;
        }
      }
    };
    M.Events.on(this.stackWorld, 'collisionStart', this.stackCollisionHandler);
  },
  speed() {
    const t = E3_HUMAN_STACK.tuning;
    return Math.min(t.maxSpeed, t.speed + this.state.drops * this.penalty(t.speedGain));
  },
  createPerson(x, y, poseIndex, angle = 0) {
    const M = Phaser.Physics.Matter.Matter, t = E3_HUMAN_STACK.tuning;
    const pose = E3_HUMAN_STACK.poses[poseIndex];
    const material = {
      friction: t.friction, frictionStatic: t.frictionStatic, restitution: t.restitution,
      density: t.density, slop: .025,
    };
    const parts = pose.limbs.map(([ax, ay, bx, by, r]) => M.Bodies.rectangle(
      x + (ax + bx) / 2, y + (ay + by) / 2, Math.hypot(bx - ax, by - ay) + r * 2, r * 2,
      { ...material, angle: Math.atan2(by - ay, bx - ax), chamfer: { radius: r, quality: 8 } },
    ));
    parts.push(M.Bodies.circle(x + pose.head[0], y + pose.head[1], pose.head[2], { ...material, density: t.density * .7 }, 16));
    const body = M.Body.create({
      parts, ...material, frictionAir: t.frictionAir, label: 'e3:person',
    });
    // Matter의 실제 질량중심과 에셋의 기준점 차이를 보존해 회전 시 그림이 어긋나지 않게 합니다.
    body.plugin.e3 = { poseIndex, origin: { x: x - body.position.x, y: y - body.position.y }, born: this.elapsed };
    // 팔다리 모양을 바꾸지 않고 사람 전체를 미리보기의 원점 기준으로 돌립니다.
    M.Body.rotate(body, angle, { x, y });
    return body;
  },
  action() {
    const s = this.state, t = E3_HUMAN_STACK.tuning;
    if (s.cooldown > 0) return;
    const M = Phaser.Physics.Matter.Matter;
    const body = E3_HUMAN_STACK.createPerson.call(this, s.x, s.spawnY, s.nextPose, s.nextAngle);
    // 운반 중의 좌우 관성을 조금 물려줍니다. 초기 방향 이후 회전은 실제 충돌에 맡깁니다.
    M.Body.setVelocity(body, { x: s.direction * E3_HUMAN_STACK.speed.call(this) * t.carryMomentum / 60, y: 0 });
    M.Composite.add(this.stackWorld.world, body);
    this.people.push(body); this.stackBodyById.set(body.id, body);
    s.drops++; this.actions++; s.nextPose = s.drops % E3_HUMAN_STACK.poses.length; s.cooldown = t.dropCooldown;
    s.nextAngle = t.dropAngles[s.drops % t.dropAngles.length] * Math.PI / 180;
    this.sfx('action');
  },
  pointerDown() { E3_HUMAN_STACK.action.call(this); },
  measureTower() {
    const t = E3_HUMAN_STACK.tuning;
    const graph = new Map();
    const connect = (a, b) => { if (!graph.has(a)) graph.set(a, new Set()); graph.get(a).add(b); };
    for (const pair of this.stackWorld.pairs.list) {
      if (!pair.isActive) continue;
      const a = pair.collision.parentA, b = pair.collision.parentB;
      connect(a.id, b.id); connect(b.id, a.id);
    }
    const trace = stableOnly => {
      const reached = new Set([this.stackGround.id, this.stackBase.id]), queue = [...reached];
      for (let i = 0; i < queue.length; i++) for (const id of graph.get(queue[i]) ?? []) {
        if (reached.has(id)) continue;
        const body = this.stackBodyById.get(id);
        if (!body) continue;
        if (stableOnly && (body.speed * 60 > t.settleSpeed || Math.abs(body.angularVelocity) * 60 > t.settleAngularSpeed)) continue;
        reached.add(id); queue.push(id);
      }
      return new Set([...reached].filter(id => this.stackBodyById.has(id)));
    };
    this.stackGrounded = trace(false);
    this.stackStable = trace(true);
    const top = ids => ids.size ? Math.min(...[...ids].map(id => this.stackBodyById.get(id).bounds.min.y)) : t.baseY;
    // 흔들려도 바닥부터 받쳐진 탑이면 인정합니다. 목표 아래로 내려오면 3초를 다시 셉니다.
    this.state.height = Math.max(0, t.baseY - top(this.stackGrounded));
    this.state.bestHeight = Math.max(this.state.bestHeight, this.state.height);
    this.state.groundedCount = this.stackGrounded.size;
    this.state.stableCount = this.stackStable.size;
    return top(this.stackGrounded);
  },
  update(dt) {
    const s = this.state, t = E3_HUMAN_STACK.tuning, M = Phaser.Physics.Matter.Matter;
    s.x += s.direction * E3_HUMAN_STACK.speed.call(this) * dt;
    if (s.x < 260 || s.x > 700) { s.x = MINI.clamp(s.x, 260, 700); s.direction *= -1; }
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.impactCooldown = Math.max(0, s.impactCooldown - dt);
    M.Engine.update(this.stackWorld, dt * 1000);
    const top = E3_HUMAN_STACK.measureTower.call(this);
    // 위에서 계속 떨어뜨릴 공간을 확보합니다. 탑 높이에 따라 시야가 부드럽게 넓어집니다.
    s.spawnY = Math.min(200, top - t.spawnClearance);
    // 연타해도 이미 공중에 있는 사람 안에서 새 강체가 생성되지 않습니다.
    for (const body of this.people) if (Math.abs(body.position.x - s.x) < 125) s.spawnY = Math.min(s.spawnY, body.bounds.min.y - 65);
    const desiredZoom = MINI.clamp(305 / Math.max(305, t.floorY - s.spawnY + 62), .35, 1);
    s.zoom += (desiredZoom - s.zoom) * (1 - Math.exp(-dt * 6));
    s.held = s.height >= t.targetHeight ? s.held + dt : 0;
    for (const impact of s.impacts) impact.age += dt;
    s.impacts = s.impacts.filter(impact => impact.age < .35).slice(-16);
    this.anomaly = `좌우 속도 ${Math.round(E3_HUMAN_STACK.speed.call(this))} · 받쳐진 사람 ${s.groundedCount}/${s.drops}명`;
    this.risk = MINI.clamp((E3_HUMAN_STACK.speed.call(this) - t.speed) / (t.maxSpeed - t.speed) * 100, 0, 100);
    if (s.held >= t.hold) this.finish(true, `${s.drops}명 · 높이 ${Math.round(s.height)} · ${t.hold}초 버티기 성공`);
  },
  project(x, y) {
    const z = this.state.zoom, floor = E3_HUMAN_STACK.tuning.floorY;
    return { x: 480 + (x - 480) * z, y: floor + (y - floor) * z };
  },
  drawPerson(poseIndex, key, x, y, angle = 0, alpha = 1) {
    const pose = E3_HUMAN_STACK.poses[poseIndex], z = this.state.zoom;
    const p = E3_HUMAN_STACK.project.call(this, x, y), g = this.ink;
    const specific = `e3:person_${pose.id}`;
    const texture = this.textures.exists(specific) ? specific : this.textures.exists('e3:person') ? 'e3:person' : null;
    if (texture) {
      let sprite = this.assetSprites.get(key);
      if (!sprite) { sprite = this.add.image(p.x, p.y, texture).setMask(g.mask); this.assetSprites.set(key, sprite); }
      // person=공통 이미지, person_crouch/wide/reach=자세별 이미지. 원점=이미지 중심.
      sprite.setTexture(texture).setPosition(p.x, p.y).setDisplaySize(pose.width * z, pose.height * z).setRotation(angle).setAlpha(alpha).setVisible(true);
      return;
    }
    this.assetSprites.get(key)?.setVisible(false);
    // 미리보기와 낙하물에 같은 실루엣을 사용합니다.
    g.save(); g.translateCanvas(p.x, p.y); g.rotateCanvas(angle); g.scaleCanvas(z, z);
    const stroke = (limb, radius, color, opacity, ox = 0, oy = 0) => {
      const [ax, ay, bx, by] = limb;
      g.lineStyle(radius * 2, color, opacity).lineBetween(ax + ox, ay + oy, bx + ox, by + oy);
      g.fillStyle(color, opacity).fillCircle(ax + ox, ay + oy, radius).fillCircle(bx + ox, by + oy, radius);
    };
    // 그림자/몸체/얇은 하이라이트만으로 흰색 무표정 마네킹을 표현합니다.
    for (const limb of pose.limbs) stroke(limb, limb[4] + 1.2, 0x506c7a, alpha);
    for (const limb of pose.limbs) stroke(limb, limb[4], 0xd8e5e8, alpha);
    for (const limb of pose.limbs) stroke(limb, Math.max(1.2, limb[4] * .4), 0xfafffa, alpha * .8, -1.1, -1.1);
    const [hx, hy, hr] = pose.head;
    g.fillStyle(0x506c7a, alpha).fillCircle(hx, hy, hr + 1.2);
    g.fillStyle(0xe8f0ee, alpha).fillCircle(hx, hy, hr);
    g.fillStyle(0xffffff, alpha * .7).fillEllipse(hx - 2.4, hy - 2.7, hr * .9, hr);
    g.restore();
  },
  render() {
    const s = this.state, t = E3_HUMAN_STACK.tuning, g = this.ink;
    const project = (x, y) => E3_HUMAN_STACK.project.call(this, x, y);
    MINI.frame(this, `HEIGHT ${Math.round(s.height)} / ${t.targetHeight}    ${s.held ? `버티기 ${Math.max(0, t.hold - s.held).toFixed(1)}초 남음` : `목표 높이에서 ${t.hold}초 버티기`}`);
    const base = project(480 - t.baseWidth / 2, t.baseY);
    MINI.box(this, 22, t.floorY, 916, 12, 0x263f4d);
    MINI.box(this, base.x, base.y, t.baseWidth * s.zoom, t.floorY - base.y, 0x4e6370);
    MINI.line(this, base.x, base.y + 1, base.x + t.baseWidth * s.zoom, base.y + 1, 0xd4dad4, 3);
    for (let height = 0; height <= 400; height += 40) {
      const p = project(350, t.baseY - height);
      if (p.y < 180) continue;
      MINI.line(this, 66, p.y, height % 80 ? 75 : 85, p.y, 0x58818d, 1);
    }
    const goal = project(0, t.baseY - t.targetHeight);
    for (let x = 115; x < 850; x += 20) MINI.line(this, x, goal.y, x + 10, goal.y, 0x96efba, 1);
    this.stackLabels.goal.setPosition(902, goal.y - 5).setText(s.held ? `버티기 ${Math.max(0, t.hold - s.held).toFixed(1)}초` : '목표 높이 · 3초 유지');
    this.stackLabels.next.setText(`다음: ${E3_HUMAN_STACK.poses[s.nextPose].name}`);
    this.stackLabels.hint.setVisible(s.drops === 0);
    // 실제 질량중심으로 회전한 뒤 원래 그림의 기준점을 복구합니다.
    this.people.forEach((body, i) => {
      const pose = body.plugin.e3, c = Math.cos(body.angle), sn = Math.sin(body.angle);
      const x = body.position.x + pose.origin.x * c - pose.origin.y * sn;
      const y = body.position.y + pose.origin.x * sn + pose.origin.y * c;
      E3_HUMAN_STACK.drawPerson.call(this, pose.poseIndex, `person${i}`, x, y, body.angle);
    });
    for (const impact of s.impacts) {
      const p = project(impact.x, impact.y), fade = 1 - impact.age / .35;
      g.lineStyle(1.5, 0xffd99e, fade * .7).strokeEllipse(p.x, p.y, (12 + impact.age * 80) * s.zoom, (4 + impact.age * 25) * s.zoom);
    }
    const rail = project(s.x, s.spawnY - 60);
    MINI.line(this, project(260, 0).x, rail.y, project(700, 0).x, rail.y, 0x5f8190, 2);
    MINI.circle(this, rail.x, rail.y, 4, 0xffd99e);
    MINI.line(this, rail.x, rail.y + 4, rail.x, rail.y + 11, 0xffd99e, 2);
    E3_HUMAN_STACK.drawPerson.call(this, s.nextPose, 'preview', s.x, s.spawnY, s.nextAngle, s.cooldown ? .3 : .8);
    if (t.debugPhysics) for (const body of this.people) {
      for (const part of body.parts.slice(1)) {
        g.lineStyle(1, 0xff799b, .85).strokePoints(part.vertices.map(v => project(v.x, v.y)), true);
      }
      const p = project(body.position.x, body.position.y);
      MINI.circle(this, p.x, p.y, 2.5, this.stackStable.has(body.id) ? 0x90ffc0 : 0xff799b);
    }
    MINI.meter(this, s.height / t.targetHeight);
  },
  dispose() {
    if (!this.stackWorld) return;
    const M = Phaser.Physics.Matter.Matter;
    M.Events.off(this.stackWorld, 'collisionStart', this.stackCollisionHandler);
    M.Composite.clear(this.stackWorld.world, false); M.Engine.clear(this.stackWorld);
    this.stackWorld = null; this.stackCollisionHandler = null;
    this.stackBodyById?.clear(); this.stackGrounded?.clear(); this.stackStable?.clear();
  },
};
