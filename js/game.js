/*
 * Downloads/2026-ARCHIVE-GitHub의 7개 스테이지 엔진과 기존 DOM UI를 잇는 어댑터.
 * 게임 규칙은 js/archive/game.mjs가 담당하고, 이 파일은 화면 전환·일시정지·결과만 연결한다.
 */

class ArchiveGameBridge {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.api = null;
    this.currentStage = null;
    this.stages = [];
    this.active = false;
    this.warningSent = false;
    this.pendingStageId = null;
    this.fragmentTipTimer = 0;

    window.addEventListener("archive-game-ready", (event) => this.onReady(event.detail));
    window.addEventListener("archive-hud", (event) => this.onHud(event.detail));
    window.addEventListener("archive-stage-end", (event) => this.onStageEnd(event.detail));
    window.addEventListener("archive-play-time", (event) => this.onPlayTime(event.detail));
    window.addEventListener("archive-fragment-collected", () => this.onFragmentCollected());
    window.addEventListener("archive-wall-hit", () => {
      this.ui.stageHudTimer?.animate([
        { color: "#ff947d", transform: "scale(1.15)" },
        { color: "#ffe04b", transform: "scale(1)" },
      ], { duration: 450 });
    });

    this.events.on(GAME_EVENTS.REQUEST_START, ({ stageId } = {}) => this.start(stageId));
    this.events.on(GAME_EVENTS.REQUEST_RESTART, () => this.restart());
    this.events.on(GAME_EVENTS.REQUEST_PAUSE, () => this.pause());
    this.events.on(GAME_EVENTS.REQUEST_RESUME, () => this.resume());
    // 프로토콜 선택으로 돌아갈 때도 스테이지는 똑같이 내린다(판 예산만 그대로 이어진다).
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.stop());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.stop());
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncAudio());

    this.ui.touchButtons?.forEach((button) => {
      const release = (event) => {
        const direction = button.dataset.direction;
        if (direction) this.api?.release(direction);
        try {
          if (event.pointerId !== undefined && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
        } catch { /* Pointer capture can already be gone after an interrupted touch. */ }
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        try { button.setPointerCapture?.(event.pointerId); } catch { /* Synthetic/ended pointer fallback. */ }
        if (button.dataset.action) this.api?.action();
        else if (button.dataset.direction) this.api?.press(button.dataset.direction);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  }

  onReady({ scene, stages } = {}) {
    this.api = window.archiveGame;
    this.stages = Array.isArray(stages) ? stages : [];
    this.events.emit(GAME_EVENTS.SCENE_CREATE, { scene });
    mainMenuFlow.setStages(this.stages);
    this.syncAudio();

    window.archiveAudio?.startBgm();
    this.emitRunSnapshot(window.archiveRun?.snapshot());

    if (this.pendingStageId) {
      const stageId = this.pendingStageId;
      this.pendingStageId = null;
      this.start(stageId);
    }
  }

  start(stageId) {
    if (!stageId) return;
    this.soundBus.startGameAudio();
    if (!this.api) {
      this.pendingStageId = stageId;
      return;
    }

    const stage = this.stages.find((item) => item.id === stageId);
    if (!stage) {
      console.error(`[archive] 알 수 없는 스테이지: ${stageId}`);
      return;
    }

    this.currentStage = stage;
    this.active = true;
    this.warningSent = false;
    this.ui.appShell?.removeAttribute("inert");
    this.ui.touchControls?.removeAttribute("hidden");
    this.updateStageHud(stage);
    this.emitRunSnapshot(window.archiveRun?.beginAttempt(stage.id));
    this.api.loadStage(stage.id);
    this.api.start();
    this.events.emit(GAME_EVENTS.STAGE_START, { stageId: stage.id, stage });
  }

  restart() {
    if (this.currentStage) this.start(this.currentStage.id);
  }

  pause() {
    if (!this.active || !this.api) return;
    this.api.pause(true);
    this.emitRunSnapshot(window.archiveRun?.setPaused(true));
    this.events.emit(GAME_EVENTS.STAGE_PAUSE, { stageId: this.currentStage?.id });
  }

  resume() {
    if (!this.active || !this.api) return;
    this.api.pause(false);
    this.emitRunSnapshot(window.archiveRun?.setPaused(false));
    this.events.emit(GAME_EVENTS.STAGE_RESUME, { stageId: this.currentStage?.id });
  }

  stop() {
    this.active = false;
    this.warningSent = false;
    this.pendingStageId = null;
    this.api?.stop();
    this.emitRunSnapshot(window.archiveRun?.leaveAttempt());
    this.ui.stageHud?.setAttribute("hidden", "");
    this.ui.touchControls?.setAttribute("hidden", "");
  }

  onPlayTime({ deltaMs = 0 } = {}) {
    if (!this.active) return;
    const snapshot = window.archiveRun?.consume(deltaMs);
    this.emitRunSnapshot(snapshot);
    if (snapshot?.ending !== "failure") return;
    this.active = false;
    this.api?.stop();
    this.ui.stageHud?.setAttribute("hidden", "");
    this.ui.touchControls?.setAttribute("hidden", "");
    this.events.emit(GAME_EVENTS.RUN_END, { ending: "failure", snapshot });
  }

  onFragmentCollected() {
    this.emitRunSnapshot(window.archiveRun?.markAttemptFragment());
    const tip = this.ui.fragmentDiscoveryTip;
    if (!tip) return;
    let alreadySeen = false;
    try { alreadySeen = window.localStorage.getItem("archive-2026-fragment-tip-seen") === "1"; } catch { /* Session fallback. */ }
    if (alreadySeen) return;
    tip.textContent = SCENARIO_DATA.system.firstFragment;
    tip.hidden = false;
    try { window.localStorage.setItem("archive-2026-fragment-tip-seen", "1"); } catch { /* Session fallback. */ }
    window.clearTimeout(this.fragmentTipTimer);
    this.fragmentTipTimer = window.setTimeout(() => { tip.hidden = true; }, 4200);
  }

  emitRunSnapshot(snapshot) {
    if (!snapshot) return;
    if (this.ui.stageHudTotal) this.ui.stageHudTotal.textContent = ProtocolSelectFlow.formatClock(snapshot.totalRemainingMs);
    if (this.ui.stageHudMemory) this.ui.stageHudMemory.textContent = `${snapshot.memoryCount}/${snapshot.totalStages}`;
    this.events.emit(GAME_EVENTS.TOTAL_TIMER_TICK, snapshot);
  }

  onHud({ remaining = 20.26, actions = 0, anomaly = "대기", risk = 0, fragmentCollected = false, fragmentHint = "", wallHits = null, timePenalty = 0 } = {}) {
    if (!this.currentStage) return;
    const safeRemaining = Math.max(0, Number(remaining) || 0);
    const safeRisk = Math.max(0, Math.min(100, Number(risk) || 0));
    if (this.ui.stageHudPenalty) {
      this.ui.stageHudPenalty.hidden = wallHits === null;
      this.ui.stageHudPenalty.textContent = `벽 충돌 ${wallHits ?? 0}회 · 시간 차감 −${timePenalty.toFixed(2)}초`;
    }
    const fragmentHud = document.querySelector("#stage-hud-fragment");
    if (fragmentHud) {
      fragmentHud.textContent = fragmentCollected ? "◆ MEMORY 1/1 · 목표 달성 시 저장" : `◇ MEMORY 0/1${fragmentHint ? ` · ${fragmentHint}` : ""}`;
      fragmentHud.dataset.collected = String(fragmentCollected);
    }

    if (this.ui.stageHudTimer) this.ui.stageHudTimer.textContent = safeRemaining.toFixed(2);
    if (this.ui.stageHudAction) this.ui.stageHudAction.textContent = `${this.currentStage.actionLabel} ${String(actions).padStart(2, "0")}`;
    if (this.ui.stageHudAnomaly) this.ui.stageHudAnomaly.textContent = anomaly;
    if (this.ui.stageHudRisk) {
      this.ui.stageHudRisk.style.width = `${safeRisk}%`;
      this.ui.stageHudRisk.dataset.level = safeRisk >= 75 ? "danger" : safeRisk >= 45 ? "warn" : "safe";
    }

    this.events.emit(GAME_EVENTS.TIMER_TICK, { remainingMs: Math.round(safeRemaining * 1000) });
    if (!this.warningSent && safeRemaining <= 5 && safeRemaining > 0) {
      this.warningSent = true;
      this.events.emit(GAME_EVENTS.TIMER_WARNING, {});
    }
  }

  onStageEnd({ success, elapsed, actions, extra = "", fragmentCollected = false, timePenalty = 0 } = {}) {
    if (!this.currentStage || !this.active) return;
    this.active = false;
    const run = window.archiveRun?.completeAttempt(success, fragmentCollected);
    this.emitRunSnapshot(run);
    const recovery = window.archiveProgress.record(this.currentStage.id, success, fragmentCollected);
    mainMenuFlow.renderStages();
    const detail = {
      stageId: this.currentStage.id,
      stage: this.currentStage,
      elapsed: Number((Number(elapsed) || 0).toFixed(2)),
      actions: Number(actions) || 0,
      extra,
      fragmentCollected,
      recovery,
      timePenalty,
      run,
    };
    this.events.emit(success ? GAME_EVENTS.STAGE_CLEAR : GAME_EVENTS.STAGE_FAIL, detail);
  }

  updateStageHud(stage) {
    this.ui.stageHud?.removeAttribute("hidden");
    if (this.ui.stageHudTitle) this.ui.stageHudTitle.textContent = `RECORD ${stage.number} · ${stage.title}`;
    if (this.ui.stageHudTimer) this.ui.stageHudTimer.textContent = "20.26";
    const run = window.archiveRun?.snapshot();
    if (this.ui.stageHudTotal) this.ui.stageHudTotal.textContent = ProtocolSelectFlow.formatClock(run?.totalRemainingMs ?? SCENARIO_DATA.totalTimeMs);
    if (this.ui.stageHudMemory) this.ui.stageHudMemory.textContent = `${run?.memoryCount ?? 0}/${run?.totalStages ?? 7}`;
    if (this.ui.stageHudAction) this.ui.stageHudAction.textContent = `${stage.actionLabel} 00`;
    if (this.ui.stageHudAnomaly) this.ui.stageHudAnomaly.textContent = stage.anomaly;
    if (this.ui.stageHudRisk) {
      this.ui.stageHudRisk.style.width = "0%";
      this.ui.stageHudRisk.dataset.level = "safe";
    }
  }

  syncAudio() {
    // channelVolume이 마스터 뮤트와 채널 뮤트를 모두 반영한다.
    window.archiveAudio?.setVolume(this.soundBus.channelVolume("sfx"));
    window.archiveAudio?.setBgmVolume(this.soundBus.channelVolume("bgm"));
  }
}

const archiveGameBridge = new ArchiveGameBridge(gameEvents, UI, audioBus);

viewportFitter.start();

window.addEventListener("beforeunload", () => {
  viewportFitter.stop();
  audioBus.destroy();
  window.archiveAudio?.stopBgm();
  gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, {});
  window.archivePhaserGame?.destroy(true);
});
