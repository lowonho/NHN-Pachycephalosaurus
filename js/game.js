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

    window.addEventListener("archive-game-ready", (event) => this.onReady(event.detail));
    window.addEventListener("archive-hud", (event) => this.onHud(event.detail));
    window.addEventListener("archive-stage-end", (event) => this.onStageEnd(event.detail));
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
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.stop());
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncAudio());
  }

  onReady({ scene, stages } = {}) {
    this.api = window.archiveGame;
    this.stages = Array.isArray(stages) ? stages : [];
    this.events.emit(GAME_EVENTS.SCENE_CREATE, { scene });
    mainMenuFlow.setStages(this.stages);
    this.syncAudio();

    if (this.pendingStageId) {
      const stageId = this.pendingStageId;
      this.pendingStageId = null;
      this.start(stageId);
    }
  }

  start(stageId) {
    if (!stageId) return;
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
    this.updateStageHud(stage);
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
    this.events.emit(GAME_EVENTS.STAGE_PAUSE, { stageId: this.currentStage?.id });
  }

  resume() {
    if (!this.active || !this.api) return;
    this.api.pause(false);
    this.events.emit(GAME_EVENTS.STAGE_RESUME, { stageId: this.currentStage?.id });
  }

  stop() {
    this.active = false;
    this.warningSent = false;
    this.pendingStageId = null;
    this.api?.stop();
    this.ui.stageHud?.setAttribute("hidden", "");
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
    };
    this.events.emit(success ? GAME_EVENTS.STAGE_CLEAR : GAME_EVENTS.STAGE_FAIL, detail);
  }

  updateStageHud(stage) {
    this.ui.stageHud?.removeAttribute("hidden");
    if (this.ui.stageHudTitle) this.ui.stageHudTitle.textContent = `RECORD ${stage.number} · ${stage.title}`;
    if (this.ui.stageHudTimer) this.ui.stageHudTimer.textContent = "20.26";
    if (this.ui.stageHudAction) this.ui.stageHudAction.textContent = `${stage.actionLabel} 00`;
    if (this.ui.stageHudAnomaly) this.ui.stageHudAnomaly.textContent = stage.anomaly;
    if (this.ui.stageHudRisk) {
      this.ui.stageHudRisk.style.width = "0%";
      this.ui.stageHudRisk.dataset.level = "safe";
    }
  }

  syncAudio() {
    const volume = this.soundBus.muted
      ? 0
      : this.soundBus.volumes.master * this.soundBus.volumes.sfx;
    window.archiveAudio?.setVolume(volume);
  }
}

const archiveGameBridge = new ArchiveGameBridge(gameEvents, UI, audioBus);

viewportFitter.start();

window.addEventListener("beforeunload", () => {
  viewportFitter.stop();
  audioBus.destroy();
  gameEvents.emit(GAME_EVENTS.SCENE_SHUTDOWN, {});
  window.archivePhaserGame?.destroy(true);
});
