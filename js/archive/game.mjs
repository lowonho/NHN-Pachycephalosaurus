import { STAGES } from './data.mjs';
import { createProgressStore } from './progress.mjs';
import { createArchiveRunState } from './run-state.mjs';
import { createMinigameRecords } from './records.mjs';
import { createMinigamePlayLog } from './plays.mjs';
import { audio } from './audio.mjs';
import { STAGE_GAMES } from './stages/index.mjs';

window.archiveAudio = audio;
let progressStorage = null;
try { progressStorage = window.localStorage; } catch { /* 세션 저장만 사용 */ }
window.archiveProgress = createProgressStore(STAGES.map(stage => stage.id), progressStorage);
window.archiveRun = createArchiveRunState(STAGES.map(stage => stage.id));
window.archiveRecords = createMinigameRecords(STAGES.map(stage => stage.id), progressStorage);
/* 미니게임 도감(js/ui/codex-flow.js)이 읽는 "해 본 게임" 기록. */
window.archivePlays = createMinigamePlayLog(STAGES.map(stage => stage.id), progressStorage);
window.addEventListener('archive-sfx', event => audio.play(event.detail?.name));

class ArchiveGame extends Phaser.Scene {
  constructor() {
    super('archive-game'); this.mode = 'idle'; this.pausedByMenu = false;
    this.settings = { shake: true, effects: true }; this.touch = new Set(); this.pointerId = null;
  }
  preload() {
    // index.html을 직접 열었을 때도 로컬 PNG/WebP/SVG 에셋을 읽을 수 있게 합니다.
    if (window.location.protocol === 'file:') this.load.imageLoadType = 'HTMLImageElement';
    for (const [id, roles] of Object.entries(globalThis.MINIGAME_ASSETS ?? {})) {
      for (const [role, path] of Object.entries(roles)) if (path) this.load.image(`${id}:${role}`, path);
    }
  }
  create() {
    this.keys = this.input.keyboard.addKeys({ left: 'A', right: 'D', up: 'W', down: 'S', action: 'SPACE', arrowLeft: 'LEFT', arrowRight: 'RIGHT', arrowUp: 'UP', arrowDown: 'DOWN' });
    const directions = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down' };
    this.input.keyboard.on('keydown', event => {
      if (event.repeat || !this.playable()) return;
      if (event.code === 'Space') this.primaryAction();
      else if (directions[event.code]) this.stageGame.press?.call(this, directions[event.code]);
    });
    this.input.on('pointerdown', p => {
      if (!this.playable() || this.pointerId !== null || p.button > 0) return;
      this.pointerId = p.id; this.pointerAction(p.x, p.y);
    });
    this.input.on('pointermove', p => { if (this.playable() && this.pointerId === p.id) this.stageGame.pointerMove?.call(this, p.x, p.y); });
    const up = p => {
      if (this.pointerId !== p.id) return;
      if (this.playable()) this.stageGame.pointerUp?.call(this, p.x, p.y);
      this.pointerId = null;
    };
    this.input.on('pointerup', up); this.input.on('pointerupoutside', up);
    this.game.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.clearInput();
      if (this.playable()) window.dispatchEvent(new CustomEvent('archive-auto-pause'));
    });
    this.game.canvas.addEventListener('pointercancel', () => this.clearInput());
    window.archiveGame = {
      loadStage: id => this.loadStage(id), start: () => this.startStage(), stop: () => this.stopGame(),
      press: direction => this.directionPress(direction), release: direction => this.directionRelease(direction),
      action: () => { if (!this.touch.has('action')) { this.touch.add('action'); this.primaryAction(); } },
      pause: value => { this.pausedByMenu = Boolean(value); this.clearInput(); },
      applySettings: value => { this.settings = value; },
    };
    window.dispatchEvent(new CustomEvent('archive-game-ready', { detail: { scene: this, stages: STAGES } }));
  }
  playable() { return this.mode === 'playing' && !this.pausedByMenu; }
  held(name) {
    const alias = { left: 'arrowLeft', right: 'arrowRight', up: 'arrowUp', down: 'arrowDown' };
    return this.touch.has(name) || Boolean(this.keys[name]?.isDown || this.keys[alias[name]]?.isDown);
  }
  axis(negative, positive) { return Number(this.held(positive)) - Number(this.held(negative)); }
  clearInput() {
    this.touch.clear(); this.pointerId = null;
    if (this.state) this.stageGame?.cancelInput?.call(this);
    this.input.keyboard?.resetKeys();
  }
  loadStage(id) {
    if (!STAGE_GAMES[id]) throw new Error(`Unknown stage: ${id}`);
    this.clearInput(); this.stageGame?.dispose?.call(this);
    this.ink?.clearMask(true); this.fieldMask?.destroy();
    this.children.removeAll(true); this.tweens.killAll(); this.time.removeAllEvents(); this.cameras.main.resetFX();
    this.stageGame = STAGE_GAMES[id]; this.stageId = id; this.stage = STAGES.find(stage => stage.id === id);
    // 제한시간은 판마다 다시 묻는다 — QA 모드가 20.26초를 바꿔 둘 수 있다(js/config/qa.js).
    this.timeLimit = globalThis.archiveStageTimeLimit?.() ?? 20.26;
    this.mode = 'ready'; this.pausedByMenu = false; this.elapsed = 0; this.remaining = this.timeLimit; this.accumulator = 0;
    this.state = null; this.anomaly = this.stage.anomaly; this.cameras.main.setBackgroundColor('#07141d');
    this.stageGame.build.call(this); this.stageGame.render.call(this); this.sendHud();
  }
  startStage() {
    if (!this.stageId) return;
    if (this.mode !== 'ready') this.loadStage(this.stageId);
    this.mode = 'playing'; this.sfx('click');
  }
  stopGame() {
    this.clearInput(); this.mode = 'idle'; this.pausedByMenu = false; this.stageGame?.dispose?.call(this);
    this.tweens.killAll(); this.time.removeAllEvents(); this.cameras.main.resetFX();
  }
  directionPress(direction) {
    if (!this.playable()) return;
    if (!this.touch.has(direction)) this.stageGame.press?.call(this, direction);
    this.touch.add(direction);
  }
  directionRelease(direction) { this.touch.delete(direction); }
  primaryAction() { if (this.playable()) this.stageGame.action?.call(this); }
  pointerAction(x, y) { if (this.playable()) this.stageGame.pointerDown?.call(this, x, y); }
  sfx(name) { audio.play(name === 'jump' ? 'action' : name); }
  bump() { this.sfx('hit'); if (this.settings.shake) this.cameras.main.shake(100, .004); }
  sendHud() {
    window.dispatchEvent(new CustomEvent('archive-hud', { detail: { remaining: this.remaining, timeLimit: this.timeLimit, actions: this.actions, anomaly: this.anomaly, risk: this.risk } }));
  }
  update(_time, deltaMs) {
    if (!this.playable()) return;
    // 120Hz 공통 물리 스텝. 타이머와 물리가 같은 시간을 소비하도록 프레임을 분할합니다.
    this.accumulator += Math.max(0, deltaMs) / 1000;
    const step = 1 / 120;
    while (this.accumulator >= step && this.playable()) {
      this.accumulator -= step;
      const dt = Math.min(step, this.remaining);
      this.elapsed += dt; this.remaining = Math.max(0, this.timeLimit - this.elapsed);
      window.dispatchEvent(new CustomEvent('archive-play-time', { detail: { deltaMs: dt * 1000 } }));
      this.stageGame.update.call(this, dt);
      if (this.playable() && this.remaining <= .000001) this.finish(Boolean(this.stageGame.timeout?.call(this)), `${this.timeLimit.toFixed(2)}초 종료`);
    }
    this.stageGame.render.call(this); this.sendHud();
  }
  finish(success, extra = '') {
    if (!this.playable()) return;
    this.mode = 'done'; this.clearInput(); this.sfx(success ? 'success' : 'failure');
    if (this.settings.effects) this.cameras.main.flash(150, success ? 130 : 255, success ? 255 : 95, success ? 170 : 110);
    window.dispatchEvent(new CustomEvent('archive-stage-end', { detail: { success, elapsed: this.elapsed, timeLimit: this.timeLimit, actions: this.actions, extra } }));
  }
}

window.archivePhaserGame = new Phaser.Game({
  // file:// 이미지는 WebGL 텍스처 업로드가 차단됩니다. 로컬 실행은 Canvas로 표시합니다.
  type: window.location.protocol === 'file:' ? Phaser.CANVAS : Phaser.AUTO,
  width: 960, height: 540, parent: 'game-container', backgroundColor: '#07141d',
  render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: ArchiveGame,
});
