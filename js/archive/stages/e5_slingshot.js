import { MINI } from './minigame-kit.js';

export const E5_SLINGSHOT = {
  tuning: { force: 8.4, decay: .045, minPower: .76, gravity: 640, maxPull: 112, cooldown: .5, targetHP: 38, collapseDamage: .19 },
  build() {
    MINI.init(this, 0xd9bc7a);
    this.state = { shots: 0, cooldown: 0, drag: null, balls: [], targets: [], crumbs: [], feedback: '', feedbackAge: 0, combo: 0 };
    // Three two-storey cookie towers. Destroying a base removes the support above it.
    for (let col = 0; col < 3; col++) {
      const x = 606 + col * 108;
      this.state.targets.push({ x, y: 421, w: 60, h: 50, hp: E5_SLINGSHOT.tuning.targetHP, vy: 0, support: null, flash: 0 });
      this.state.targets.push({ x, y: 371, w: 60, h: 50, hp: E5_SLINGSHOT.tuning.targetHP, vy: 0, support: col * 2, flash: 0 });
    }
    this.cookieNotice = this.add.text(480, 182, '', { fontFamily: 'Arial, sans-serif', fontSize: '23px', color: '#ffe6a7', stroke: '#221e21', strokeThickness: 4 }).setOrigin(.5).setDepth(8);
    this.add.text(178, 463, '두쫀쿠', { fontFamily: 'Arial', fontSize: '14px', color: '#e7d09d' }).setOrigin(.5);
    this.add.text(744, 332, '두딱쿠 · 아래부터 무너뜨려 보세요', { fontFamily: 'Arial', fontSize: '14px', color: '#e7d09d' }).setOrigin(.5);
    this.instruction.setText('두쫀쿠를 뒤로 당겼다 놓으세요 · 아래 두딱쿠를 깨면 연쇄 붕괴!');
  },
  power() { return Math.max(E5_SLINGSHOT.tuning.minPower, 1 - this.state.shots * E5_SLINGSHOT.tuning.decay); },
  pointerDown(x, y) {
    if (this.state.cooldown || this.state.drag || Math.hypot(x - 164, y - 382) > 55) return;
    this.state.drag = { x: 164, y: 382 };
    E5_SLINGSHOT.pointerMove.call(this, x, y);
  },
  pointerMove(x, y) {
    if (!this.state.drag) return;
    const dx = x - 164, dy = y - 382, scale = Math.min(1, E5_SLINGSHOT.tuning.maxPull / Math.max(1, Math.hypot(dx, dy)));
    this.state.drag = { x: 164 + dx * scale, y: 382 + dy * scale };
  },
  pointerUp() {
    const s = this.state, d = s.drag, t = E5_SLINGSHOT.tuning;
    if (!d) return;
    s.drag = null;
    if (Math.hypot(d.x - 164, d.y - 382) < 8) return;
    const power = E5_SLINGSHOT.power.call(this);
    s.balls.push({ x: d.x, y: d.y, vx: (164 - d.x) * t.force * power, vy: (382 - d.y) * t.force * power, power, age: 0, hit: new Set(), id: s.shots, squash: 0, trail: [] });
    s.shots++; this.actions++; s.cooldown = t.cooldown; s.combo = 0; this.sfx('jump');
  },
  cancelInput() { this.state.drag = null; },
  damage(target, amount, collapse = false) {
    if (target.hp <= 0) return;
    target.hp = Math.max(0, target.hp - amount); target.flash = .18;
    const s = this.state, broken = target.hp === 0;
    // Cosmetic randomness never changes damage or collision results.
    if (this.settings.effects) for (let i = 0; i < (broken ? 14 : 5); i++) {
      s.crumbs.push({ x: target.x + target.w / 2, y: target.y + target.h / 2,
        vx: MINI.rand(-170, 170), vy: MINI.rand(-230, -55), age: 0, size: MINI.rand(2, 6),
        color: i % 3 ? 0x9b6544 : 0xc0bd70 });
    }
    if (broken) {
      s.combo++; s.feedback = collapse ? '와르르! 두딱쿠 연쇄 붕괴' : s.combo > 1 ? s.combo + '개 연속 파괴!' : '바삭! 두딱쿠 파괴';
      s.feedbackAge = 1.1; this.sfx('hit');
      if (this.settings.shake) this.cameras.main.shake(70, .002);
    } else { s.feedback = '쩍! 한 번 더!'; s.feedbackAge = .65; this.sfx('hit'); }
  },
  update(dt) {
    const s = this.state, t = E5_SLINGSHOT.tuning;
    s.cooldown = Math.max(0, s.cooldown - dt); s.feedbackAge = Math.max(0, s.feedbackAge - dt);
    for (const b of s.balls) {
      b.age += dt; b.squash = Math.max(0, b.squash - dt);
      b.vy += t.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.settings.effects) {
        b.trail.unshift({ x: b.x, y: b.y }); b.trail.length = Math.min(12, b.trail.length);
      }
      if (b.y > 457) { b.y = 457; b.vy *= -.36; b.vx *= .78; b.squash = .18; }
      s.targets.forEach((target, i) => {
        if (target.hp <= 0 || b.hit.has(i) || !MINI.hit({ x: b.x - 12, y: b.y - 12, w: 24, h: 24 }, target)) return;
        E5_SLINGSHOT.damage.call(this, target, Math.max(6, Math.hypot(b.vx, b.vy) * .1 * b.power));
        b.hit.add(i); b.vx *= .73; b.vy -= 60; b.squash = .2;
      });
    }
    for (const o of s.targets) {
      o.flash = Math.max(0, o.flash - dt);
      if (o.hp <= 0 || o.support === null || s.targets[o.support].hp > 0 || o.y + o.h >= 471) continue;
      o.vy += t.gravity * dt; o.y += o.vy * dt;
      if (o.y + o.h >= 471) {
        o.y = 471 - o.h;
        E5_SLINGSHOT.damage.call(this, o, o.vy * t.collapseDamage, true); o.vy = 0;
      }
    }
    s.crumbs = s.crumbs.filter(c => {
      c.age += dt; c.vy += 580 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      return c.age < .75;
    });
    s.balls = s.balls.filter(b => {
      const keep = b.age < 3.2 && b.x < 980 && b.x > -30;
      if (!keep) { this.assetSprites.get('ball' + b.id)?.destroy(); this.assetSprites.delete('ball' + b.id); }
      return keep;
    });
    const left = s.targets.filter(o => o.hp > 0).length;
    this.anomaly = '쫀득 탄성 ' + Math.round(E5_SLINGSHOT.power.call(this) * 100) + '% · 두딱쿠 ' + left + '개';
    this.risk = (1 - E5_SLINGSHOT.power.call(this)) * 180;
    if (!left) this.finish(true, s.shots + '발로 두딱쿠 6개 파괴');
  },
  cookie(role, key, x, y, w, h, angle = 0) {
    if (this.textures.exists('e5:' + role)) { MINI.actor(this, role, key, x, y, w, h, angle); return; }
    const g = this.ink; g.save(); g.translateCanvas(x, y); g.rotateCanvas(angle);
    if (role === 'projectile') {
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
    const s = this.state, d = s.drag ?? { x: 164, y: 382 }, power = E5_SLINGSHOT.power.call(this), t = E5_SLINGSHOT.tuning;
    const broken = s.targets.filter(o => o.hp <= 0).length;
    MINI.frame(this, '두쫀쿠 vs 두딱쿠     파괴 ' + broken + ' / 6     탄성 ' + Math.round(power * 100) + '%');
    // Warm pastry counter, trays and reserves keep the play field readable.
    MINI.box(this, 22, 444, 916, 34, 0x372923);
    MINI.box(this, 22, 471, 916, 9, 0xb98e62);
    for (let i = 0; i < 3; i++) {
      MINI.box(this, 598 + i * 108, 471, 76, 5, 0xd3b278);
      E5_SLINGSHOT.cookie.call(this, 'projectile', 'reserve' + i, 62 + i * 29, 450, 23, 22);
    }
    MINI.line(this, 146, 447, 137, 358, 0xa78260, 14);
    MINI.line(this, 146, 404, 184, 357, 0xa78260, 12);
    MINI.line(this, 137, 360, d.x, d.y, 0x6c4630, 7);
    MINI.line(this, 137, 360, d.x, d.y, 0xe9c18c, 3);
    MINI.line(this, 184, 357, d.x, d.y, 0xe9c18c, 4);
    const pull = Math.hypot(d.x - 164, d.y - 382) / t.maxPull;
    if (s.cooldown === 0) E5_SLINGSHOT.cookie.call(this, 'projectile', 'ready', d.x, d.y, 29 + pull * 11, 29 - pull * 6, s.drag ? Math.atan2(382 - d.y, 164 - d.x) : 0);
    else MINI.hideActor(this, 'ready');
    if (s.drag) {
      let x = d.x, y = d.y, vx = (164 - d.x) * t.force * power, vy = (382 - d.y) * t.force * power;
      for (let frame = 0; frame < 150; frame++) {
        vy += t.gravity / 120; x += vx / 120; y += vy / 120;
        const hit = s.targets.some(o => o.hp > 0 && MINI.hit({ x: x - 12, y: y - 12, w: 24, h: 24 }, o));
        if (hit || y > 457) { this.ink.lineStyle(2, 0xffdc90, .8).strokeCircle(x, Math.min(457, y), 14); break; }
        if (frame % 7 === 0) MINI.circle(this, x, y, 2.4, 0xffe1b8, 1 - frame / 170);
      }
      MINI.box(this, 88, 282, 126, 8, 0x4c3d30);
      MINI.box(this, 88, 282, 126 * pull, 8, pull > .8 ? 0xc7d981 : 0xe3bc7d);
    }
    s.targets.forEach((o, i) => {
      if (o.hp <= 0) { MINI.hideActor(this, 'target' + i); return; }
      E5_SLINGSHOT.cookie.call(this, 'target', 'target' + i, o.x + o.w / 2, o.y + o.h / 2, o.w, o.h);
      if (o.hp < t.targetHP) {
        MINI.line(this, o.x + 29, o.y + 3, o.x + 20, o.y + 20, 0x38281f, 3);
        MINI.line(this, o.x + 20, o.y + 20, o.x + 35, o.y + 29, 0x38281f, 3);
        MINI.line(this, o.x + 35, o.y + 29, o.x + 24, o.y + 47, 0x38281f, 3);
      }
      if (this.settings.effects && o.flash) MINI.box(this, o.x, o.y, o.w, o.h, 0xffedbe, o.flash * 2);
    });
    for (const b of s.balls) {
      for (let i = 0; i < b.trail.length; i += 2) MINI.circle(this, b.trail[i].x, b.trail[i].y, 5 - i * .25, 0xbac480, .22 * (1 - i / 12));
      E5_SLINGSHOT.cookie.call(this, 'projectile', 'ball' + b.id, b.x, b.y, 26 + b.squash * 30, 26 - b.squash * 20, Math.atan2(b.vy, b.vx));
    }
    for (const c of s.crumbs) MINI.box(this, c.x, c.y, c.size, c.size, c.color, 1 - c.age / .75);
    this.cookieNotice.setText(s.feedbackAge > 0 ? s.feedback : '').setAlpha(Math.min(1, s.feedbackAge * 3));
    MINI.meter(this, broken / 6);
  },
};
