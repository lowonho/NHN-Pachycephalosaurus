/* DOM 화면과 10개 미니게임 엔진의 연결. 게임 규칙은 stages/eN_*.js에 있습니다. */

/*
 * 시작 카운트다운 — 판을 다 그려 놓고 3 · 2 · 1 · 시작! 을 센 뒤에야 20.26초가 흐른다.
 * 세는 동안 엔진은 'ready'라(js/archive/game.mjs) 시간도 입력도 멈춰 있으므로,
 * 첫 초를 허둥대지 않고 화면을 읽고 손을 얹을 틈이 생긴다.
 * 마지막 "시작!"만 짧게 스쳐 지나가 곧바로 손이 움직이게 한다.
 */
const COUNTDOWN_STEPS = Object.freeze([
  { text: '3', step: '3', ms: 620, sfx: 'click' },
  { text: '2', step: '2', ms: 620, sfx: 'click' },
  { text: '1', step: '1', ms: 620, sfx: 'click' },
  { text: '시작!', step: 'go', ms: 420, sfx: 'hit' },
]);

class ArchiveGameBridge {
  constructor(events, dom, soundBus) {
    this.events = events; this.ui = dom; this.soundBus = soundBus; this.stages = []; this.api = null;
    this.active = false; this.countdown = null;
    window.addEventListener('archive-game-ready', event => this.onReady(event.detail));
    window.addEventListener('archive-hud', event => this.onHud(event.detail));
    window.addEventListener('archive-stage-end', event => this.onStageEnd(event.detail));
    window.addEventListener('archive-play-time', event => {
      if (this.active) this.emitRunSnapshot(window.archiveRun.consume(event.detail.deltaMs));
    });
    window.addEventListener('archive-auto-pause', () => { if (this.active) this.pause(); });
    /* 제한시간 안에서 죽고 다시 소환될 때(MINI.summon). 스테이지는 끝나지 않는다. */
    window.addEventListener('archive-respawn', () => {
      if (this.active) this.events.emit(GAME_EVENTS.STAGE_RESPAWN, { stageId: this.currentStage?.id });
    });
    events.on(GAME_EVENTS.REQUEST_START, ({ stageId } = {}) => this.start(stageId));
    events.on(GAME_EVENTS.REQUEST_RESTART, () => this.restart());
    events.on(GAME_EVENTS.REQUEST_CONTINUE, () => this.stop());
    events.on(GAME_EVENTS.REQUEST_PAUSE, () => this.pause());
    events.on(GAME_EVENTS.REQUEST_RESUME, () => this.resume());
    events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.stop());
    events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.stop());
    events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncAudio());
    dom.touchButtons?.forEach(button => {
      const release = () => this.api?.release(button.dataset.direction || 'action');
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        try { button.setPointerCapture(event.pointerId); } catch { /* 취소된 터치 */ }
        if (button.dataset.action) this.api?.action(); else this.api?.press(button.dataset.direction);
      });
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    });
  }
  onReady({ scene, stages }) {
    this.api = window.archiveGame; this.stages = stages;
    this.events.emit(GAME_EVENTS.SCENE_CREATE, { scene });
    mainMenuFlow.setStages(stages); qaModeFlow.setStages(stages); this.syncAudio(); window.archiveAudio?.startBgm();
    this.emitRunSnapshot(window.archiveRun.snapshot());
  }
  start(stageId) {
    const stage = this.stages.find(stage => stage.id === stageId);
    if (!stage || !this.api || !window.archiveRun.snapshot().selectedStageIds.includes(stageId)) return;
    this.currentStage = stage; this.active = true; this.warningSent = false;
    const run = window.archiveRun.snapshot();
    this.ui.appShell.dataset.act = String(run.currentAct);
    this.ui.appShell.dataset.assist = String(Boolean(run.assistProtocolAct1));
    this.soundBus.startGameAudio();
    /* 카운트다운 동안 크로스페이드가 끝나 조작 시작에는 해당 게임 음악만 또렷하게 남는다. */
    window.archiveAudio?.selectBgm(stageId, { restart: true });
    this.ui.appShell?.removeAttribute('inert');
    this.ui.touchControls.hidden = ['e5', 'e7', 'e9'].includes(stageId);
    this.ui.stageHud.hidden = false; this.ui.stageHudTimer.hidden = false;
    // 남은 목숨은 우상단(일시정지 옆)에 있어 좌상단 패널과 따로 여닫는다.
    if (this.ui.stageHudLives) this.ui.stageHudLives.hidden = false;
    this.ui.stageHud.dataset.stage = stageId;
    /* 스테이지 코드(e9 …)는 개발용 식별자다. 플레이 화면에는 게임 이름만 보인다. */
    this.ui.stageHudTitle.textContent = stage.title;
    /* 도감은 클리어가 아니라 "해 봤는가"로 열린다 — 시작하는 이 자리에서 남긴다.
       QA 모드의 시도는 최고 기록과 마찬가지로 남기지 않는다. */
    if (!globalThis.ARCHIVE_QA?.active) window.archivePlays?.record(stageId);
    window.archiveRun.setAttemptTime((globalThis.archiveStageTimeLimit?.(stage.timeLimit) ?? stage.timeLimit ?? 20.26) * 1000);
    this.emitRunSnapshot(window.archiveRun.beginAttempt(stageId));
    /* 판을 먼저 세운다 — 카운트다운은 이미 그려진 화면 위에서 센다. */
    this.api.loadStage(stageId);
    /* 카운트다운 중에도 멈출 수 있어야 하므로 일시정지 UI부터 붙인다(js/ui/pause-flow.js). */
    this.events.emit(GAME_EVENTS.STAGE_START, { stageId, stage });
    this.beginCountdown();
  }
  /*
   * 3 · 2 · 1 · 시작! — 각 칸은 자기 시간만큼 서 있고, 마지막 칸이 끝나면 엔진이 돈다.
   * 일시정지 중에는 시간을 먹지 않는다(pause에서 멈추고 resume에서 다시 흐른다).
   */
  beginCountdown() {
    this.cancelCountdown();
    const board = this.ui.stageCountdown, value = this.ui.stageCountdownValue;
    if (!board || !value || globalThis.ARCHIVE_STORY_SETTINGS?.skipCountdown) { this.api.start(); return; }
    this.countdown = { index: -1, remaining: 0, last: 0, frame: 0, paused: false };
    board.hidden = false;
    this.showCountdownAnomaly();
    const tick = now => {
      const state = this.countdown;
      if (!state) return;
      const delta = state.last ? Math.max(0, now - state.last) : 0;
      state.last = now;
      if (!state.paused) state.remaining -= delta;
      if (state.remaining <= 0 && !this.nextCountdownStep()) return;
      state.frame = requestAnimationFrame(tick);
    };
    if (this.nextCountdownStep()) this.countdown.frame = requestAnimationFrame(tick);
  }
  /*
   * 숫자 아래 붉은 줄 — 이번 판에서 조심할 것 하나(브리핑의 ANOMALY 칸과 같은 문장).
   * 숫자는 칸마다 새로 튀지만 이 줄은 세는 내내 그대로 서 있어야 읽힌다.
   */
  showCountdownAnomaly() {
    const line = this.ui.stageCountdownAnomaly, text = this.ui.stageCountdownAnomalyText;
    if (!line || !text) return;
    const anomaly = this.currentStage?.anomaly ?? '';
    text.textContent = anomaly;
    line.hidden = !anomaly;
    /* 판을 이어서 다시 시작할 때도 한 번 떠오르는 연출을 처음부터 다시 재생시킨다. */
    line.style.animation = 'none'; void line.offsetWidth; line.style.animation = '';
  }
  /* 다음 칸을 세운다. 마지막 칸까지 끝났으면 판을 시작하고 false를 돌려준다. */
  nextCountdownStep() {
    const state = this.countdown, value = this.ui.stageCountdownValue;
    const next = COUNTDOWN_STEPS[state.index + 1];
    if (!next) { this.finishCountdown(); return false; }
    state.index += 1; state.remaining = next.ms;
    value.textContent = next.text; value.dataset.step = next.step;
    /* 같은 애니메이션을 처음부터 다시 재생시킨다 — 되감으려면 한 번 떼었다 붙여야 한다. */
    value.style.animation = 'none'; void value.offsetWidth; value.style.animation = '';
    window.dispatchEvent(new CustomEvent('archive-sfx', { detail: { name: next.sfx } }));
    return true;
  }
  /* 세는 것을 끝내고 판을 시작한다. 카운트다운이 없었으면 아무 일도 하지 않는다. */
  finishCountdown() {
    if (!this.countdown) return;
    this.cancelCountdown();
    this.api.start();
  }
  cancelCountdown() {
    if (this.countdown) cancelAnimationFrame(this.countdown.frame);
    this.countdown = null;
    if (this.ui.stageCountdown) this.ui.stageCountdown.hidden = true;
  }
  restart() { if (this.currentStage) this.start(this.currentStage.id); }
  pause() {
    if (!this.active) return;
    if (this.countdown) this.countdown.paused = true;
    this.api.pause(true); this.emitRunSnapshot(window.archiveRun.setPaused(true));
    this.events.emit(GAME_EVENTS.STAGE_PAUSE, { stageId: this.currentStage?.id });
  }
  resume() {
    if (!this.active) return;
    if (this.countdown) this.countdown.paused = false;
    this.api.pause(false); this.emitRunSnapshot(window.archiveRun.setPaused(false));
    this.events.emit(GAME_EVENTS.STAGE_RESUME, { stageId: this.currentStage?.id });
  }
  stop() {
    this.active = false; this.cancelCountdown(); this.api?.stop();
    const archiveAudio = window.archiveAudio;
    archiveAudio?.selectBgm('main');
    if (archiveAudio && (archiveAudio.bgmPaused || !archiveAudio.bgmStarted)) archiveAudio.startBgm();
    this.emitRunSnapshot(window.archiveRun?.leaveAttempt());
    this.ui.stageHud.hidden = true; this.ui.stageHudTimer.hidden = true; this.ui.touchControls.hidden = true;
    if (this.ui.stageHudLives) this.ui.stageHudLives.hidden = true;
    delete this.ui.appShell.dataset.act;
    delete this.ui.appShell.dataset.assist;
  }
  emitRunSnapshot(snapshot) {
    if (!snapshot) return;
    if (this.ui.stageHudAct) this.ui.stageHudAct.textContent = `ACT ${snapshot.currentAct ?? 1}/3`;
    if (this.ui.stageHudStage) this.ui.stageHudStage.textContent = `STAGE ${snapshot.currentStageInAct ?? 1}/6`;
    if (this.ui.stageHudLives) {
      const lives = snapshot.lives ?? 0;
      this.ui.stageHudLives.textContent = `MEMORY ${'◆'.repeat(lives)}${'◇'.repeat(Math.max(0, 3 - lives))}`;
    }
    if (this.ui.stageHudActRecords) this.ui.stageHudActRecords.textContent = `${snapshot.actRecordCount ?? 0}/6`;
    if (this.ui.stageHudMemory) this.ui.stageHudMemory.textContent = `${snapshot.totalRecordCount ?? 0}/18`;
    this.events.emit(GAME_EVENTS.TOTAL_TIMER_TICK, snapshot);
  }
  onHud({ remaining = 20.26, actions = 0, anomaly = '', risk = 0 }) {
    /* QA 모드가 제한시간을 바꿔 두면 remaining도 그 값에서 내려온다(js/config/qa.js). */
    if (!this.currentStage) return;
    this.ui.stageHudTimer.textContent = Math.max(0, remaining).toFixed(2);
    if (this.active) this.emitRunSnapshot(window.archiveRun.syncRemaining(remaining * 1000));
    this.ui.stageHudAction.textContent = `${this.currentStage.actionLabel} ${actions}`;
    this.ui.stageHudAnomaly.textContent = anomaly;
    this.ui.stageHudRisk.style.width = `${Math.max(0, Math.min(100, risk))}%`;
    this.ui.stageHudRisk.dataset.level = risk >= 75 ? 'danger' : risk >= 45 ? 'warn' : 'safe';
    this.events.emit(GAME_EVENTS.TIMER_TICK, { remainingMs: Math.round(remaining * 1000) });
    if (!this.warningSent && remaining <= 5 && remaining > 0) { this.warningSent = true; this.events.emit(GAME_EVENTS.TIMER_WARNING, {}); }
  }
  onStageEnd({ success, elapsed, actions, extra = '' }) {
    if (!this.active || !this.currentStage) return;
    this.active = false; this.ui.touchControls.hidden = true;
    /* 결과 징글과 판정음이 음악에 묻히지 않도록 결과창이 뜨는 순간만 낮춘다. */
    this.soundBus.duck(success ? 0.58 : 0.46, success ? 900 : 1150);
    const run = window.archiveRun.completeAttempt(success);
    this.emitRunSnapshot(run);
    let record = null;
    /*
     * QA 모드의 판은 남기지 않는다. 기록은 각 스테이지의 기본 제한시간을
     * 기준으로 검증한다(20.26초).
     */
    if (success && !globalThis.ARCHIVE_QA?.active) {
      window.archiveProgress.record(this.currentStage.id, true, true);
      record = window.archiveRecords.record(this.currentStage.id, elapsed, actions);
    }
    mainMenuFlow.renderStages();
    this.events.emit(success ? GAME_EVENTS.STAGE_CLEAR : GAME_EVENTS.STAGE_FAIL, {
      stageId: this.currentStage.id, stage: this.currentStage, elapsed, actions, extra, run, record,
    });
  }
  syncAudio() {
    window.archiveAudio?.setVolume(this.soundBus.channelVolume('sfx'));
    window.archiveAudio?.setBgmVolume(this.soundBus.channelVolume('bgm'));
  }
}
const archiveGameBridge = new ArchiveGameBridge(gameEvents, UI, audioBus);
viewportFitter.start();
window.addEventListener('beforeunload', () => {
  viewportFitter.stop(); audioBus.destroy(); window.archiveAudio?.destroy();
  gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, {}); window.archivePhaserGame?.destroy(true);
});
