import { MINI } from './minigame-kit.js';

export const E7_ROULETTE = {
  tuning: { minSpeed: 9, maxSpeed: 24, minSpinSeconds: 1.4, extraTurns: 2 },
  build() {
    MINI.init(this, 0xfca8d6);
    this.add.text(723, 243, '당첨', { fontFamily: 'Arial', fontSize: '18px', color: '#ffcf7b' });
    this.add.text(723, 276, '꽝', { fontFamily: 'Arial', fontSize: '18px', color: '#a6b7ce' });
    this.state = { rotation: MINI.rand(0, Math.PI * 2), misses: 0, spinning: false, speed: 0, drag: null, cooldown: 0 };
  },
  pointerDown(x, y) {
    const s = this.state, radius = Math.hypot(x - 480, y - 321);
    if (s.spinning || s.cooldown || radius < 25 || radius > 155) return;
    s.drag = { last: Math.atan2(y - 321, x - 480), travel: 0, age: 0, velocity: 0, idle: 0 };
  },
  pointerMove(x, y) {
    const s = this.state, d = s.drag;
    if (!d) return;
    const angle = Math.atan2(y - 321, x - 480);
    const delta = Math.atan2(Math.sin(angle - d.last), Math.cos(angle - d.last));
    d.travel += Math.abs(delta); d.velocity = delta / Math.max(.016, d.idle); d.idle = 0; d.last = angle; s.rotation += delta;
  },
  pointerUp() {
    const s = this.state, d = s.drag, t = E7_ROULETTE.tuning;
    s.drag = null;
    if (!d || d.travel < .1) return;
    const direction = Math.sign(d.velocity) || 1;
    s.speed = direction * MINI.clamp(Math.abs(d.velocity), t.minSpeed, t.maxSpeed);
    // 균일한 한 바퀴의 추가 회전량으로 최종 각도를 균일하게 만듭니다.
    // 속도/당기는 위치에 관계없이 면적 1/N이 실제 당첨 확률 1/N이 됩니다.
    // extraTurns는 정수 바퀴이므로 균일성은 그대로 두고 회전량만 늘립니다.
    // 이 회전량에 맞는 마찰로 자연스럽게 멈추며, 당첨 판정 자체는 정지한 칸을 따릅니다.
    const travel = Math.abs(s.speed) * t.minSpinSeconds / 2 + t.extraTurns * Math.PI * 2 + MINI.rand(0, Math.PI * 2);
    s.deceleration = s.speed * s.speed / (2 * travel);
    s.spinning = true; this.actions++; this.sfx('click');
  },
  cancelInput() { this.state.drag = null; },
  update(dt) {
    const s = this.state;
    s.cooldown = Math.max(0, s.cooldown - dt);
    if (s.drag) { s.drag.age += dt; s.drag.idle += dt; }
    if (s.spinning) {
      const movingDt = Math.min(dt, Math.abs(s.speed) / s.deceleration);
      const next = Math.sign(s.speed) * Math.max(0, Math.abs(s.speed) - s.deceleration * dt);
      s.rotation += (s.speed + next) * .5 * movingDt; s.speed = next;
      if (Math.abs(next) < .001) {
        s.spinning = false;
        const tau = Math.PI * 2, atPointer = ((-Math.PI / 2 - s.rotation) % tau + tau) % tau;
        if (atPointer < tau / (2 * (s.misses + 1))) this.finish(true, `${this.actions}번째 추첨 당첨`);
        else { s.misses++; s.cooldown = .35; this.sfx('failure'); }
      }
    }
    this.anomaly = `당첨 영역 1/${2 * (s.misses + 1)} · ${s.spinning ? '추첨 중' : s.cooldown ? '꽝! 다시 돌리세요' : '룰렛을 휙 돌리세요'}`;
    this.risk = Math.min(100, s.misses * 17);
  },
  render() {
    const s = this.state, tau = Math.PI * 2, angle = tau / (2 * (s.misses + 1));
    MINI.frame(this, `PRIZE DRAW    당첨 영역 1 / ${2 * (s.misses + 1)}    ${s.spinning ? '돌아가는 중…' : '마우스로 원을 따라 휙! '}`);
    MINI.circle(this, 480, 321, 158, 0x725779); MINI.circle(this, 480, 321, 150, 0x2b344c);
    const points = [{ x: 480, y: 321 }];
    for (let i = 0; i <= 60; i++) points.push({ x: 480 + Math.cos(s.rotation + angle * i / 60) * 150, y: 321 + Math.sin(s.rotation + angle * i / 60) * 150 });
    this.ink.fillStyle(0xffcf7b).fillPoints(points, true);
    for (let i = 0; i < 40; i++) {
      const a = s.rotation + i * tau / 40;
      MINI.circle(this, 480 + Math.cos(a) * 153, 321 + Math.sin(a) * 153, 2, 0xfff1dd);
    }
    MINI.circle(this, 480, 321, 28, 0x142c3b);
    MINI.actor(this, 'prize', 'prize', 480, 321, 30, 30, 0, 0xfca8d6);
    MINI.spike(this, 465, 151, 30, 28, 0xfaffec);
    MINI.line(this, 675, 254, 707, 254, 0xffcf7b, 14);
    MINI.line(this, 675, 287, 707, 287, 0x66748f, 14);
  },
};
