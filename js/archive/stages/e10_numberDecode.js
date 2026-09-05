import { MINI } from './minigame-kit.js';

// 가로 조준 폭은 유지하고, 세로는 96px 스프라이트의 실제 머리~발 높이에 맞춘다.
const PLAYER = Object.freeze({ width: 30, height: 84 });
const GROUND_Y = 474;
// 왼쪽을 보는 정사각 셀 4열. 해상도는 시트에서 읽고 발끝은 셀 높이의 95%에 맞춘다.
const E10_SKATER = Object.freeze({ size: 96, foot: .95, columns: 4 });
const E10_FROST = Object.freeze({ veil: .28, facet: .66 });

const moveTowardZero = (value, amount) => (
  Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount
);

function makeTarget(random = Math.random) {
  const first = 1 + Math.floor(random() * 9);
  return `${first}${Math.floor(random() * 10)}${Math.floor(random() * 10)}${Math.floor(random() * 10)}`;
}

export const E10_NUMBER_DECODE = {
  tuning: {
    acceleration: 1250,
    maxSpeed: 300,
    gravity: 1650,
    jump: 700,
    baseFriction: 820,
    frictionLoss: 150,
    minFriction: 70,
    minTraction: .32,
  },

  traction(state) {
    const t = E10_NUMBER_DECODE.tuning;
    return Math.max(t.minTraction, state.friction / t.baseFriction);
  },

  build() {
    MINI.init(this, 0x8cecff);
    const target = makeTarget(this.random);
    this.state = {
      x: 480,
      y: GROUND_Y - PLAYER.height / 2,
      vx: 0,
      vy: 0,
      grounded: true,
      target,
      input: '',
      directionPresses: 0,
      friction: E10_NUMBER_DECODE.tuning.baseFriction,
      mistakes: 0,
      feedback: '숫자 블록의 아랫면을 점프로 터치하세요.',
      feedbackUntil: 2.2,
      lastHit: null,
      lastHitCorrect: true,
      facing: -1,
      glidePhase: 0,
      jumpAt: -1,
      landedAt: -1,
      iceMarks: [],
      iceChips: [],
      lastMarkX: 480,
    };

    // 일반 이미지 로더를 그대로 사용해 file://에서도 시트를 읽고, 프레임은 한 번만 등록한다.
    for (const [role, count] of [['glide', 4], ['jump', 8]]) {
      const key = `e10:${role}`;
      if (!this.textures.exists(key)) continue;
      const texture = this.textures.get(key);
      const source = texture.getSourceImage();
      const cell = source.width / E10_SKATER.columns;
      if (!Number.isInteger(cell) || cell <= 0 || source.height !== cell * count / E10_SKATER.columns) continue;
      for (let index = 0; index < count; index++) {
        const frame = `pose-${index}`;
        if (!texture.has(frame)) texture.add(frame, 0,
          index % E10_SKATER.columns * cell,
          Math.floor(index / E10_SKATER.columns) * cell,
          cell, cell);
      }
    }
    this.skater = null;
    if (this.textures.exists('e10:glide') && this.textures.exists('e10:jump')
      && this.textures.get('e10:glide').has('pose-3') && this.textures.get('e10:jump').has('pose-7')) {
      this.skater = this.add.image(480, GROUND_Y, 'e10:glide', 'pose-0')
        .setOrigin(.5, E10_SKATER.foot)
        .setDisplaySize(E10_SKATER.size, E10_SKATER.size).setMask(this.ink.mask);
    }
    this.add.text(480, 239, 'CHA JUN-HWAN  /  ICE CODE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: '#b5d5e4', letterSpacing: 2,
    }).setOrigin(.5);
    this.add.text(769, 178, 'MILANO CORTINA 2026', {
      fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#e3f7ff',
    }).setOrigin(.5);
    this.add.text(769, 205, '2026 밀라노 동계올림픽', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#a4cadb',
    }).setOrigin(.5);

    this.digitBlocks = Array.from({ length: 10 }, (_, digit) => ({
      digit: String(digit),
      x: 38 + digit * 89,
      y: 250,
      w: 68,
      h: 50,
    }));
    const targetStyle = {
      fontFamily: 'monospace', fontSize: '42px', fontStyle: 'bold',
      color: '#91b5c5', stroke: '#30516a', strokeThickness: 1,
    };
    this.targetGlyphs = [...target].map((digit, index) => this.add.text(420 + index * 40, 193, digit, targetStyle).setOrigin(.5));
    // 숫자 위에 서리를 얹는다. 결정 배치는 정답과 무관하고 플레이 중에는 움직이지 않는다.
    this.targetFrost = Array.from({ length: 4 }, (_, index) => ({ x: 420 + index * 40, offset: index * 3 % 5 - 2 }));
    this.frostInk = this.add.graphics().setMask(this.ink.mask);
    this.blockLabels = this.digitBlocks.map(block => this.add.text(block.x + block.w / 2, block.y + block.h / 2, block.digit, {
      fontFamily: 'monospace', fontSize: '27px', fontStyle: 'bold', color: '#102536',
    }).setOrigin(.5));
    this.inputText = this.add.text(480, 348, '', {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#eaf7ff',
    }).setOrigin(.5);
    this.feedbackText = this.add.text(480, 389, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#a8c6d2',
    }).setOrigin(.5);
    // 캐릭터가 점수판/안내 글자 뒤로 숨지 않도록 표시 순서만 올린다.
    this.skater?.setDepth(2);
  },

  press(direction) {
    if (direction !== 'left' && direction !== 'right') return;
    const s = this.state;
    s.directionPresses += 1;
    s.friction = Math.max(
      E10_NUMBER_DECODE.tuning.minFriction,
      E10_NUMBER_DECODE.tuning.baseFriction - s.directionPresses * this.penalty(E10_NUMBER_DECODE.tuning.frictionLoss),
    );
    s.feedback = `방향 입력 ${s.directionPresses}회 · 바닥이 더 미끄러워졌습니다.`;
    s.feedbackUntil = this.elapsed + 1.15;
    this.actions += 1;
  },

  action() {
    const s = this.state;
    if (!s.grounded) return;
    s.vy = -E10_NUMBER_DECODE.tuning.jump;
    s.grounded = false;
    s.jumpAt = this.elapsed;
    this.actions += 1;
    this.sfx('jump');
  },

  enterDigit(digit) {
    const s = this.state;
    s.lastHit = digit;
    s.input += digit;

    if (s.input.length < s.target.length) {
      s.lastHitCorrect = true;
      s.feedback = `입력 ${s.input.length}/4 · ${s.input}`;
      s.feedbackUntil = this.elapsed + 1;
      this.sfx('action');
      return;
    }

    const correct = s.input === s.target;
    s.lastHitCorrect = correct;
    if (!correct) {
      const wrongInput = s.input;
      s.input = '';
      s.mistakes += 1;
      s.feedback = `오답 ${wrongInput} · 입력값이 초기화되었습니다.`;
      s.feedbackUntil = this.elapsed + 1.2;
      this.bump();
      return;
    }

    this.sfx('action');
    this.finish(true, `CODE ${s.target} 해독`);
  },

  update(dt) {
    const s = this.state;
    const wasGrounded = s.grounded;
    const t = E10_NUMBER_DECODE.tuning;
    const axis = this.axis('left', 'right');
    if (s.grounded && axis) s.facing = axis;
    const traction = E10_NUMBER_DECODE.traction(s);
    if (axis) s.vx = MINI.clamp(s.vx + axis * t.acceleration * traction * dt, -t.maxSpeed, t.maxSpeed);
    else s.vx = moveTowardZero(s.vx, s.friction * dt);

    s.x += s.vx * dt;
    if (s.x < 34 || s.x > 926) {
      s.x = MINI.clamp(s.x, 34, 926);
      s.vx *= -.24;
      this.bump();
    }

    const previousTop = s.y - PLAYER.height / 2;
    s.vy += t.gravity * dt;
    s.y += s.vy * dt;
    const currentTop = s.y - PLAYER.height / 2;

    if (s.vy < 0) {
      const hit = this.digitBlocks.find(block => {
        const bottom = block.y + block.h;
        const overlapsX = s.x + PLAYER.width / 2 > block.x && s.x - PLAYER.width / 2 < block.x + block.w;
        return overlapsX && previousTop >= bottom - 1 && currentTop <= bottom;
      });
      if (hit) {
        s.y = hit.y + hit.h + PLAYER.height / 2 + .5;
        s.vy = 95;
        E10_NUMBER_DECODE.enterDigit.call(this, hit.digit);
      }
    }

    if (s.y + PLAYER.height / 2 >= GROUND_Y && s.vy >= 0) {
      s.y = GROUND_Y - PLAYER.height / 2;
      s.vy = 0;
      s.grounded = true;
    } else {
      s.grounded = false;
    }

    if (s.grounded && !wasGrounded) {
      s.landedAt = this.elapsed;
      s.lastMarkX = s.x;
      if (this.settings.effects) {
        for (let index = 0; index < 10; index++) s.iceChips.push({
          x: s.x, y: GROUND_Y - 1, vx: (index - 4.5) * 22 + s.vx * .15,
          vy: -45 - index % 3 * 25, age: 0,
        });
      }
    }
    // 관성 이동은 선 자세로 활주하고, 방향 입력으로 밀 때만 다리를 움직인다.
    if (s.grounded && axis) s.glidePhase += Math.abs(s.vx) * dt / 95;
    else s.glidePhase = 0;
    if (this.settings.effects) {
      if (s.grounded && Math.abs(s.x - s.lastMarkX) >= 5) {
        s.iceMarks.push({ from: s.lastMarkX, to: s.x, age: 0 });
        s.lastMarkX = s.x;
      } else if (!s.grounded) s.lastMarkX = s.x;
      s.iceMarks.forEach(mark => { mark.age += dt; });
      s.iceMarks = s.iceMarks.filter(mark => mark.age < 1.6).slice(-160);
      s.iceChips.forEach(chip => {
        chip.age += dt; chip.vy += 320 * dt;
        chip.x += chip.vx * dt; chip.y += chip.vy * dt;
      });
      s.iceChips = s.iceChips.filter(chip => chip.age < .38);
    } else {
      s.iceMarks.length = 0; s.iceChips.length = 0; s.lastMarkX = s.x;
    }

    this.anomaly = `마찰 ${Math.round(s.friction)} · 가속력 ${Math.round(traction * 100)}% · 오답 ${s.mistakes}회`;
    this.risk = (t.baseFriction - s.friction) / (t.baseFriction - t.minFriction) * 100;
  },

  render() {
    const s = this.state;
    E10_NUMBER_DECODE.renderRink.call(this);

    MINI.box(this, 347, 157, 266, 74, 0x24465d, .98);
    this.ink.lineStyle(1, 0x9adbec, .7).strokeRoundedRect(347, 157, 266, 74, 5);
    E10_NUMBER_DECODE.renderFrost.call(this);

    this.digitBlocks.forEach((block, index) => {
      const active = s.lastHit === block.digit && this.elapsed <= s.feedbackUntil;
      const color = active ? (s.lastHitCorrect ? 0x93fca0 : 0xff6f8f) : 0xc1eaf2;
      MINI.box(this, block.x, block.y, block.w, block.h, color, active ? 1 : .88);
      MINI.line(this, block.x + 5, block.y + block.h, block.x + block.w - 5, block.y + block.h, 0xffffff, .8);
      this.blockLabels[index].setColor(active && !s.lastHitCorrect ? '#fff4f7' : '#102536');
    });

    MINI.box(this, 333, 324, 294, 49, 0x16384b, .94);
    const shown = Array.from({ length: 4 }, (_, index) => s.input[index] ?? '＿').join(' ');
    this.inputText.setText(shown);
    this.feedbackText.setText(this.elapsed <= s.feedbackUntil ? s.feedback : '목표 숫자를 왼쪽부터 차례로 입력하세요.');
    this.feedbackText.setColor(this.elapsed <= s.feedbackUntil && !s.lastHitCorrect ? '#ff9bb7' : '#a8c6d2');

    E10_NUMBER_DECODE.renderSkater.call(this);
    MINI.meter(this, s.input.length / s.target.length);
  },

  renderRink() {
    const g = this.ink, f = MINI.FIELD, s = this.state;
    g.clear();
    g.fillStyle(0x0b1d32).fillRect(f.x, f.y, f.w, f.h);
    // 관중석과 천장 조명은 게임 정보를 가리지 않게 낮은 대비로 그린다.
    for (let row = 0; row < 3; row++) {
      for (let x = 42; x < f.right; x += 28) {
        g.fillStyle(row % 2 ? 0x29435b : 0x23364e, .65)
          .fillRoundedRect(x, 80 + row * 15, 15, 6, 2);
      }
    }
    g.lineStyle(2, 0x6fc6dd, .3).lineBetween(f.x, 147, f.right, 147);
    // 빙상장 벽의 흰 오륜 깃발과 대회 현수막. HUD·목표·조작 블록 사이의 빈 공간에 배치한다.
    g.lineStyle(2, 0x6b91a7, .65).lineBetween(124, 148, 124, 231);
    g.fillStyle(0xf4f8fa, .95).fillRect(126, 163, 152, 66);
    g.fillStyle(0xd8e4eb, .5).fillTriangle(126, 163, 143, 163, 126, 229);
    const rings = [
      [171, 189, 0x0879bb], [201, 189, 0x202833], [231, 189, 0xe44353],
      [186, 203, 0xf4b82e], [216, 203, 0x179354],
    ];
    for (const [x, y, color] of rings) g.lineStyle(2.5, color, 1).strokeCircle(x, y, 12);
    g.fillStyle(0x16354b, .9).fillRoundedRect(640, 157, 257, 74, 5);
    for (const [index, color] of [0x379e78, 0xe9f5f8, 0xd95e68].entries()) {
      g.fillStyle(color, .8).fillRect(640 + index * 257 / 3, 228, 257 / 3, 3);
    }
    for (const x of [85, 875]) {
      g.fillStyle(0x9ae9ff, .035).fillTriangle(x, 148, x - 130, GROUND_Y, x + 130, GROUND_Y);
    }
    g.fillStyle(0x213e55).fillRect(f.x, GROUND_Y - 6, f.w, 6);
    g.fillStyle(0xc7e5ed).fillRect(f.x, GROUND_Y, f.w, f.bottom - GROUND_Y);
    g.fillStyle(0xe7faff).fillRect(f.x, GROUND_Y, f.w, 3);
    g.lineStyle(2, 0x749fb8, .28).strokeEllipse(480, 510, 410, 52);
    g.lineStyle(1, 0x749fb8, .24).lineBetween(480, GROUND_Y + 3, 480, f.bottom);
    for (let i = 0; i < 15; i++) {
      const x = 35 + i * 64, y = 484 + i % 4 * 17;
      g.lineStyle(1, 0xffffff, .28).lineBetween(x, y, x + 42, y + 3);
    }
    const shadow = MINI.clamp(1 - (GROUND_Y - s.y - PLAYER.height / 2) / 230, .25, 1);
    g.fillStyle(0x33536c, shadow * .2).fillEllipse(s.x, GROUND_Y + 4, 30 * shadow, 5 * shadow);
    for (const mark of s.iceMarks) {
      g.lineStyle(1, 0x568eac, (1 - mark.age / 1.6) * .6);
      g.lineBetween(mark.from, GROUND_Y + 2, mark.to, GROUND_Y + 2);
      g.lineBetween(mark.from, GROUND_Y + 5, mark.to, GROUND_Y + 5);
    }
    for (const chip of s.iceChips) {
      g.fillStyle(0xeaffff, 1 - chip.age / .38).fillRect(chip.x, chip.y, 2, 2);
    }
  },

  renderFrost() {
    const g = this.frostInk;
    g.clear();
    g.fillStyle(0xc9ecf6, E10_FROST.veil).fillRoundedRect(397, 166, 166, 55, 4);
    for (const { x, offset } of this.targetFrost) {
      const top = [
        { x: x - 19, y: 168 }, { x: x + 15, y: 168 },
        { x: x + 9, y: 179 + offset }, { x: x + 15, y: 187 + offset },
        { x: x - 5, y: 183 + offset }, { x: x - 15, y: 197 + offset },
      ];
      const bottom = [
        { x: x + 18, y: 189 + offset }, { x: x + 19, y: 218 },
        { x: x - 16, y: 219 }, { x: x - 10, y: 207 + offset },
        { x: x - 16, y: 200 + offset }, { x: x + 3, y: 204 + offset },
      ];
      g.fillStyle(0xe3f6fc, E10_FROST.facet).fillPoints(top, true);
      g.fillStyle(0xa9dbe9, E10_FROST.facet).fillPoints(bottom, true);
      g.lineStyle(1, 0xf1fcff, .52).strokePoints(top, true);
      g.lineStyle(1, 0xf1fcff, .45).strokePoints(bottom, true);
      g.fillStyle(0xffffff, .36).fillTriangle(x - 19, 168, x + 15, 168, x - 10, 177);
      // 작은 서리 알갱이. 효과 설정을 꺼도 암호를 가리는 얼음은 유지한다.
      for (let i = 0; i < 28; i++) {
        const px = x - 18 + (i * 13 % 37), py = 169 + (i * 19 + offset * 3 + 60) % 49;
        g.fillStyle(0xf4fdff, .25 + i % 3 * .12).fillRect(px, py, i % 4 === 0 ? 2 : 1, 1);
      }
    }
    // 가장자리의 두꺼운 성에와 작은 고드름으로 얼어붙은 전광판을 표현한다.
    g.fillStyle(0xd7f3fc, .72).fillRect(350, 158, 260, 4);
    for (let i = 0; i < 17; i++) {
      const x = 352 + i * 15;
      g.fillStyle(0xc1eafa, .58).fillTriangle(x, 161, x + 9, 161, x + 3, 166 + i % 4 * 3);
    }
  },

  renderSkater() {
    const s = this.state;
    if (!this.skater) {
      MINI.actor(this, 'player', 'player', s.x, s.y, PLAYER.width, PLAYER.height);
      return;
    }
    let role = 'glide', frame = 0;
    if (!s.grounded) {
      role = 'jump';
      const age = Math.max(0, this.elapsed - s.jumpAt);
      if (s.vy > 0 && GROUND_Y - (s.y + PLAYER.height / 2) < 45) frame = 6;
      else if (age < .12) frame = age < .06 ? 0 : 1;
      else frame = 2 + Math.floor((age - .12) * 24) % 4;
    } else if (s.landedAt >= 0 && this.elapsed - s.landedAt < .24) {
      role = 'jump'; frame = this.elapsed - s.landedAt < .12 ? 6 : 7;
    } else if (this.axis('left', 'right') && Math.abs(s.vx) > 12) {
      frame = Math.floor(s.glidePhase * 4) % 4;
    }
    this.skater.setTexture(`e10:${role}`, `pose-${frame}`)
      .setDisplaySize(E10_SKATER.size, E10_SKATER.size)
      .setPosition(s.x, s.y + PLAYER.height / 2)
      .setFlipX(s.facing > 0);
  },
};
