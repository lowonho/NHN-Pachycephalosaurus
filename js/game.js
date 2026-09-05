/* DOM 화면과 10개 미니게임 엔진의 연결. 게임 규칙은 stages/eN_*.js에 있습니다. */
class ArchiveGameBridge {
  constructor(events, dom, soundBus) {
    this.events = events; this.ui = dom; this.soundBus = soundBus; this.stages = []; this.active = false; this.api = null;
    window.addEventListener('archive-game-ready', event => this.onReady(event.detail));
    window.addEventListener('archive-hud', event => this.onHud(event.detail));
    window.addEventListener('archive-stage-end', event => this.onStageEnd(event.detail));
    window.addEventListener('archive-play-time', event => {
      if (this.active) this.emitRunSnapshot(window.archiveRun.consume(event.detail.deltaMs));
    });
    window.addEventListener('archive-auto-pause', () => { if (this.active) this.pause(); });
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
    this.soundBus.startGameAudio(); this.ui.appShell?.removeAttribute('inert');
    this.ui.touchControls.hidden = ['e5', 'e7', 'e9'].includes(stageId);
    this.ui.stageHud.hidden = false; this.ui.stageHudTimer.hidden = false;
    this.ui.stageHudTitle.textContent = `${stage.id.toUpperCase()} · ${stage.title}`;
    /* 도감은 클리어가 아니라 "해 봤는가"로 열린다 — 시작하는 이 자리에서 남긴다.
       QA 모드의 시도는 최고 기록과 마찬가지로 남기지 않는다. */
    if (!globalThis.ARCHIVE_QA?.active) window.archivePlays?.record(stageId);
    this.emitRunSnapshot(window.archiveRun.beginAttempt(stageId));
    this.api.loadStage(stageId); this.api.start();
    this.events.emit(GAME_EVENTS.STAGE_START, { stageId, stage });
  }
  restart() { if (this.currentStage) this.start(this.currentStage.id); }
  pause() {
    if (!this.active) return;
    this.api.pause(true); this.emitRunSnapshot(window.archiveRun.setPaused(true));
    this.events.emit(GAME_EVENTS.STAGE_PAUSE, { stageId: this.currentStage?.id });
  }
  resume() {
    if (!this.active) return;
    this.api.pause(false); this.emitRunSnapshot(window.archiveRun.setPaused(false));
    this.events.emit(GAME_EVENTS.STAGE_RESUME, { stageId: this.currentStage?.id });
  }
  stop() {
    this.active = false; this.api?.stop();
    this.emitRunSnapshot(window.archiveRun?.leaveAttempt());
    this.ui.stageHud.hidden = true; this.ui.stageHudTimer.hidden = true; this.ui.touchControls.hidden = true;
    delete this.ui.appShell.dataset.act;
    delete this.ui.appShell.dataset.assist;
  }
  emitRunSnapshot(snapshot) {
    if (!snapshot) return;
    if (this.ui.stageHudAct) this.ui.stageHudAct.textContent = `ACT ${snapshot.currentAct ?? 1}/3`;
    if (this.ui.stageHudStage) this.ui.stageHudStage.textContent = `STAGE ${snapshot.currentStageInAct ?? 1}/6`;
    if (this.ui.stageHudLives) {
      const lives = snapshot.lives ?? 0;
      this.ui.stageHudLives.textContent = `LIVES ${'◆'.repeat(lives)}${'◇'.repeat(Math.max(0, 3 - lives))}`;
    }
    if (this.ui.stageHudActRecords) this.ui.stageHudActRecords.textContent = `${snapshot.actRecordCount ?? 0}/6`;
    if (this.ui.stageHudMemory) this.ui.stageHudMemory.textContent = `${snapshot.totalRecordCount ?? 0}/18`;
    this.events.emit(GAME_EVENTS.TOTAL_TIMER_TICK, snapshot);
  }
  onHud({ remaining = 20.26, actions = 0, anomaly = '', risk = 0 }) {
    /* QA 모드가 제한시간을 바꿔 두면 remaining도 그 값에서 내려온다(js/config/qa.js). */
    if (!this.currentStage) return;
    this.ui.stageHudTimer.textContent = Math.max(0, remaining).toFixed(2);
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
    const run = window.archiveRun.completeAttempt(success);
    this.emitRunSnapshot(run);
    let record = null;
    /*
     * QA 모드의 판은 남기지 않는다 — 제한시간을 늘려 둔 기록은 20.26초 기준의
     * 최고 기록·ARCHIVE 복구율과 같은 자리에 둘 수 없다(records.mjs가 20.26초를 넘는
     * 기록을 거부하기도 한다).
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
  viewportFitter.stop(); audioBus.destroy(); window.archiveAudio?.stopBgm();
  gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, {}); window.archivePhaserGame?.destroy(true);
});
