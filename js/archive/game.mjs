import { STAGES } from "./data.mjs";
import { createProgressStore } from "./progress.mjs";
import { MEMORY_FRAGMENTS, touchesFragment } from "./fragments.mjs";
import { createArchiveRunState } from "./run-state.mjs";
import { audio } from "./audio.mjs";

import { PHYSICS } from "./level-data.mjs";
import { WIDTH, HEIGHT, clamp, emit } from "./stages/shared.mjs";
import { STAGE_GAMES } from "./stages/index.mjs";
const lightOverlay = document.querySelector("#light-overlay");
const corruptionOverlay = document.querySelector("#corruption");
const playLayer = document.querySelector("#game-container");

window.archiveAudio = audio;
let progressStorage = null;
try { progressStorage = window.localStorage; } catch { /* Session-only fallback. */ }
window.archiveProgress = createProgressStore(STAGES.map((stage) => stage.id), progressStorage);
window.archiveRun = createArchiveRunState(STAGES.map((stage) => stage.id));
window.addEventListener("archive-sfx", (event) => audio.play(event.detail?.name));

/*
 * ── 개입 디버프 = 모니터 스크린 흔들림 ─────────────────────────────
 *
 * 기록을 건드려 디버프가 붙는 순간마다 스크린 안이 한 번 흔들린다.
 * 세기와 길이는 언제나 같다 — 쌓인 양에 따라 커지면 후반에는 공도 HUD도
 * 읽을 수 없고, 흔들림이 "몇 번째 개입인지"가 아니라 "얼마나 망가졌는지"를
 * 말하게 된다. 쌓인 양은 화면 노이즈(#corruption)가 이미 보여준다.
 *
 * 흔드는 대상은 기록이 재생되는 화면(#game-container — 캔버스와 그 위 효과)뿐이다.
 * HUD(.hud-layer의 스테이지 안내 · 남은 시간 · 일시정지)는 기록이 아니라 관리자의
 * 계기판이라 흔들리지 않는다. 매 순간 읽어야 하는 값들이라 흔들리면 읽을 수 없다.
 * 베젤·주사선·반사광도 모니터 유리라서 고정이다 — 같이 움직이면 화면이 아니라
 * 모니터가 흔들린 것처럼 보인다.
 */
const SHAKE_AMPLITUDE = 18;   // px(스크린 좌표 1440 기준). 매번 같은 값이다.
const SHAKE_SECONDS = 0.3;    // 한 번 흔드는 시간.
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
const screenShake = {
  remaining: 0,  // 남은 흔들림 시간(초). 0이면 멈춰 있다.
  frame: 0,      // 진행 중인 rAF 핸들.
  last: 0,
};

function writeScreenShake(x, y, rotate, zoom) {
  if (!playLayer) return;
  const still = x === 0 && y === 0;
  playLayer.style.setProperty("--shake-x", `${x.toFixed(2)}px`);
  playLayer.style.setProperty("--shake-y", `${y.toFixed(2)}px`);
  playLayer.style.setProperty("--shake-rotate", `${rotate.toFixed(3)}deg`);
  playLayer.style.setProperty("--shake-zoom", zoom.toFixed(4));
  playLayer.classList.toggle("is-shaking", !still);
}

function stepScreenShake(now) {
  screenShake.frame = 0;
  const dt = Math.min(0.05, Math.max(0, (now - screenShake.last) / 1000));
  screenShake.last = now;
  screenShake.remaining = Math.max(0, screenShake.remaining - dt);
  if (screenShake.remaining <= 0) { writeScreenShake(0, 0, 0, 1); return; }

  // 끝에서 뚝 끊기지 않도록 한 번의 흔들림 안에서만 잦아든다. 시작 세기는 항상 같다.
  const fade = screenShake.remaining / SHAKE_SECONDS;
  const amplitude = SHAKE_AMPLITUDE * fade;
  // 일정한 진동이 아니라 신호가 튀는 느낌이 나도록 주기가 다른 사인을 겹친다.
  const t = now / 1000;
  const x = (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 71.3) * 0.4) * amplitude;
  const y = (Math.sin(t * 43.7) * 0.55 + Math.sin(t * 89.9) * 0.45) * amplitude * 0.8;
  const rotate = Math.sin(t * 23.3) * fade * 0.45;
  /*
   * 흔든 만큼 가장자리에 스크린 바탕이 드러난다. 진폭에 비례해 살짝 확대해 덮되
   * 다 덮을 만큼 키우지는 않는다 — 스크린 바탕도 캔버스도 같은 남색이라 이음매가
   * 거의 안 보이는 반면, 확대가 커지면 흔들림이 아니라 화면이 튀는 것으로 보인다.
   */
  writeScreenShake(x, y, rotate, 1 + amplitude / 700);
  screenShake.frame = requestAnimationFrame(stepScreenShake);
}

/* 디버프 한 번 = 흔들림 한 번. 흔드는 중에 또 붙어도 겹쳐서 커지지 않고 처음부터 다시 흔든다. */
function kickScreenShake() {
  if (!playLayer || reduceMotion?.matches) return;
  screenShake.remaining = SHAKE_SECONDS;
  if (screenShake.frame) return;
  screenShake.last = performance.now();
  screenShake.frame = requestAnimationFrame(stepScreenShake);
}

function stopScreenShake() {
  screenShake.remaining = 0;
  if (screenShake.frame) cancelAnimationFrame(screenShake.frame);
  screenShake.frame = 0;
  writeScreenShake(0, 0, 0, 1);
}

class ArchiveGame extends Phaser.Scene {
  constructor() {
    super("archive-game");
    this.stageId = null;
    this.mode = "idle";
    this.remaining = PHYSICS.timeLimit;
    this.settings = window.archiveSettings || { shake: true, effects: true };
    this.pausedByMenu = false;
    this.debuffRisk = 0;
  }

  create() {
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [this.input.keyboard.addKey(codes.W), this.input.keyboard.addKey(codes.UP)],
      down: [this.input.keyboard.addKey(codes.S), this.input.keyboard.addKey(codes.DOWN)],
      left: [this.input.keyboard.addKey(codes.A), this.input.keyboard.addKey(codes.LEFT)],
      right: [this.input.keyboard.addKey(codes.D), this.input.keyboard.addKey(codes.RIGHT)],
      action: this.input.keyboard.addKey(codes.SPACE),
    };
    this.input.keyboard.addCapture([codes.W, codes.A, codes.S, codes.D, codes.UP, codes.DOWN, codes.LEFT, codes.RIGHT, codes.SPACE]);
    this.input.on("pointerdown", (pointer) => {
      if (this.mode === "playing" && !this.pausedByMenu) this.pointerAction(pointer.worldX, pointer.worldY);
    });

    window.archiveGame = {
      loadStage: (id) => this.loadStage(id),
      start: () => this.startStage(),
      press: (direction) => this.directionPress(direction),
      release: (direction) => this.directionRelease(direction),
      action: () => this.primaryAction(),
      pause: (value) => {
        this.pausedByMenu = Boolean(value);
        // 멈춘 화면이 떨리면 정지가 아니라 버벅임으로 보인다.
        if (this.pausedByMenu) stopScreenShake();
      },
      stop: () => this.stopGame(),
      applySettings: (value) => {
        this.settings = value;
        if (!this.settings.shake) stopScreenShake();
      },
    };
    emit("archive-game-ready", { scene: this, stages: STAGES });
  }

  loadStage(id) {
    this.stageGame = STAGE_GAMES[id];
    if (!this.stageGame) throw new Error(`Unknown stage: ${id}`);
    this.stageId = id;
    this.mode = "ready";
    this.remaining = PHYSICS.timeLimit;
    this.elapsed = 0;
    this.timePenalty = 0;
    this.pausedByMenu = false;
    this.children.removeAll(true);
    this.tweens.killAll();
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor("#07141d");
    this.setCorruption(0);
    lightOverlay.classList.remove("is-active");
    this.drawBackdrop();
    this.stageGame.build.call(this);
    this.buildFragment();
    this.sendHud();
  }

  startStage() {
    if (!this.stageId) return;
    this.loadStage(this.stageId);
    this.mode = "playing";
    this.remaining = PHYSICS.timeLimit;
    emit("archive-sfx", { name: "click" });
  }

  stopGame() {
    this.mode = "idle";
    this.pausedByMenu = false;
    this.setCorruption(0);
    lightOverlay.classList.remove("is-active");
  }

  drawBackdrop() {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x153746, 0.34);
    for (let x = 32; x < WIDTH; x += 32) grid.lineBetween(x, 0, x, HEIGHT);
    for (let y = 28; y < HEIGHT; y += 32) grid.lineBetween(0, y, WIDTH, y);
    this.add.text(24, 18, "ARCHIVE SIMULATION SPACE", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#315a6c",
    }).setDepth(1);
  }

  drawWalls(walls, color = 0x205568, stroke = 0x55b7ce) {
    const graphics = this.add.graphics();
    for (const wall of walls) {
      graphics.fillStyle(color, 1).fillRect(wall.x, wall.y, wall.w, wall.h);
      graphics.lineStyle(1, stroke, 0.55).strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
    }
    return graphics;
  }

  drawGoal(x, y, radius = 25, label = "RESTORE") {
    const ring = this.add.circle(x, y, radius, 0x93fca0, 0.1).setStrokeStyle(3, 0x93fca0, 0.92).setDepth(3);
    this.add.circle(x, y, 5, 0xc8ffd0, 0.92).setDepth(3);
    this.add.text(x, y + radius + 10, label, { fontFamily: "monospace", fontSize: "10px", color: "#93fca0" }).setOrigin(0.5).setDepth(3);
    this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.35, yoyo: true, repeat: -1, duration: 760 });
    return ring;
  }

  shake(duration, intensity) {
    if (this.settings.shake) this.cameras.main.shake(duration, intensity);
  }

  flash(duration, r, g, b) {
    if (this.settings.effects) this.cameras.main.flash(duration, r, g, b, false);
  }

  /*
   * 개입 디버프 한 곳. 스테이지마다 risk에 배율을 곱해 넘기므로(예: 탄성은 0.25배)
   * 화면 노이즈와 스크린 떨림이 같은 값을 따라간다 — 세기 조절은 호출부에서 한다.
   */
  setCorruption(risk) {
    corruptionOverlay.style.opacity = this.settings.effects ? String(clamp(risk / 230, 0, 0.48)) : "0";
    this.markDebuff(risk);
  }

  /*
   * 디버프가 오른 순간을 잡아 스크린을 한 번 흔든다. risk는 스테이지마다 배율이 다르지만
   * 여기서는 "올랐는지"만 보므로 흔들림은 어느 스테이지에서나 똑같다.
   */
  markDebuff(risk) {
    const next = Math.max(0, risk);
    const rose = next > this.debuffRisk + 0.001;
    this.debuffRisk = next;
    if (rose) {
      if (this.settings.shake && !this.pausedByMenu) kickScreenShake();
      return;
    }
    if (next <= 0) stopScreenShake();
  }

  sendHud() {
    emit("archive-hud", {
      remaining: this.remaining,
      actions: this.actions ?? 0,
      anomaly: this.anomaly ?? "대기",
      risk: this.risk ?? 0,
      fragmentCollected: this.fragmentCollected,
      fragmentHint: this.fragment?.hint,
      wallHits: this.stageGame?.wallHits?.call(this) ?? null,
      timePenalty: this.timePenalty,
    });
  }

  readKeyboard() {
    const groups = [["up", this.keys.up], ["down", this.keys.down], ["left", this.keys.left], ["right", this.keys.right]];
    for (const [direction, keys] of groups) {
      for (const key of keys) {
        if (Phaser.Input.Keyboard.JustDown(key)) this.directionPress(direction);
        if (Phaser.Input.Keyboard.JustUp(key)) this.directionRelease(direction);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) this.primaryAction();
  }

  update(_time, deltaMs) {
    this.readKeyboard();
    if (this.mode !== "playing" || this.pausedByMenu) return;
    // 누적 2:23은 Phaser가 실제 플레이 프레임을 진행할 때만 차감한다.
    // 스테이지 종료를 넘긴 프레임의 남는 시간까지 누적 시간에서 빼지 않는다.
    emit("archive-play-time", { deltaMs: Math.min(deltaMs, this.remaining * 1000) });
    if (this.mode !== "playing" || this.pausedByMenu) return;
    const dt = Math.min(deltaMs / 1000, 0.025);
    this.elapsed += Math.min(this.remaining, deltaMs / 1000);
    this.remaining = Math.max(0, this.remaining - deltaMs / 1000);
    if (this.remaining <= 0) { this.finish(false); this.sendHud(); return; }
    const previous = this.fragmentBody();
    this.stageGame.update.call(this, dt);
    if (this.mode === "playing" && !this.stageGame.handlesFragmentUpdate) this.checkFragment(this.fragmentBody(), previous);
    this.updateFragmentFollower();
    this.sendHud();
    if (this.remaining <= 0 && this.mode === "playing") this.finish(false);
  }

  directionPress(direction) {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    this.stageGame.press?.call(this, direction);
  }

  directionRelease(direction) {
    if (this.mode !== "playing") return;
    this.stageGame.release?.call(this, direction);
  }

  primaryAction() {
    if (this.mode !== "playing" || this.pausedByMenu) return;
    this.stageGame.action?.call(this);
  }

  pointerAction(x, y) {
    this.stageGame?.pointer?.call(this, x, y);
  }

  finish(success, extra = "") {
    if (this.mode !== "playing") return;
    if (success) this.checkFragment(this.fragmentBody());
    this.mode = "done";
    this.setCorruption(0);
    lightOverlay.classList.remove("is-active");
    if (success) this.flash(220, 147, 252, 160);
    // 실패는 결과창 없이 곧장 되감기므로(js/game.js) 죽었다는 사실은 여기서만 알린다.
    else { this.flash(200, 255, 92, 84); this.shake(140, 0.006); emit("archive-sfx", { name: "failure" }); }
    emit("archive-stage-end", {
      success,
      elapsed: this.elapsed,
      timePenalty: this.timePenalty,
      actions: this.actions ?? 0,
      extra,
      fragmentCollected: this.fragmentCollected,
    });
  }

  buildFragment() {
    this.fragmentTip = null;
    this.fragmentFollower = null;
    this.fragment = MEMORY_FRAGMENTS[this.stageId];
    this.fragmentCollected = false;
    this.fragmentObject = this.add.rectangle(this.fragment.x, this.fragment.y, 19, 19, 0xffd27c, 0.85)
      .setStrokeStyle(2, 0xfff0c2).setRotation(Math.PI / 4).setDepth(7);
    this.fragmentRing = this.add.circle(this.fragment.x, this.fragment.y, this.fragment.radius + 7, 0xffd27c, 0.08)
      .setStrokeStyle(1, 0xffd27c, 0.6).setDepth(6);
    this.tweens.add({ targets: this.fragmentRing, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 });
    this.sendHud();
  }

  fragmentBody() {
    const s = this.state;
    if (!s) return null;

    const body = this.stageGame?.body?.call(this) ?? s;
    return { x: body.x, y: body.y, radius: body.radius ?? 12 };
  }

  checkFragment(body, previous = body) {
    if (this.mode !== "playing" || this.pausedByMenu || this.fragmentCollected || !body) return;
    if (!touchesFragment(this.fragment, body, previous || body)) return;
    this.fragmentCollected = true;
    this.fragmentObject.setVisible(false);
    this.fragmentRing.setVisible(false);
    const glow = this.add.circle(0, 0, 13, 0xffd27c, 0.14).setStrokeStyle(2, 0xffd27c, 0.8);
    const core = this.add.rectangle(0, 0, 10, 10, 0xffe8ae, 0.95).setRotation(Math.PI / 4);
    this.fragmentFollower = this.add.container(body.x, body.y - 28, [glow, core]).setDepth(12);
    emit("archive-sfx", { name: "hit" });
    emit("archive-fragment-collected", { stageId: this.stageId });
    this.sendHud();
  }

  updateFragmentFollower() {
    if (!this.fragmentCollected || !this.fragmentFollower) return;
    let body = this.fragmentBody();
    if (!body && this.stageId === "recoil" && this.state) {
      body = { x: this.state.turretX, y: this.state.turretY, radius: 14 };
    }
    if (!body) return;
    const angle = this.time.now * 0.0032;
    this.fragmentFollower.setPosition(body.x + Math.cos(angle) * 24, body.y - 29 + Math.sin(angle) * 9);
    this.fragmentFollower.setRotation(angle * 0.35);
  }


}

window.archivePhaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: "game-container",
  backgroundColor: "#07141d",
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: ArchiveGame,
});
