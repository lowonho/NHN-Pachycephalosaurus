import { MINI } from './minigame-kit.js';

/*
 * 떨어지는 사람은 assets/images/minigame/stacks/metcha 의 포즈 여덟 장이다.
 * 표시 크기와 사각형 충돌 조각은 scripts/bake-stack-poses.ps1 이 그림의 알파에서 구워
 * assets/minigames/e3/pose-shapes.js 에 넣어 둔다. 조각은 알파가 반 넘게 찬 칸만 덮으므로
 * 투명한 여백은 서로 지나가고 사람 모형끼리는 겹치지 않는다.
 *
 * 구운 파일을 못 찾으면 아래 한 자세로만 돌아간다. 게임이 멈추지는 않지만 그림도 안 나온다.
 */
const E3_SHAPES = globalThis.E3_POSE_SHAPES ?? {
  poses: [{ id: 'pose7', name: '차렷', width: 59, height: 116, parts: [
    [0, -41.6, 33.7, 33.5], [0, 21.6, 39.3, 72.8], [-24.6, 2.5, 9.8, 41.4], [24.6, 2.5, 9.8, 41.4],
  ] }],
  line: { width: 59, height: 116 },
};

export const E3_HUMAN_STACK = {
  // 속도는 낙하 횟수만으로 증가합니다. 붕괴/바닥 접촉으로 되돌리지 않습니다.
  tuning: {
    speed: 225, speedGain: 38, maxSpeed: 795, dropCooldown: .34,
    targetHeight: 216, hold: 3,
    // 자세는 여덟 가지, 각도는 일곱 가지라 같은 조합이 쉰여섯 번에 한 번만 돌아옵니다.
    dropAngles: [90, -35, -90, 25, 145, -65, 180],
    gravity: 1.35, friction: .58, frictionStatic: .88, frictionAir: .006,
    restitution: .045, density: .0022, carryMomentum: .075,
    settleSpeed: 18, settleAngularSpeed: .22, spawnClearance: 90,
    baseY: 425, baseWidth: 138, floorY: 477, debugPhysics: false,
    // 성공선 오른쪽 끝에 붙박이로 세워 두는 표지. 화살표가 선을 가리킵니다.
    markerX: 900, markerHeight: 76, goalRight: 838,
  },
  // 좌표 원점은 그림의 정중앙. [중심x, 중심y, 가로, 세로] 사각형들이 실제 충돌체이고,
  // 같은 원점의 그림이 그 위에 얹힙니다. 자세는 고정되며 몸 전체는 자유롭게 회전합니다.
  poses: E3_SHAPES.poses,
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
      hint: this.add.text(480, 166, '떨어질 자세와 각도를 보고 쌓기 · 목표 높이에서 3초 버티기', { fontFamily: 'Arial', fontSize: '14px', color: '#80a4b1' }).setOrigin(.5),
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
    return Math.min(t.maxSpeed, t.speed + this.state.drops * t.speedGain);
  },
  createPerson(x, y, poseIndex, angle = 0) {
    const M = Phaser.Physics.Matter.Matter, t = E3_HUMAN_STACK.tuning;
    const pose = E3_HUMAN_STACK.poses[poseIndex];
    const material = {
      friction: t.friction, frictionStatic: t.frictionStatic, restitution: t.restitution,
      density: t.density, slop: .025,
    };
    // 구워 둔 사각형은 서로 겹치지 않으므로 넓이를 그대로 더해 질량이 됩니다.
    const parts = pose.parts.map(([cx, cy, w, h]) => M.Bodies.rectangle(x + cx, y + cy, w, h, material));
    const body = M.Body.create({
      parts, ...material, frictionAir: t.frictionAir, label: 'e3:person',
    });
    // Matter의 실제 질량중심과 에셋의 기준점 차이를 보존해 회전 시 그림이 어긋나지 않게 합니다.
    body.plugin.e3 = { poseIndex, origin: { x: x - body.position.x, y: y - body.position.y }, born: this.elapsed };
    // 자세를 바꾸지 않고 사람 전체를 미리보기의 원점 기준으로 돌립니다.
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
    // 누운 자세는 가로로 기니 그만큼 넓게 살핍니다.
    for (const body of this.people) if (Math.abs(body.position.x - s.x) < 130) s.spawnY = Math.min(s.spawnY, body.bounds.min.y - 70);
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
  /* 키에 묶인 이미지를 만들거나 다시 씁니다. 없는 텍스처면 null을 돌려줍니다. */
  sprite(key, texture) {
    if (!this.textures.exists(texture)) { this.assetSprites.get(key)?.setVisible(false); return null; }
    let sprite = this.assetSprites.get(key);
    if (!sprite) { sprite = this.add.image(0, 0, texture).setMask(this.ink.mask); this.assetSprites.set(key, sprite); }
    return sprite.setTexture(texture).setVisible(true);
  },
  drawPerson(poseIndex, key, x, y, angle = 0, alpha = 1) {
    const pose = E3_HUMAN_STACK.poses[poseIndex], z = this.state.zoom;
    const p = E3_HUMAN_STACK.project.call(this, x, y), g = this.ink;
    // 그림의 원점은 잘라낸 이미지의 정중앙이라 충돌 사각형과 같은 좌표계를 씁니다.
    const sprite = E3_HUMAN_STACK.sprite.call(this, key, `e3:${pose.id}`);
    if (sprite) {
      sprite.setPosition(p.x, p.y).setDisplaySize(pose.width * z, pose.height * z).setRotation(angle).setAlpha(alpha);
      return;
    }
    // 그림이 없으면 충돌 조각을 그대로 실루엣으로 씁니다. 미리보기와 낙하물이 같은 모양입니다.
    g.save(); g.translateCanvas(p.x, p.y); g.rotateCanvas(angle); g.scaleCanvas(z, z);
    for (const [cx, cy, w, h] of pose.parts) {
      g.fillStyle(0x506c7a, alpha).fillRect(cx - w / 2 - 1.2, cy - h / 2 - 1.2, w + 2.4, h + 2.4);
    }
    for (const [cx, cy, w, h] of pose.parts) g.fillStyle(0xd8e5e8, alpha).fillRect(cx - w / 2, cy - h / 2, w, h);
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
    for (let x = 115; x < t.goalRight; x += 20) MINI.line(this, x, goal.y, x + 10, goal.y, 0x96efba, 1);
    this.stackLabels.goal.setPosition(t.goalRight + 18, goal.y - 5).setText(s.held ? `버티기 ${Math.max(0, t.hold - s.held).toFixed(1)}초` : '목표 높이 · 3초 유지');
    this.stackLabels.next.setText(`다음: ${E3_HUMAN_STACK.poses[s.nextPose].name}`);
    this.stackLabels.hint.setVisible(s.drops === 0);
    // 성공선 오른쪽 끝에 세워 둔 표지. 가슴의 화살표가 선을 가리키며, 시야가 줄어도 크기는 그대로입니다.
    const marker = E3_HUMAN_STACK.sprite.call(this, 'goalMark', 'e3:line');
    if (marker) {
      marker.setPosition(t.markerX, goal.y)
        .setDisplaySize(t.markerHeight * E3_SHAPES.line.width / E3_SHAPES.line.height, t.markerHeight);
    }
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
