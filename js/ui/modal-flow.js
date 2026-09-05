/*
 * 스테이지 성공 결과 → 기억 증언 → 중반 반전/엔딩을 잇는 흐름.
 * 일반 스테이지 실패는 js/game.js에서 짧은 연출 뒤 자동 재구성한다.
 */
class ModalFlow {
  constructor(events, dom, strings, cutscene) {
    this.events = events;
    this.ui = dom;
    this.strings = strings;
    this.cutscene = cutscene;
    this.returnFocus = null;
    this.detail = null;
    this.success = false;
    this.midpointShown = false;

    this.ui.primaryButton?.addEventListener("click", () => this.onPrimary());
    this.ui.secondaryButton?.addEventListener("click", () => this.onSecondary());

    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_RESTART, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.close());
    this.events.on(GAME_EVENTS.RUN_RESET, () => { this.midpointShown = false; });
    this.events.on(GAME_EVENTS.RUN_END, ({ ending } = {}) => {
      if (ending === "failure") this.showEnding("failure");
    });
    this.events.on(GAME_EVENTS.STAGE_CLEAR, (detail = {}) => this.showResult(true, detail));
    this.events.on(GAME_EVENTS.STAGE_FAIL, (detail = {}) => this.showResult(false, detail));

    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "r" || !this.isOpen()) return;
      event.preventDefault();
      this.events.emit(GAME_EVENTS.REQUEST_RESTART, {});
    });
  }

  isOpen() {
    return Boolean(this.ui.modal) && !this.ui.modal.classList.contains("hidden");
  }

  lockBackground(locked) {
    [this.ui.appShell, this.ui.mainMenu, this.ui.settingsBackdrop].forEach((element) => {
      if (!element) return;
      if (locked) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    });
  }

  open() {
    this.returnFocus = document.activeElement;
    this.ui.modal?.classList.remove("hidden");
    this.lockBackground(true);
  }

  close() {
    this.ui.modal?.classList.add("hidden");
    this.lockBackground(false);
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
  }

  onPrimary() {
    if (!this.isOpen()) return;
    audioBus.resume();
    if (!this.success) {
      this.events.emit(GAME_EVENTS.REQUEST_RESTART, {});
      return;
    }
    this.continueAfterSuccess();
  }

  onSecondary() {
    if (!this.isOpen()) return;
    audioBus.resume();
    this.events.emit(this.success ? GAME_EVENTS.REQUEST_RESTART : GAME_EVENTS.REQUEST_STAGE_SELECT, {});
  }

  showResult(success, detail = {}) {
    const { ui } = this;
    const { stage, elapsed = 0, actions = 0, extra = "", fragmentCollected = false, timePenalty = 0, run } = detail;
    const system = SCENARIO_DATA.system;
    this.success = success;
    this.detail = detail;
    this.open();

    ui.modalStep.textContent = success ? `RECORD ${stage?.number || ""} / TESTIMONY` : system.stageFailedTitle;
    ui.modalTitle.textContent = success
      ? (fragmentCollected ? system.sharedTitle : system.personalTitle)
      : system.stageFailedTitle;
    ui.modalCopy.textContent = success
      ? (fragmentCollected ? system.sharedResult : system.personalResult)
      : system.stageFailedResult;

    const result = [];
    if (stage?.title) result.push(`${stage.title} · ${Number(elapsed).toFixed(2)}초`);
    if (success) result.push(`${stage?.actionLabel || "입력"} ${actions}회${extra ? ` · ${extra}` : ""}`);
    else if (extra) result.push(extra);
    if (timePenalty > 0) result.push(`충돌 시간 차감 −${timePenalty.toFixed(2)}초`);
    if (run) result.push(`TOTAL ${ProtocolSelectFlow.formatClock(run.totalRemainingMs)} · MEMORY ${run.memoryCount}/${run.totalStages}`);
    ui.modalResult.textContent = result.join("\n");

    ui.primaryButton.textContent = success
      ? (fragmentCollected ? this.strings.buttons.viewMemory : this.strings.buttons.continueStory)
      : this.strings.buttons.retryStage;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = success ? "이 스테이지 다시 도전" : this.strings.buttons.stageSelect;
    ui.primaryButton.focus();
  }

  continueAfterSuccess() {
    const detail = this.detail || {};
    const story = SCENARIO_DATA.stages.find((stage) => stage.id === detail.stageId);
    this.close();
    if (!detail.fragmentCollected || !story) {
      this.finishStageNarrative();
      return;
    }

    this.cutscene.play({
      chapter: `MEMORY ${story.number} // ${story.memoryTitle}`,
      script: story.memoryScene,
      auto: true,
      onDone: () => {
        if (story.id === "recoil" && !this.midpointShown) {
          this.midpointShown = true;
          this.cutscene.play({
            chapter: SCENARIO_DATA.midpoint.chapter,
            script: SCENARIO_DATA.midpoint.script,
            auto: true,
            onDone: () => this.finishStageNarrative(),
          });
        } else {
          this.finishStageNarrative();
        }
      },
    });
  }

  finishStageNarrative() {
    const ending = window.archiveRun?.resolveEnding();
    if (ending === "true" || ending === "normal") this.showEnding(ending);
    else this.events.emit(GAME_EVENTS.REQUEST_STAGE_SELECT, {});
  }

  showEnding(ending) {
    const scene = SCENARIO_DATA.endings[ending];
    if (!scene) return;
    this.close();
    this.cutscene.play({
      chapter: scene.chapter,
      script: scene.script,
      auto: true,
      onDone: () => this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}),
    });
  }
}

const modalFlow = new ModalFlow(gameEvents, UI, STRINGS, cutsceneFlow);
