import { STACK_RULES, stackBlockWidth, createStackState, dropStack, stepStack, nextStackBlock } from "../stack-core.mjs";
import { clamp } from "./shared.mjs";

// Stage 5: stack. Hooks run with the shared Phaser scene as this.
export const e5 = {
  id: "stack",
  build() {
    this.actions = 0; this.risk = 0; this.anomaly = "다음 무게 1.00×";
    this.state = createStackState();
    this.drawWalls([{ x: 480 - STACK_RULES.baseWidth / 2, y: 480, w: STACK_RULES.baseWidth, h: 22 }], 0x315169, 0x789bb7);
    this.stackArt = this.add.graphics().setDepth(4);
    this.player = this.add.rectangle(480, 80, STACK_RULES.width, 38, 0xffca75).setStrokeStyle(2, 0xffe1ad).setDepth(5);
    this.stackText = this.add.text(650, 460, "STACK 0 / 6", { fontFamily: "monospace", fontSize: "16px", color: "#93fca0" });
  },

  update(dt) {
    const s = this.state, previous = { x: s.x, y: s.y, radius: s.radius };
    const result = stepStack(s, dt);
    this.checkFragment(this.fragmentBody(), previous);
    this.risk = clamp((30 - s.margin) / 30 * 100, 0, 100);
    this.anomaly = `다음 무게 ${(1 + Math.min(s.blocks.length, 5) * STACK_RULES.massStep).toFixed(2)}×`;
    this.stackArt.clear();
    for (const block of s.blocks) {
      this.stackArt.fillStyle(0x487e94).fillRect(block.x - block.w / 2, block.y - 19, block.w, 38);
      this.stackArt.lineStyle(2, 0x9cdcef).strokeRect(block.x - block.w / 2, block.y - 19, block.w, 38);
    }
    if (s.blocks.length) {
      const mass = s.blocks.reduce((n, b) => n + b.mass, 0);
      const center = s.blocks.reduce((n, b) => n + b.x * b.mass, 0) / mass;
      this.stackArt.lineStyle(2, s.margin < 12 ? 0xff7979 : 0x93fca0, 0.8).lineBetween(center, 240, center, 500);
    }
    this.stackText.setText(`STACK ${s.blocks.length} / 6`);
    if (result.landed && !result.failed && s.blocks.length < STACK_RULES.count) nextStackBlock(s);
    this.player.setPosition(s.x, s.y).setDisplaySize(stackBlockWidth(Math.min(s.blocks.length, 5)), 38).setVisible(s.blocks.length < STACK_RULES.count && !result.failed);
    if (result.failed) this.finish(false, "무게중심 이탈 · 기록 붕괴");
    else if (result.cleared) this.finish(true);
  },

  release(direction) { if (this.state.direction === direction) this.state.direction = null; },
  press(direction) { this.state.direction = direction; },
  action() { if (dropStack(this.state)) this.actions++; },
  pointer() {
    if (!this.state.dropping && this.state.blocks.length < STACK_RULES.count) this.primaryAction();
  },
  handlesFragmentUpdate: true,
};
