import { MINI } from './minigame-kit.js';

const PLAYER = Object.freeze({ width: 30, height: 44 });
const GROUND_Y = 474;

const moveTowardZero = (value, amount) => (
  Math.abs(value) <= amount ? 0 : value - Math.sign(value) * amount
);

function makeTarget() {
  const first = 1 + Math.floor(Math.random() * 9);
  return `${first}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
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
    MINI.init(this, 0xf4c76b);
    const target = makeTarget();
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
    };

    this.digitBlocks = Array.from({ length: 10 }, (_, digit) => ({
      digit: String(digit),
      x: 38 + digit * 89,
      y: 250,
      w: 68,
      h: 50,
    }));
    const targetStyle = {
      fontFamily: 'monospace', fontSize: '42px', fontStyle: 'bold',
      color: '#fff4bf', stroke: '#7a315a', strokeThickness: 3,
    };
    this.targetGlyphs = [...target].map((digit, index) => this.add.text(420 + index * 40, 193, digit, targetStyle).setOrigin(.5));
    // 글자를 다 가로지르지 않고, 숫자 위에 짧게 겹치는 선 2개만 얹는다.
    this.targetScribbles = [...target].flatMap((digit, index) => {
      const x = 420 + index * 40;
      const offset = (Number(digit) * 5 + index * 3) % 7 - 3;
      return [
        { x1: x - 15, y1: 178 + offset, x2: x + 15, y2: 188 + offset, color: 0xff4f87, width: 3 },
        { x1: x - 14, y1: 198 - offset, x2: x + 14, y2: 208 - offset, color: 0x67e8ff, width: 2 },
      ];
    });
    this.scribbleInk = this.add.graphics();
    this.blockLabels = this.digitBlocks.map(block => this.add.text(block.x + block.w / 2, block.y + block.h / 2, block.digit, {
      fontFamily: 'monospace', fontSize: '27px', fontStyle: 'bold', color: '#102536',
    }).setOrigin(.5));
    this.inputText = this.add.text(480, 348, '', {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#eaf7ff',
    }).setOrigin(.5);
    this.feedbackText = this.add.text(480, 389, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#a8c6d2',
    }).setOrigin(.5);
  },

  press(direction) {
    if (direction !== 'left' && direction !== 'right') return;
    const s = this.state;
    s.directionPresses += 1;
    s.friction = Math.max(
      E10_NUMBER_DECODE.tuning.minFriction,
      E10_NUMBER_DECODE.tuning.baseFriction - s.directionPresses * E10_NUMBER_DECODE.tuning.frictionLoss,
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
    const t = E10_NUMBER_DECODE.tuning;
    const axis = this.axis('left', 'right');
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

    this.anomaly = `마찰 ${Math.round(s.friction)} · 가속력 ${Math.round(traction * 100)}% · 오답 ${s.mistakes}회`;
    this.risk = (t.baseFriction - s.friction) / (t.baseFriction - t.minFriction) * 100;
  },

  render() {
    const s = this.state;
    MINI.frame(this, `AI READ ERROR    TARGET 4 DIGITS    INPUT ${s.input.length}/4`);

    MINI.box(this, 347, 157, 266, 74, 0x2b1735, .96);
    MINI.line(this, 358, 218, 602, 218, 0x78e9ff, 1);
    this.scribbleInk.clear();
    this.targetScribbles.forEach(stroke => {
      this.scribbleInk.lineStyle(stroke.width, stroke.color, .94).lineBetween(stroke.x1, stroke.y1, stroke.x2, stroke.y2);
    });

    this.digitBlocks.forEach((block, index) => {
      const active = s.lastHit === block.digit && this.elapsed <= s.feedbackUntil;
      const color = active ? (s.lastHitCorrect ? 0x93fca0 : 0xff6f8f) : 0xf4c76b;
      MINI.box(this, block.x, block.y, block.w, block.h, color, active ? 1 : .88);
      MINI.line(this, block.x + 5, block.y + block.h, block.x + block.w - 5, block.y + block.h, 0xffffff, .8);
      this.blockLabels[index].setColor(active && !s.lastHitCorrect ? '#fff4f7' : '#102536');
    });

    MINI.box(this, 333, 324, 294, 49, 0x16384b, .94);
    const shown = Array.from({ length: 4 }, (_, index) => s.input[index] ?? '＿').join(' ');
    this.inputText.setText(shown);
    this.feedbackText.setText(this.elapsed <= s.feedbackUntil ? s.feedback : '목표 숫자를 왼쪽부터 차례로 입력하세요.');
    this.feedbackText.setColor(this.elapsed <= s.feedbackUntil && !s.lastHitCorrect ? '#ff9bb7' : '#a8c6d2');

    MINI.box(this, 22, GROUND_Y, 916, 12, 0x557073);
    const speed = Math.abs(s.vx);
    if (speed > 25) {
      const direction = Math.sign(s.vx);
      for (let index = 0; index < 4; index++) {
        const trailX = s.x - direction * (25 + index * 16);
        MINI.line(this, trailX, s.y + 12 + index * 2, trailX - direction * (12 + speed / 30), s.y + 12 + index * 2, 0x8cecff, 1);
      }
    }
    MINI.actor(this, 'player', 'player', s.x, s.y, PLAYER.width, PLAYER.height, MINI.clamp(s.vx / 700, -.22, .22));
    MINI.meter(this, s.input.length / s.target.length);
  },
};
