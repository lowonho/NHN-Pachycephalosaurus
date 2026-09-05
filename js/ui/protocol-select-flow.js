/* 3막 진행 화면: 막마다 10개 게임 중 6개를 순서까지 무작위로 연결한다. */
const RECOVERY_BUDGET_MS = 20260;
const RECOVERY_URGENT_MS = 5000;

class ProtocolSelectFlow {
  constructor(events, dom, soundBus, strings, cutscene) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.strings = strings;
    this.cutscene = cutscene;
    this.catalog = PROTOCOLS;
    this.stages = [];
    this.remainingMs = RECOVERY_BUDGET_MS;
    this.warnHandle = 0;

    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.render());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.render());
    this.events.on(GAME_EVENTS.TOTAL_TIMER_TICK, (snapshot = {}) => this.syncRun(snapshot));
    this.events.on(GAME_EVENTS.RUN_RESET, (snapshot = {}) => this.syncRun(snapshot));
    this.events.on(GAME_EVENTS.REQUEST_CONTINUE, () => this.continueStory());
    this.render();
  }

  open() {
    this.soundBus.resume();
    this.refreshStages();
    this.render();
    this.ui.mainMenu?.setAttribute('inert', '');
    this.ui.stageSelectScreen?.classList.remove('hidden');
    this.showScreen('select');
    const current = this.ui.stageSelectGrid?.querySelector('button:not(:disabled)');
    (current ?? this.ui.stageSelectBackButton)?.focus();
  }

  close() {
    this.showScreen('select');
    this.ui.stageSelectScreen?.classList.add('hidden');
  }

  showScreen(mode) {
    const playing = mode === 'play';
    if (this.ui.protocolScreen) this.ui.protocolScreen.dataset.mode = mode;
    if (this.ui.appShell) {
      this.ui.appShell.hidden = !playing;
      if (playing) this.ui.appShell.removeAttribute('inert');
      else this.ui.appShell.setAttribute('inert', '');
    }
    if (playing) window.archivePhaserGame?.scale?.refresh();
  }

  /* 새 게임과 QA가 호출하는 명시적 초기화. 메인 화면을 여는 것만으로는 저장을 지우지 않는다. */
  reset() {
    const snapshot = window.archiveRun?.startNew();
    this.syncRun(snapshot);
    this.events.emit(GAME_EVENTS.RUN_RESET, snapshot);
    return snapshot;
  }

  refreshStages() {
    const selected = window.archiveRun?.snapshot().selectedStageIds ?? [];
    this.stages = selected.map((id) => this.catalog.find((stage) => stage.id === id)).filter(Boolean);
  }

  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    this.refreshStages();
    this.render();
  }

  startStage(stageId) {
    const run = window.archiveRun?.snapshot();
    if (!run?.qaMode && stageId !== run?.expectedStageId) return;
    if (!window.archiveGame) {
      this.warnEngineMissing();
      return;
    }
    const stage = this.stages.find((item) => item.id === stageId);
    if (!stage) return;
    this.soundBus.resume();
    const act = SCENARIO_DATA.acts[run.currentAct - 1];
    this.cutscene.play({
      chapter: `ACT ${run.currentAct} // STAGE ${run.currentStageInAct}/6`,
      script: [{
        speaker: `${stage.id.toUpperCase()} // ${stage.title}`,
        text: `${stage.objective}\n\n${stage.controls}\n${act?.objective ?? ''}`,
        phase: 'stage-brief',
        durationMs: 2000,
      }],
      auto: true,
      onDone: () => this.launchStage(stageId),
    });
  }

  launchStage(stageId) {
    this.showScreen('play');
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }

  continueStory() {
    if (globalThis.ARCHIVE_QA?.active) return;
    const before = window.archiveRun?.snapshot();
    const advanced = window.archiveRun?.advance();
    if (!before || !advanced) return;
    this.syncRun(advanced.snapshot);
    const open = () => this.open();
    const play = (name, done = open) => this.playStoryCutscene(name, done);

    if (advanced.transition === 'next-stage') {
      if (before.currentAct === 3 && before.currentStageInAct === 2) play('successTest');
      else if (before.currentAct === 3 && before.currentStageInAct === 5) play('blockade');
      else open();
      return;
    }
    if (advanced.transition === 'next-act') {
      if (before.currentAct === 1) play('betrayal');
      else play('source', () => play('experiment'));
      return;
    }
    if (advanced.transition === 'act-restarted') {
      if (advanced.snapshot.currentAct === 1 && advanced.snapshot.assistProtocolAct1) play('assist');
      else open();
      return;
    }
    if (advanced.transition === 'ending') {
      play('ending', () => this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
      return;
    }
    open();
  }

  playStoryCutscene(name, onDone) {
    const data = SCENARIO_DATA.cutscenes[name];
    if (!data || window.archiveRun?.hasSeenCutscene(data.id)) {
      onDone?.();
      return;
    }
    this.close();
    this.cutscene.play({
      chapter: data.chapter,
      script: data.script,
      auto: data.auto,
      onDone: () => {
        window.archiveRun?.markCutsceneSeen(data.id);
        onDone?.();
      },
    });
  }

  warnEngineMissing() {
    const label = this.ui.protocolProgress;
    if (!label) return;
    label.dataset.state = 'warn';
    label.textContent = this.strings.protocol.engineMissing;
    window.clearTimeout(this.warnHandle);
    this.warnHandle = window.setTimeout(() => this.renderProgress(), 2800);
  }

  syncRun(snapshot = {}) {
    if (Number.isFinite(snapshot.stageRemainingMs)) this.remainingMs = snapshot.stageRemainingMs;
    else if (Number.isFinite(snapshot.totalRemainingMs)) this.remainingMs = snapshot.totalRemainingMs;
    this.refreshStages();
    this.render();
  }

  render() {
    this.renderTiles();
    this.renderTimer();
    this.renderProgress();
    this.renderArchive();
  }

  renderTimer() {
    if (!this.ui.deskClock) return;
    const parts = ProtocolSelectFlow.clockParts(this.remainingMs);
    this.ui.deskClock.dataset.state = this.remainingMs <= RECOVERY_URGENT_MS ? 'urgent' : 'idle';
    if (this.ui.deskClockMinutes) this.ui.deskClockMinutes.textContent = parts.minutes;
    if (this.ui.deskClockSeconds) this.ui.deskClockSeconds.textContent = parts.seconds;
    if (this.ui.deskClockCentis) this.ui.deskClockCentis.textContent = parts.centis;
  }

  renderProgress() {
    const label = this.ui.protocolProgress;
    const run = window.archiveRun?.snapshot();
    if (!label || !run) return;
    window.clearTimeout(this.warnHandle);
    delete label.dataset.state;
    const lives = `${'◆'.repeat(run.lives)}${'◇'.repeat(Math.max(0, 3 - run.lives))}`;
    label.textContent = `ACT ${run.currentAct}/3 · STAGE ${run.currentStageInAct}/6 · LIVES ${lives} · RECORDS ${run.totalRecordCount}/18`;
    if (this.ui.stageSelectTitle) {
      const act = SCENARIO_DATA.acts[run.currentAct - 1];
      this.ui.stageSelectTitle.textContent = `ACT ${run.currentAct} ${act?.code ?? ''} · 6 OF 10 RECORDS CONNECTED`;
    }
  }

  renderArchive() {
    const run = window.archiveRun?.snapshot();
    if (!run) return;
    this.ui.archiveRecoveryRates?.forEach((element) => {
      element.textContent = `TOTAL RECORDS ${run.totalRecordCount}/18`;
    });
    if (this.ui.archiveRecoveryDetail) {
      this.ui.archiveRecoveryDetail.textContent = `ACT ${run.currentAct} RECORDS ${run.actRecordCount}/6 · ATTEMPT ${run.actAttemptCount[run.currentAct - 1]}`;
    }
    if (this.ui.archiveEndingStatus) {
      this.ui.archiveEndingStatus.hidden = !run.assistProtocolAct1;
      this.ui.archiveEndingStatus.textContent = run.assistProtocolAct1 ? 'ASSIST PROTOCOL ENABLED' : '';
    }
  }

  renderTiles() {
    const grid = this.ui.stageSelectGrid;
    if (!grid) return;
    grid.replaceChildren();
    const run = window.archiveRun?.snapshot();
    if (!run?.active && !run?.qaMode) {
      const loading = document.createElement('div');
      loading.className = 'stage-select-card stage-select-card--soon';
      loading.textContent = '기록 접속을 시작해 주세요.';
      grid.append(loading);
      return;
    }
    this.stages.forEach((stage, index) => grid.append(this.buildTile(stage, index, run)));
  }

  buildTile(stage, index, run) {
    const tile = document.createElement('button');
    const slot = index + 1;
    const restored = Boolean(run.stageRecords?.[run.currentAct - 1]?.[index]);
    const current = slot === run.currentStageInAct;
    tile.type = 'button';
    tile.className = 'stage-select-card protocol-app';
    tile.dataset.stageId = stage.id;
    tile.dataset.slot = String(slot);
    tile.dataset.restored = String(restored);
    tile.dataset.current = String(current);
    tile.disabled = !run.qaMode && (!current || restored);

    const icon = document.createElement('span');
    icon.className = 'protocol-app-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = stage.recordSymbol;
    const code = document.createElement('span');
    code.className = 'protocol-app-code';
    code.textContent = `A${run.currentAct}-${String(slot).padStart(2, '0')} · ${restored ? '◆' : current ? '▶' : '◇'}`;
    const title = document.createElement('strong');
    title.className = 'protocol-app-title';
    title.textContent = stage.title;
    const mark = document.createElement('span');
    mark.className = 'protocol-app-mark';
    mark.textContent = restored ? 'REGISTERED' : current ? 'CONNECT' : 'LOCKED';
    tile.append(icon, code, title, mark);
    const best = window.archiveRecords?.best(stage.id);
    if (best) {
      const record = document.createElement('small');
      record.className = 'protocol-best';
      record.textContent = `BEST ${best.elapsed.toFixed(2)}s · ${best.actions}회`;
      tile.append(record);
    }
    tile.title = `${stage.controls}\n${stage.objective}\n${stage.anomaly}`;
    tile.addEventListener('click', () => this.startStage(stage.id));
    return tile;
  }

  static formatClock(milliseconds) {
    const parts = ProtocolSelectFlow.clockParts(milliseconds);
    return `${parts.minutes.padStart(2, '0')}:${parts.seconds}.${parts.centis}`;
  }

  static clockParts(milliseconds) {
    const total = Math.max(0, milliseconds);
    return {
      minutes: String(Math.floor(total / 60000)),
      seconds: String(Math.floor(total / 1000) % 60).padStart(2, '0'),
      centis: String(Math.floor(total / 10) % 100).padStart(2, '0'),
    };
  }
}

const protocolSelectFlow = new ProtocolSelectFlow(gameEvents, UI, audioBus, STRINGS, cutsceneFlow);
