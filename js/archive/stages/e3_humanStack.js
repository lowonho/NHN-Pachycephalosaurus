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
    speed: 153, speedGain: 26, maxSpeed: 795, dropCooldown: .34,
    targetHeight: 216, hold: 3,
    // 자세는 여덟 가지, 각도는 일곱 가지라 같은 조합이 쉰여섯 번에 한 번만 돌아옵니다.
    // 이 각도는 "받아 든 자세"일 뿐이고, 떨어뜨리기 전에는 A/D · ←/→로 직접 돌립니다.
    dropAngles: [90, -35, -90, 25, 145, -65, 180],
    // 한 번 톡 누르면 spinStep만큼, 꾹 누르고 있으면 초당 spinSpeed만큼 돌아갑니다(도 단위).
    spinStep: 12, spinSpeed: 150,
    // 사람끼리 잘 물리도록 마찰을 높였습니다 — 낮으면 얹자마자 미끄러져 흘러내립니다.
    gravity: 1.35, friction: .8, frictionStatic: 1.05, frictionAir: .006,
    // 낙하 순간 레일 속도의 이만큼을 물려받습니다. 1이면 그대로 — 다만 후반 속도에서는
    // 레일 끝에서 떨어뜨려도 단상까지 날아오지 못해, 미리 겨냥이 가능한 선까지만 줍니다.
    restitution: .045, density: .0022, carryMomentum: .32,
    settleSpeed: 18, settleAngularSpeed: .22,
    // 대기 위치가 오가는 폭. 성공선도 이 폭에 맞춰 긋습니다.
    railLeft: 260, railRight: 700,
    // dropHeight는 단상 윗면에서 사람이 대기하는 높이까지의 거리이며 고정값입니다.
    // 탑이 자라도 대기 위치는 움직이지 않으므로 떨어뜨리는 높이가 수시로 바뀌지 않고,
    // 마지막 한 명까지 늘 같은 감으로 겨냥할 수 있습니다.
    baseY: 452, baseWidth: 360, floorY: 500, dropHeight: 330, debugPhysics: false,
    // 바닥 위로 화면에 담을 세로 길이. 이만큼을 넘어서면 시야가 물러납니다 —
    // 크게 잡을수록 같은 탑을 더 크게, 대기 위치를 더 높게 보여 줍니다.
    viewSpan: 358,
    // 성공선 오른쪽 끝에 붙여 세워 두는 표지. 화살표가 선을 가리킵니다.
    // markerGap은 선의 오른쪽 끝에서 표지 중심까지의 거리라, 선이 짧아지면 표지도 따라붙습니다.
    markerHeight: 76, markerGap: 62,
  },
  // 좌표 원점은 그림의 정중앙. [중심x, 중심y, 가로, 세로] 사각형들이 실제 충돌체이고,
  // 같은 원점의 그림이 그 위에 얹힙니다. 자세는 고정되며 몸 전체는 자유롭게 회전합니다.
  poses: E3_SHAPES.poses,
  build() {
    MINI.init(this, 0xe4eeec);
    /*
     * 얼룩 반점 전용 레이어. this.ink는 MINI.init에서 맨 먼저 만들어지는데, 사람
     * 스프라이트(this.add.image)는 나중에 생기면서 항상 그 위에 올라간다 — 같은
     * this.ink에 반점을 그려 봐야 불투명한 스프라이트에 완전히 가려진다. depth를
     * 스프라이트보다 높게 둬서 반점이 스프라이트 위에 실제로 보이게 한다.
     */
    this.blotchInk = this.add.graphics().setDepth(5);
    const M = Phaser.Physics.Matter.Matter, t = E3_HUMAN_STACK.tuning;
    this.stackWorld = M.Engine.create({
      enableSleeping: false, positionIterations: 10, velocityIterations: 10,
    });
    this.stackWorld.gravity.y = t.gravity;
    this.stackBase = M.Bodies.rectangle(480, (t.baseY + t.floorY) / 2, t.baseWidth, t.floorY - t.baseY, {
      isStatic: true, friction: t.friction, label: 'e3:pedestal',
    });
    // 받아 주는 바닥은 없습니다. 단상을 벗어난 사람은 화면 아래로 그대로 떨어져 사라집니다.
    M.Composite.add(this.stackWorld.world, this.stackBase);
    this.state = {
      x: 270, direction: 1, drops: 0, cooldown: 0, held: 0, height: 0,
      bestHeight: 0, groundedCount: 0, stableCount: 0, zoom: 1,
      spawnY: t.baseY - t.dropHeight, nextPose: 0, nextAngle: t.dropAngles[0] * Math.PI / 180,
      nextTint: E3_HUMAN_STACK.randomTint(), spinShown: 0,
      impacts: [], impactCooldown: 0,
    };
    this.people = [];
    this.stackBodyById = new Map();
    this.stackGrounded = new Set();
    this.stackStable = new Set();
    this.stackLabels = {
      next: this.add.text(917, 117, '', { fontFamily: 'Arial', fontSize: '16px', color: '#d9e9ef' }).setOrigin(1, .5),
      goal: this.add.text(0, 0, '목표 높이', { fontFamily: 'Arial', fontSize: '13px', color: '#a7ffc6' }).setOrigin(1, 1),
    };
    // 조작 안내는 다른 미니게임과 같은 자리(화면 최하단)에 그대로 둔다.
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
  /*
   * 메챠 카멜레온처럼 사람마다 얼룩덜룩한 색을 입힌다. 주조색 하나에 살짝 어둡거나
   * 밝은 톤 둘, 뚜렷이 다른 보색 계열 반점 하나를 네 모서리에 얹으면(setTint) 텍스처
   * 하나로도 자연스러운 반점 무늬가 된다. 같은 사람이라도 매번 새로 뽑는다.
   */
  randomTint() {
    const hue = Math.random();
    const accentHue = (hue + .38 + Math.random() * .24) % 1;
    const color = (h, s, l) => Phaser.Display.Color.HSLToColor(h, s, l).color;
    return [
      color(hue, .58, .5),
      color(hue, .5, .36),
      color(accentHue, .62, .48),
      color(hue, .45, .62),
    ];
  },
  createPerson(x, y, poseIndex, angle = 0, tint = null) {
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
    body.plugin.e3 = {
      poseIndex, origin: { x: x - body.position.x, y: y - body.position.y }, born: this.elapsed,
      tint: tint ?? E3_HUMAN_STACK.randomTint(),
    };
    // 자세를 바꾸지 않고 사람 전체를 미리보기의 원점 기준으로 돌립니다.
    M.Body.rotate(body, angle, { x, y });
    return body;
  },
  action() {
    const s = this.state, t = E3_HUMAN_STACK.tuning;
    if (s.cooldown > 0) return;
    const M = Phaser.Physics.Matter.Matter;
    // 대기 위치(s.spawnY)는 화면에 늘 고정으로 보여 주지만, 드물게 탑이 그 높이까지
    // 올라온 채로 떨어뜨리면 사람이 겹쳐 생성될 수 있어 실제 생성 위치만 국소적으로 밀어 올립니다.
    // 누운 자세는 가로로 기니 그만큼 넓게 살핍니다.
    let spawnY = s.spawnY;
    for (const other of this.people) if (Math.abs(other.position.x - s.x) < 130) spawnY = Math.min(spawnY, other.bounds.min.y - 70);
    const body = E3_HUMAN_STACK.createPerson.call(this, s.x, spawnY, s.nextPose, s.nextAngle, s.nextTint);
    // 레일이 달리던 좌우 속도를 그대로 물려줍니다 — 빠를 때 떨어뜨리면 그만큼 옆으로 흐릅니다.
    // Matter의 속도 단위는 60Hz 한 프레임의 이동량이라 초당 픽셀을 60으로 나눠 넣습니다.
    // 초기 방향 이후의 회전은 실제 충돌에 맡깁니다.
    M.Body.setVelocity(body, { x: s.direction * E3_HUMAN_STACK.speed.call(this) * t.carryMomentum / 60, y: 0 });
    M.Composite.add(this.stackWorld.world, body);
    this.people.push(body); this.stackBodyById.set(body.id, body);
    s.drops++; this.actions++; s.nextPose = s.drops % E3_HUMAN_STACK.poses.length; s.cooldown = t.dropCooldown;
    // 다음 미리보기도 새 색으로 다시 뽑습니다 — 떨어뜨린 사람과 같은 얼룩무늬가 이어지지 않게.
    s.nextTint = E3_HUMAN_STACK.randomTint();
    // 다음 사람은 다시 목록의 각도로 받아 듭니다. 방금 돌려 둔 각도는 따라오지 않습니다.
    s.nextAngle = t.dropAngles[s.drops % t.dropAngles.length] * Math.PI / 180;
    this.sfx('action');
  },
  /* 좌우 입력은 이동이 아니라 회전입니다. 톡 누르면 한 칸, 꾹 누르면 update가 이어서 돌립니다. */
  press(direction) {
    const t = E3_HUMAN_STACK.tuning, turn = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    if (!turn) return;
    E3_HUMAN_STACK.spin.call(this, turn * t.spinStep);
  },
  spin(degrees) {
    const s = this.state;
    s.nextAngle += degrees * Math.PI / 180;
    // 각도가 한없이 커지지 않도록 -180°~180° 안에 붙잡아 둡니다(표시도 이 값을 씁니다).
    const turn = Math.PI * 2;
    s.nextAngle -= Math.round(s.nextAngle / turn) * turn;
    s.spinShown = .6;
  },
  pointerDown() { E3_HUMAN_STACK.action.call(this); },
  /* 단상을 놓친 사람은 잡아 주는 것 없이 계속 떨어집니다. 화면 아래로 완전히 사라지면
     세계에서도 지웁니다 — 보이지 않는 곳에 쌓여 탑을 받치는 일이 없습니다. */
  cullFallen() {
    const M = Phaser.Physics.Matter.Matter, gone = MINI.FIELD.bottom + 20;
    const before = this.people.length;
    for (let i = before - 1; i >= 0; i--) {
      const body = this.people[i];
      if (E3_HUMAN_STACK.project.call(this, 0, body.bounds.min.y).y <= gone) continue;
      M.Composite.remove(this.stackWorld.world, body);
      this.people.splice(i, 1); this.stackBodyById.delete(body.id);
      this.stackGrounded.delete(body.id); this.stackStable.delete(body.id);
    }
    // 그림은 목록 순서대로 다시 그려지므로, 줄어든 뒤 남는 꼬리 그림만 감춥니다.
    for (let i = this.people.length; i < before; i++) this.assetSprites.get(`person${i}`)?.setVisible(false);
  },
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
      const reached = new Set([this.stackBase.id]), queue = [...reached];
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
    if (s.x < t.railLeft || s.x > t.railRight) { s.x = MINI.clamp(s.x, t.railLeft, t.railRight); s.direction *= -1; }
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.impactCooldown = Math.max(0, s.impactCooldown - dt);
    // 좌우를 누르고 있는 동안은 계속 돌아갑니다(터치 버튼도 같은 입력을 씁니다).
    const turn = this.axis('left', 'right');
    if (turn) E3_HUMAN_STACK.spin.call(this, turn * t.spinSpeed * dt);
    s.spinShown = Math.max(0, s.spinShown - dt);
    M.Engine.update(this.stackWorld, dt * 1000);
    E3_HUMAN_STACK.cullFallen.call(this);
    const top = E3_HUMAN_STACK.measureTower.call(this);
    // 대기 위치는 단상 윗면에서 dropHeight만큼 위로 완전히 고정입니다 — 카트가 탑 위를
    // 지나가며 근처 사람 유무가 바뀌어도 이 값 자체는 흔들리지 않습니다. 겹침 방지는
    // 실제로 떨어뜨리는 순간(action)에만 국소적으로 처리합니다.
    s.spawnY = t.baseY - t.dropHeight;
    // 시야는 대기 위치와 실제 탑 높이 중 더 높은(작은 y) 쪽에 맞춰 물러납니다.
    const viewTop = Math.min(s.spawnY, top);
    const desiredZoom = MINI.clamp(t.viewSpan / Math.max(t.viewSpan, t.floorY - viewTop + 62), .35, 1);
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
  drawPerson(poseIndex, key, x, y, angle = 0, alpha = 1, tint = null) {
    const pose = E3_HUMAN_STACK.poses[poseIndex], z = this.state.zoom;
    const p = E3_HUMAN_STACK.project.call(this, x, y), g = this.ink;
    // 그림의 원점은 잘라낸 이미지의 정중앙이라 충돌 사각형과 같은 좌표계를 씁니다.
    const sprite = E3_HUMAN_STACK.sprite.call(this, key, `e3:${pose.id}`);
    if (sprite) {
      sprite.setPosition(p.x, p.y).setDisplaySize(pose.width * z, pose.height * z).setRotation(angle).setAlpha(alpha);
      sprite.clearTint();
    } else {
      // 그림이 없으면 충돌 조각을 그대로 실루엣으로 씁니다. 미리보기와 낙하물이 같은 모양입니다.
      g.save(); g.translateCanvas(p.x, p.y); g.rotateCanvas(angle); g.scaleCanvas(z, z);
      for (const [cx, cy, w, h] of pose.parts) {
        g.fillStyle(0x506c7a, alpha).fillRect(cx - w / 2 - 1.2, cy - h / 2 - 1.2, w + 2.4, h + 2.4);
      }
      for (const [cx, cy, w, h] of pose.parts) g.fillStyle(0xd8e5e8, alpha).fillRect(cx - w / 2, cy - h / 2, w, h);
      g.restore();
    }
    if (!tint) return;
    /*
     * 얼룩 반점은 Sprite의 setTint(4모서리)가 아니라 Graphics로 직접 겹쳐 그린다 — 두 가지
     * 이유다. 1) file://로 열면 게임이 일부러 Canvas 렌더러를 쓰는데(WebGL 텍스처 문제
     * 회피), Canvas 렌더러는 4모서리 그라디언트 틴트를 실제로 그리지 않는다(값은 저장되지만
     * 화면엔 안 나온다). 2) this.ink(g)에 그리면 나중에 생기는 스프라이트가 항상 그 위에
     * 덮이므로 반점이 가려진다 — 그래서 스프라이트보다 depth가 높은 blotchInk에 그린다.
     */
    const bg = this.blotchInk;
    bg.save(); bg.translateCanvas(p.x, p.y); bg.rotateCanvas(angle); bg.scaleCanvas(z, z);
    pose.parts.forEach(([cx, cy, w, h], index) => {
      bg.fillStyle(tint[index % tint.length], alpha * .65).fillRect(cx - w / 2, cy - h / 2, w, h);
    });
    bg.restore();
  },
  render() {
    const s = this.state, t = E3_HUMAN_STACK.tuning, g = this.ink;
    const project = (x, y) => E3_HUMAN_STACK.project.call(this, x, y);
    MINI.frame(this, `HEIGHT ${Math.round(s.height)} / ${t.targetHeight}    ${s.held ? `버티기 ${Math.max(0, t.hold - s.held).toFixed(1)}초 남음` : `목표 높이에서 ${t.hold}초 버티기`}`);
    this.blotchInk.clear();
    const base = project(480 - t.baseWidth / 2, t.baseY);
    MINI.box(this, base.x, base.y, t.baseWidth * s.zoom, t.floorY - base.y, 0x4e6370);
    MINI.line(this, base.x, base.y + 1, base.x + t.baseWidth * s.zoom, base.y + 1, 0xd4dad4, 3);
    for (let height = 0; height <= 400; height += 40) {
      const p = project(350, t.baseY - height);
      if (p.y < 180) continue;
      MINI.line(this, 66, p.y, height % 80 ? 75 : 85, p.y, 0x58818d, 1);
    }
    const goal = project(0, t.baseY - t.targetHeight);
    // 성공선은 대기 위치가 오가는 폭과 같은 길이로 긋습니다 — 놓을 수 있는 범위가 곧 목표 폭입니다.
    const dashFrom = project(t.railLeft, 0).x, dashTo = project(t.railRight, 0).x;
    for (let x = dashFrom; x < dashTo; x += 20) MINI.line(this, x, goal.y, Math.min(x + 10, dashTo), goal.y, 0x96efba, 1);
    // 글자는 짧아진 선의 오른쪽 끝에 붙입니다. 오른쪽 끝의 표지는 높이만 가리키는 붙박이입니다.
    this.stackLabels.goal.setPosition(dashTo + 14, goal.y - 5).setText(s.held ? `버티기 ${Math.max(0, t.hold - s.held).toFixed(1)}초` : '목표 높이 · 3초 유지');
    this.stackLabels.next.setText(`다음: ${E3_HUMAN_STACK.poses[s.nextPose].name}`);
    // 표지는 성공선 오른쪽 끝에 붙어 따라다닙니다. 가슴의 화살표가 선을 가리키며,
    // 시야가 줄어 선이 짧아져도 선 끝과의 간격은 그대로라 크기만 변하지 않습니다.
    const marker = E3_HUMAN_STACK.sprite.call(this, 'goalMark', 'e3:line');
    if (marker) {
      marker.setPosition(dashTo + t.markerGap, goal.y)
        .setDisplaySize(t.markerHeight * E3_SHAPES.line.width / E3_SHAPES.line.height, t.markerHeight);
    }
    // 실제 질량중심으로 회전한 뒤 원래 그림의 기준점을 복구합니다.
    this.people.forEach((body, i) => {
      const pose = body.plugin.e3, c = Math.cos(body.angle), sn = Math.sin(body.angle);
      const x = body.position.x + pose.origin.x * c - pose.origin.y * sn;
      const y = body.position.y + pose.origin.x * sn + pose.origin.y * c;
      E3_HUMAN_STACK.drawPerson.call(this, pose.poseIndex, `person${i}`, x, y, body.angle, 1, pose.tint);
    });
    for (const impact of s.impacts) {
      const p = project(impact.x, impact.y), fade = 1 - impact.age / .35;
      g.lineStyle(1.5, 0xffd99e, fade * .7).strokeEllipse(p.x, p.y, (12 + impact.age * 80) * s.zoom, (4 + impact.age * 25) * s.zoom);
    }
    // 대기 위치는 레일 선 없이 사람만 떠 있습니다 — 움직이는 범위는 사람 자체로 보입니다.
    E3_HUMAN_STACK.drawPerson.call(this, s.nextPose, 'preview', s.x, s.spawnY, s.nextAngle, s.cooldown ? .3 : .8, s.nextTint);
    // 미리보기 위아래 맞은편에 곡선 화살표 하나씩. 둘 다 양쪽 끝에 화살촉이 있어
    // 어느 쪽으로도 돌릴 수 있다는 걸 알립니다. 돌리는 동안 밝아집니다.
    const ring = project(s.x, s.spawnY), pose = E3_HUMAN_STACK.poses[s.nextPose];
    const radius = Math.hypot(pose.width, pose.height) / 2 * s.zoom + 6, glow = Math.min(1, .62 + s.spinShown * .63);
    const head = Math.max(6, 10 * s.zoom);
    for (const middle of [-90, 90]) {
      const a0 = (middle - 50) * Math.PI / 180, a1 = (middle + 50) * Math.PI / 180;
      g.lineStyle(3.2, 0xffd07a, glow);
      g.beginPath(); g.arc(ring.x, ring.y, radius, a0, a1, false); g.strokePath();
      // 양 끝에서 호가 뻗어 나가는 접선 방향으로 화살촉을 세웁니다.
      for (const [angle, dir] of [[a0, -1], [a1, 1]]) {
        const px = ring.x + Math.cos(angle) * radius, py = ring.y + Math.sin(angle) * radius;
        const tx = -Math.sin(angle) * dir, ty = Math.cos(angle) * dir;
        g.fillStyle(0xffd07a, glow).fillTriangle(
          px + tx * head, py + ty * head,
          px - tx * head * .25 - ty * head * .55, py - ty * head * .25 + tx * head * .55,
          px - tx * head * .25 + ty * head * .55, py - ty * head * .25 - tx * head * .55,
        );
      }
    }
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
