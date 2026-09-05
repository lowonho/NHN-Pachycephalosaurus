/*
 * Downloads/2026-ARCHIVE-GitHub의 7개 스테이지 엔진과 기존 DOM UI를 잇는 어댑터.
 * 게임 규칙은 js/archive/game.mjs가 담당하고, 이 파일은 화면 전환·일시정지·결과만 연결한다.
 */

/* 죽고 나서 시작점으로 되감기까지의 틈. 죽음 연출이 보일 만큼만 짧게 둔다. */
const RETRY_DELAY_MS = 420;

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
    this.retryHandle = 0;

    window.addEventListener("archive-game-ready", (event) => this.onReady(event.detail));
    window.addEventListener("archive-hud", (event) => this.onHud(event.detail));
    window.addEventListener("archive-stage-end", (event) => this.onStageEnd(event.detail));
    window.addEventListener("archive-wall-hit", () => {
      // 중앙 정렬이 translateX(-50%)라 확대에도 그것을 함께 적어야 자리가 안 튄다.
      this.ui.stageHudTimer?.animate([
        { color: "#ff947d", transform: "translateX(-50%) scale(1.15)" },
        { color: "#ffe04b", transform: "translateX(-50%) scale(1)" },
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
  }

  onReady({ scene, stages } = {}) {
    this.api = window.archiveGame;
    this.stages = Array.isArray(stages) ? stages : [];
    this.events.emit(GAME_EVENTS.SCENE_CREATE, { scene });
    mainMenuFlow.setStages(this.stages);
    this.syncAudio();

    window.archiveAudio?.startBgm();

    if (this.pendingStageId) {
      const stageId = this.pendingStageId;
      this.pendingStageId = null;
      this.start(stageId);
    }
  }

  start(stageId) {
    if (!stageId) return;
    this.cancelRetry();
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
    this.updateStageHud(stage);
    this.api.loadStage(stage.id);
    this.api.start();
    this.events.emit(GAME_EVENTS.STAGE_START, { stageId: stage.id, stage });
  }

  restart() {
    if (this.currentStage) this.start(this.currentStage.id);
  }

  /*
   * 죽은 자리에서 시작점으로 되감는다.
   *
   * 다음 틱으로 미루는 이유: archive-stage-end는 Phaser의 update() 한가운데서
   * 동기로 날아온다. 여기서 곧장 loadStage를 부르면 스테이지 오브젝트를 지운 뒤에도
   * 남은 update 코드가 그 오브젝트를 계속 만진다. 짧은 틈은 "죽었다"는 연출
   * (화면 붉은 플래시 · 흔들림 · 실패음)이 보일 자리이기도 하다.
   */
  scheduleRetry() {
    const stageId = this.currentStage?.id;
    if (!stageId) return;
    window.clearTimeout(this.retryHandle);
    this.retryHandle = window.setTimeout(() => {
      this.retryHandle = 0;
      // 그 사이 판이 끝났거나(2:26 소진) 화면을 떠났으면 stop()이 예약을 지운다.
      this.start(stageId);
    }, RETRY_DELAY_MS);
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
    this.cancelRetry();
    this.api?.stop();
    this.ui.stageHud?.setAttribute("hidden", "");
    if (this.ui.stageHudTimer) this.ui.stageHudTimer.hidden = true;
  }

  cancelRetry() {
    window.clearTimeout(this.retryHandle);
    this.retryHandle = 0;
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

    /*
     * 죽으면(추락·20.26초 소진) 결과창을 띄우지 않는다 — 그 프로토콜의 시작점으로
     * 곧장 되감는다. 한 판의 진짜 실패는 프로토콜 하나가 아니라 2:26 예산이
     * 바닥나는 순간이고(js/ui/protocol-select-flow.js), 그 예산은 되감는 동안에도
     * 계속 줄고 있다. 그러니 여기서 손을 멈추게 할 이유가 없다.
     */
    if (!success) {
      this.scheduleRetry();
      return;
    }

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
    // 남은 20.26초는 좌상단 패널 밖(화면 중앙 상단)에 따로 서 있어서 따로 여닫는다.
    if (this.ui.stageHudTimer) {
      this.ui.stageHudTimer.hidden = false;
      this.ui.stageHudTimer.textContent = "20.26";
    }
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
