import { MINI } from './minigame-kit.js';

export const E3_HUMAN_STACK = {
  tuning: { speed: 245, speedGain: 42, maxSpeed: 920, targetHeight: 206, hold: .6, dropCooldown: .3 },
  build() {
    MINI.init(this, 0xffc27e);
    const M = Phaser.Physics.Matter.Matter;
    this.stackWorld = M.Engine.create();
    this.stackWorld.gravity.y = 1.7;
    this.stackWorld.positionIterations = 8;
    M.Composite.add(this.stackWorld.world, [
      M.Bodies.rectangle(480, 488, 916, 24, { isStatic: true, friction: .9 }),
      M.Bodies.rectangle(480, 448, 160, 56, { isStatic: true, friction: .9 }),
    ]);
    this.state = { x: 270, direction: 1, drops: 0, cooldown: 0, held: 0, height: 0 };
    this.people = [];
  },
  action() {
    const s = this.state;
    if (s.cooldown > 0) return;
    const M = Phaser.Physics.Matter.Matter;
    // 어깨가 넓고 발이 있는 사람 모양 복합 강체. 넘어져도 월드에서 제거하지 않습니다.
    const x = s.x, y = 192;
    const body = M.Body.create({ parts: [
      M.Bodies.rectangle(x, y + 4, 76, 17),
      M.Bodies.rectangle(x - 17, y + 18, 17, 18), M.Bodies.rectangle(x + 17, y + 18, 17, 18),
      M.Bodies.circle(x, y - 14, 11),
    ], friction: .85, frictionStatic: 1.2, restitution: .02 });
    M.Composite.add(this.stackWorld.world, body);
    this.people.push(body); s.drops++; this.actions++; s.cooldown = E3_HUMAN_STACK.tuning.dropCooldown;
    this.sfx('hit');
  },
  pointerDown() { E3_HUMAN_STACK.action.call(this); },
  update(dt) {
    const s = this.state, t = E3_HUMAN_STACK.tuning, M = Phaser.Physics.Matter.Matter;
    s.x += s.direction * Math.min(t.maxSpeed, t.speed + s.drops * t.speedGain) * dt;
    if (s.x < 260 || s.x > 700) { s.x = MINI.clamp(s.x, 260, 700); s.direction *= -1; }
    s.cooldown = Math.max(0, s.cooldown - dt);
    M.Engine.update(this.stackWorld, dt * 1000);
    // 떠 있는 낙하물은 높이로 세지 않습니다. 실제로 받쳐진 느린 강체만 집계합니다.
    const settled = this.people.filter(b => b.speed < .7 && Math.abs(b.angularVelocity) < .035 && b.position.y > 225);
    s.height = settled.length ? Math.max(0, 420 - Math.min(...settled.map(b => b.bounds.min.y))) : 0;
    s.held = s.height >= t.targetHeight ? s.held + dt : 0;
    this.anomaly = `낙하 속도 ${Math.round(Math.min(t.maxSpeed, t.speed + s.drops * t.speedGain))} · 잔해 ${s.drops}명`;
    this.risk = Math.min(100, s.drops * 7);
    if (s.held >= t.hold) this.finish(true, `${s.drops}명으로 ${Math.round(s.height)} 높이`);
  },
  render() {
    const s = this.state, targetY = 420 - E3_HUMAN_STACK.tuning.targetHeight;
    MINI.frame(this, `HEIGHT ${Math.round(s.height)} / ${E3_HUMAN_STACK.tuning.targetHeight}    HOLD ${s.held.toFixed(1)}s`);
    MINI.box(this, 22, 477, 916, 12, 0x475667); MINI.box(this, 400, 420, 160, 57, 0x6b7285);
    MINI.line(this, 220, targetY, 740, targetY, 0xa7ffc6);
    this.people.forEach((body, i) => MINI.actor(this, 'person', `person${i}`, body.position.x, body.position.y, 78, 50, body.angle, i % 2 ? 0x8baaff : 0xffc27e));
    MINI.line(this, s.x, 151, s.x, 190, 0x91b4c1, 1);
    MINI.actor(this, 'person', 'preview', s.x, 182, 78, 50, 0);
    MINI.meter(this, s.height / E3_HUMAN_STACK.tuning.targetHeight);
  },
  dispose() {
    if (!this.stackWorld) return;
    const M = Phaser.Physics.Matter.Matter;
    M.Composite.clear(this.stackWorld.world, false); M.Engine.clear(this.stackWorld); this.stackWorld = null;
  },
};
