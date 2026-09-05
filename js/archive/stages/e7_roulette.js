import { MINI } from './minigame-kit.js';

export const E7_ROULETTE = {
  tuning: { countryCount: 8, minSpeed: 2.4, maxSpeed: 10, friction: 4, frictionDecay: .78, minFriction: 1.5 },
  build() {
    MINI.init(this, 0xfca8d6);
    this.state = { rotation: MINI.rand(0, Math.PI * 2, this.random), misses: 0, spinning: false, speed: 0, drag: null, cooldown: 0, poseAge: 0, result: '' };
    const opponents = ['멕시코', '남아공', '체코'];
    this.state.target = opponents[Math.floor(MINI.rand(0, opponents.length, this.random))];
    const sheet = this.textures.get('e7:coach');
    for (let i = 0; i < 4; i++) if (!sheet.has('pose' + i)) sheet.add('pose' + i, 0, i * 400, 0, 400, 793);
    const back = this.textures.get('e7:coachBack');
    if (!back.has('back')) back.add('back', 0, 580, 390, 380, 760);
    this.coach = this.add.image(624, 175, 'e7:coach', 'pose0').setOrigin(0).setScale(.43).setDepth(3);
    this.coachBack = this.add.image(757, 496, 'e7:coachBack', 'back').setOrigin(.5, 1).setDisplaySize(150, 300).setDepth(3).setVisible(false);
    const textStyle = { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#fff2cb', stroke: '#101d32', strokeThickness: 4 };
    this.drawTitle = this.add.text(165, 290, '', { ...textStyle, align: 'center', lineSpacing: 12 }).setOrigin(.5);
    this.drawResult = this.add.text(480, 520, '', textStyle).setOrigin(.5).setDepth(4);
    this.countryLabels = [];
    E7_ROULETTE.prepareCountries.call(this);
    this.instruction.setText('원판에서 세로·대각선으로 쭉 그어 놓으세요 · 빠를수록 강하게');
  },
  prepareCountries() {
    const s = this.state;
    s.countries = [s.target, ...['멕시코', '남아공', '체코', '일본', '프랑스', '브라질', '독일', '이탈리아'].filter(country => country !== s.target)].slice(0, E7_ROULETTE.tuning.countryCount);
    for (const label of this.countryLabels) label.destroy();
    this.countryLabels = s.countries.map(country => this.add.text(0, 0, country, {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffffff', stroke: '#18243b', strokeThickness: 3,
    }).setOrigin(.5).setDepth(2));
  },
  pointerDown(x, y) {
    const s = this.state, radius = Math.hypot(x - 480, y - 321);
    if (s.spinning || s.cooldown || radius > 155) return;
    s.drag = { startX: x, startY: y, x, y, travel: 0, sweep: 0, age: 0, idle: 0 };
  },
  pointerMove(x, y) {
    const s = this.state, d = s.drag;
    if (!d) return;
    if (x === d.x && y === d.y) return;
    d.x = x; d.y = y; d.idle = 0;
    const dx = x - d.startX, dy = y - d.startY;
    // Straight strokes work anywhere on the wheel, including through its centre.
    // Downward/right-down strokes turn clockwise; upward strokes reverse it.
    const direction = Math.abs(dy) >= Math.abs(dx) * .5 ? Math.sign(dy) : -Math.sign(dx);
    d.travel = Math.hypot(dx, dy) / 100;
    d.sweep = direction * d.travel;
  },
  pointerUp() {
    const s = this.state, d = s.drag, t = E7_ROULETTE.tuning;
    s.drag = null;
    if (!d) return;
    // The gesture imparts momentum without letting the mouse place the wheel.
    // A quicker sweep over the same arc launches faster, in the swipe direction.
    const speed = E7_ROULETTE.swipeSpeed.call(this, d);
    if (d.travel < .12 || Math.abs(speed) < t.minSpeed) { s.result = '조금 더 빠르게 슥 돌려주세요'; return; }
    s.speed = speed;
    s.deceleration = E7_ROULETTE.friction.call(this);
    s.spinning = true; s.poseAge = 0; s.result = ''; this.actions++; this.sfx('click');
  },
  swipeSpeed(d) {
    return MINI.clamp(d.sweep / Math.max(.06, d.age) * Math.exp(-Math.max(0, d.idle - .08) / .12), -E7_ROULETTE.tuning.maxSpeed, E7_ROULETTE.tuning.maxSpeed);
  },
  friction() { const t = E7_ROULETTE.tuning; return Math.max(t.minFriction, t.friction * t.frictionDecay ** this.state.misses); },
  cancelInput() { this.state.drag = null; },
  update(dt) {
    const s = this.state;

    s.cooldown = Math.max(0, s.cooldown - dt);

    if (s.spinning) s.poseAge += dt;
    if (s.drag) { s.drag.age += dt; s.drag.idle += dt; }
    if (s.spinning) {
      const movingDt = Math.min(dt, Math.abs(s.speed) / s.deceleration);
      const next = Math.sign(s.speed) * Math.max(0, Math.abs(s.speed) - s.deceleration * dt);
      s.rotation += (s.speed + next) * .5 * movingDt; s.speed = next;
      if (Math.abs(next) < .001) {
        s.spinning = false;
        const tau = Math.PI * 2, atPointer = ((0 - s.rotation) % tau + tau) % tau;
        if (atPointer < tau / s.countries.length) this.finish(true, `${this.actions}번째 추첨 당첨`);
        else {
          const selected = s.countries[Math.min(s.countries.length - 1, Math.floor(atPointer / tau * s.countries.length))];
          s.misses++; s.cooldown = 1.1; s.result = selected + '… 축이 더 헐거워졌어요. 다음엔 힘을 조절해보세요'; this.sfx('failure');
        }
      }
    }
    this.anomaly = s.spinning ? '관성으로 회전 중' : s.cooldown ? '축이 더 헐거워졌습니다' : '힘을 조절해 목표 국가를 맞히세요';
    this.risk = Math.min(100, s.misses * 17);
  },
  flag(country, x, y) {
    const g = this.ink, w = 30, h = 18, left = x - 15, top = y - 9;
    g.fillStyle(0xffffff).fillRect(left - 1, top - 1, w + 2, h + 2);
    g.fillStyle(0xffffff).fillRect(left, top, w, h);
    if (country === '멕시코' || country === '프랑스' || country === '이탈리아') {
      g.fillStyle(country === '프랑스' ? 0x002395 : 0x006847).fillRect(left, top, 10, h);
      g.fillStyle(0xce2939).fillRect(left + 20, top, 10, h);
      if (country === '멕시코') g.fillStyle(0x916d32).fillCircle(x, y, 2.5);
    } else if (country === '일본') g.fillStyle(0xbc002d).fillCircle(x, y, 5);
    else if (country === '체코') {
      g.fillStyle(0xd7141a).fillRect(left, y, w, 9);
      g.fillStyle(0x11457e).fillTriangle(left, top, x, y, left, top + h);
    } else if (country === '독일') {
      g.fillStyle(0x171717).fillRect(left, top, w, 6);
      g.fillStyle(0xdd0000).fillRect(left, top + 6, w, 6);
      g.fillStyle(0xffce00).fillRect(left, top + 12, w, 6);
    } else if (country === '브라질') {
      g.fillStyle(0x009739).fillRect(left, top, w, h);
      g.fillStyle(0xffdf00).fillPoints([{x:left+2,y},{x,y:top+2},{x:left+w-2,y},{x,y:top+h-2}], true);
      g.fillStyle(0x002776).fillCircle(x, y, 5);
      g.lineStyle(1, 0xffffff).lineBetween(x - 4, y - 1, x + 4, y + 1);
    } else {
      g.fillStyle(0xde3831).fillRect(left, top, w, 9);
      g.fillStyle(0x002395).fillRect(left, y, w, 9);
      g.lineStyle(9, 0xffffff).lineBetween(left, top, x, y).lineBetween(left, top+h, x, y).lineBetween(x,y,left+w,y);
      g.lineStyle(5, 0x007a4d).lineBetween(left, top, x,y).lineBetween(left,top+h,x,y).lineBetween(x,y,left+w,y);
      g.fillStyle(0xffb612).fillTriangle(left,top+2,left+11,y,left,top+h-2);
      g.fillStyle(0x000000).fillTriangle(left,top+4,left+8,y,left,top+h-4);
    }
  },
  render() {
    const s = this.state, tau = Math.PI * 2, count = s.countries.length, angle = tau / count, f = MINI.FIELD;
    const rotation = s.rotation;
    MINI.frame(this);
    MINI.box(this, f.x, f.y, f.w, f.h, 0x101e36);
    // Draw-stage curtains, gold trim, floor and wheel pedestal.
    for (let x = 30; x < 940; x += 48) MINI.box(this, x, f.y, 22, f.h, 0x253454, .3);
    MINI.box(this, 20, 493, 920, 86, 0x172337);
    MINI.line(this, 35, 493, 925, 493, 0xcfa762, 2);
    MINI.box(this, 464, 420, 32, 74, 0x987441);
    MINI.box(this, 418, 484, 124, 12, 0xcfa762);
    MINI.circle(this, 480, 321, 160, 0xcfa762);
    for (let sector = 0; sector < count; sector++) {
      const points = [{ x: 480, y: 321 }];
      for (let i = 0; i <= 40; i++) {
        const a = rotation + angle * (sector + i / 40);
        points.push({ x: 480 + Math.cos(a) * 150, y: 321 + Math.sin(a) * 150 });
      }
      this.ink.fillStyle(sector === 0 ? 0xd5a64e : sector % 2 ? 0x345777 : 0x243d5f).fillPoints(points, true);
      const a = rotation + angle * (sector + .5);
      E7_ROULETTE.flag.call(this, s.countries[sector], 480 + Math.cos(a) * 108, 311 + Math.sin(a) * 108);
      this.countryLabels[sector].setPosition(480 + Math.cos(a) * 108, 335 + Math.sin(a) * 108).setFontSize(15);
    }
    for (let i = 0; i < 40; i++) {
      const a = rotation + i * tau / 40;
      MINI.circle(this, 480 + Math.cos(a) * 155, 321 + Math.sin(a) * 155, 2, 0xfff1dd);
    }
    MINI.circle(this, 480, 321, 25, 0xcfa762);
    MINI.circle(this, 480, 321, 17, 0x172337);
    this.ink.fillStyle(0xfff2bd).fillTriangle(644, 321, 665, 310, 665, 332);
    const failed = s.cooldown > 0 || (this.mode === 'done' && this.remaining <= 0);
    this.coach.setVisible(!failed).setFrame('pose' + (s.spinning ? Math.min(3, Math.floor(s.poseAge / .12)) : 0));
    this.coachBack.setVisible(failed);
    this.drawTitle.setText('대한민국의 상대\n\n목표 ' + s.target + '\n마찰 ' + Math.round(E7_ROULETTE.friction.call(this) / E7_ROULETTE.tuning.friction * 100) + '%');
    if (s.drag) {
      const power = Math.abs(E7_ROULETTE.swipeSpeed.call(this, s.drag)) / E7_ROULETTE.tuning.maxSpeed;
      MINI.box(this, 365, 513, 230, 9, 0x34455a);
      MINI.box(this, 365, 513, 230 * power, 9, power * E7_ROULETTE.tuning.maxSpeed >= E7_ROULETTE.tuning.minSpeed ? 0xe9bd68 : 0x90a4b7);
    }
    this.drawResult.setText(s.drag ? '' : s.cooldown ? s.result : s.spinning ? '관성으로 회전 중' : s.result);
  },
};