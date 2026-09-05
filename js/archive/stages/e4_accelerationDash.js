import { MINI } from './minigame-kit.js';

export const E4_ACCELERATION_DASH = {
  tuning: { turns: 10, speed: 345, gain: 27, maxSpeed: 680, tolerance: 32, minLength: 255, maxLength: 380 },
  build() {
    MINI.init(this, 0xc6a2ff);
    const t = E4_ACCELERATION_DASH.tuning;
    // 계단형 월드 좌표: 매번 길이가 달라지지만 코너 수는 정확히 tuning.turns개.
    const points = [{ x: 0, y: 0 }];
    for (let i = 0; i <= t.turns; i++) {
      const last = points[points.length - 1], length = MINI.rand(t.minLength, t.maxLength, this.random);
      points.push({ x: last.x + (i % 2 === 0 ? length : 0), y: last.y - (i % 2 ? length : 0) });
    }
    this.state = { points, segment: 0, progress: 0, misses: 0, retry: 0 };
  },
  action() {
    const s = this.state, t = E4_ACCELERATION_DASH.tuning;
    if (s.retry || s.segment >= t.turns) return;
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    this.actions++;
    if (Math.abs(length - s.progress) <= t.tolerance) {
      s.segment++; s.progress = 0; this.sfx('hit');
    } else E4_ACCELERATION_DASH.miss.call(this);
  },
  pointerDown() { E4_ACCELERATION_DASH.action.call(this); },
  press(direction) {
    const expected = this.state.segment % 2 === 0 ? 'up' : 'right';
    if (direction === expected) E4_ACCELERATION_DASH.action.call(this);
    else if (['left', 'right', 'up', 'down'].includes(direction)) { this.actions++; E4_ACCELERATION_DASH.miss.call(this); }
  },
  miss() { this.state.misses++; this.state.progress = 0; this.state.retry = .22; MINI.summon(this); this.bump(); },
  update(dt) {
    const s = this.state, t = E4_ACCELERATION_DASH.tuning;
    s.retry = Math.max(0, s.retry - dt);
    if (!s.retry) s.progress += Math.min(t.maxSpeed, t.speed + s.segment * this.penalty(t.gain)) * dt;
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (s.segment === t.turns && s.progress >= length) this.finish(true);
    else if (s.progress > length + t.tolerance) E4_ACCELERATION_DASH.miss.call(this);
    this.anomaly = `속도 ${Math.round(Math.min(t.maxSpeed, t.speed + s.segment * this.penalty(t.gain)))} · 코너 ${s.segment}/${t.turns}`;
    this.risk = s.segment * 9;
  },
  render() {
    const s = this.state, t = E4_ACCELERATION_DASH.tuning;
    MINI.frame(this, `TURN ${s.segment} / ${t.turns}    MISS ${s.misses}    ${s.segment < t.turns ? `다음 ${s.segment % 2 === 0 ? 'W ↑' : 'D →'} · 초록 구역에서 꺾기` : '마지막 직선!'}`);
    const a = s.points[s.segment], b = s.points[s.segment + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    const px = a.x + (b.x - a.x) * s.progress / length, py = a.y + (b.y - a.y) * s.progress / length;
    // 진행 방향을 오른쪽으로 회전해 다음 코너를 충분히 미리 보여줍니다.
    const vertical = s.segment % 2 === 1;
    const project = p => vertical ? { x: 330 - (p.y - py), y: 365 + (p.x - px) } : { x: 330 + p.x - px, y: 365 + p.y - py };
    for (let i = Math.max(0, s.segment - 1); i < Math.min(s.points.length - 1, s.segment + 3); i++) {
      const p = project(s.points[i]), q = project(s.points[i + 1]);
      MINI.line(this, p.x, p.y, q.x, q.y, 0x443564, 60);
      MINI.line(this, p.x, p.y, q.x, q.y, 0x957ab7, 2);
      if (i < t.turns) MINI.goal(this, q.x, q.y, t.tolerance);
      else MINI.goal(this, q.x, q.y, 25);
    }
    const pop = MINI.spawnScale(this);
    MINI.actor(this, 'player', 'player', 330, 365, 28 * pop, 28 * pop, Math.PI / 4);
    MINI.spawnFx(this, 330, 365, 28);
    MINI.meter(this, s.segment / t.turns);
  },
};
