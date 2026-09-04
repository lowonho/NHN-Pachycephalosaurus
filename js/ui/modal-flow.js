/*
 * 기능(B) — 결과 모달.
 *
 * 예전에는 이 파일이 "피치 조정(중간음 측정) + 결과"를 함께 들고 있었다.
 * 음성 조작을 걷어내면서 측정 단계가 통째로 사라져, 지금 남은 역할은
 * STAGE_CLEAR / STAGE_FAIL을 받아 결과 화면을 띄우는 것뿐이다.
 *
 * 스테이지가 아직 하나도 없으므로 이 모달은 현재 열릴 일이 없다.
 * 새 스테이지가 두 이벤트를 발행하는 순간부터 다시 동작한다.
 */

class ModalFlow {
  constructor(events, dom, strings) {
    this.events = events;
    this.ui = dom;
    this.strings = strings;
    this.returnFocus = null;

    this.ui.primaryButton?.addEventListener("click", () => this.onPrimary());
    this.ui.secondaryButton?.addEventListener("click", () => this.onSecondary());
    this.ui.resultContinueButton?.addEventListener("click", () => this.onContinue());

    // 시작·재시작 요청이 어디서 오든 모달은 여기서 닫는다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_RESTART, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.close());

    this.events.on(GAME_EVENTS.STAGE_CLEAR, (detail = {}) => this.showResult(true, detail));
    this.events.on(GAME_EVENTS.STAGE_FAIL, (detail = {}) => this.showResult(false, detail));

    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "r" || !this.isOpen()) return;
      event.preventDefault();
      this.onPrimary();
    });
  }

  isOpen() {
    return Boolean(this.ui.modal) && !this.ui.modal.classList.contains("hidden");
  }

  /*
   * 이 모달은 자기를 부른 화면을 지우지 않고 그 위에 덮는다.
   * 뒤 화면은 보이되 만질 수는 없어야 하므로 inert로 잠가 둔다.
   */
  lockBackground(locked) {
    [this.ui.appShell, this.ui.mainMenu, this.ui.settingsBackdrop].forEach((element) => {
      if (!element) return;
      if (locked) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    });
  }

  open() {
    // 뒤 화면을 inert로 잠그면 거기 있던 포커스가 풀린다. 닫을 때 되돌려 준다.
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

  /* 다시 도전 — 스테이지가 생기면 이 신호를 받아 같은 스테이지를 다시 연다. */
  onPrimary() {
    if (!this.isOpen()) return;
    audioBus.resume();
    this.events.emit(GAME_EVENTS.REQUEST_RESTART, {});
  }

  onSecondary() {
    if (!this.isOpen()) return;
    audioBus.resume();
    this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
  }

  onContinue() {
    if (!this.isOpen()) return;
    audioBus.resume();
    this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, { screen: "stage-select" });
  }

  showResult(success, { elapsed = 0, stage, actions = 0, extra = "", fragmentCollected = false, recovery } = {}) {
    const { ui } = this;
    const copy = this.strings.result;
    const elapsedText = Number(elapsed).toFixed(2);
    const stagePrefix = stage?.title ? `${stage.title} · ` : "";

    this.open();
    ui.modalStep.textContent = `RECORD ${stage?.number || ""} / RECOVERY RESULT`;
    ui.modalTitle.textContent = recovery?.result || (success ? "PARTIALLY RESTORED" : "RECORD LOST");
    ui.modalCopy.textContent = success
      ? `${fragmentCollected ? `${stage?.recordSymbol || "◆"} 기억 조각이 ARCHIVE에 저장되었습니다.` : "◇ 일부 데이터만 복구되었습니다. 조각을 획득한 뒤 목표를 달성하면 완전 복구됩니다."} ${stagePrefix}${elapsedText}초`
      : `${stagePrefix}기록 복구 실패. 이번 시도의 조각은 저장되지 않습니다. 이전 복구 기록은 유지됩니다.`;
    ui.modalResult.textContent = success
      ? `${stage?.actionLabel || "입력"} ${actions}회${extra ? ` · ${extra}` : ""}`
      : copy.failResult;
    if (recovery) ui.modalResult.textContent += ` · ARCHIVE RECOVERY ${recovery.recoveryRate}% · 기억 조각 ${recovery.fragmentCount}/${recovery.totalRecords}`;
    ui.primaryButton.textContent = this.strings.buttons.retryStage;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.mainMenu;
    ui.resultContinueButton?.focus();
  }
}

const modalFlow = new ModalFlow(gameEvents, UI, STRINGS);
