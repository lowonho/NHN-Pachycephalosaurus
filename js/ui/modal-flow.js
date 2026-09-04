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

    // 시작·재시작 요청이 어디서 오든 모달은 여기서 닫는다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_RESTART, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.close());

    this.events.on(GAME_EVENTS.STAGE_CLEAR, ({ elapsed } = {}) => this.showResult(true, elapsed));
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.showResult(false));
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

  showResult(success, elapsed) {
    const { ui } = this;
    const copy = this.strings.result;

    this.open();
    ui.modalStep.textContent = success ? copy.clearStep : copy.failStep;
    ui.modalTitle.textContent = success ? copy.clearTitle : copy.failTitle;
    ui.modalCopy.textContent = success ? copy.clearCopy(elapsed) : copy.failCopy;
    ui.modalResult.textContent = success ? copy.clearResult : copy.failResult;
    ui.primaryButton.textContent = this.strings.buttons.retryStage;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.mainMenu;
  }
}

const modalFlow = new ModalFlow(gameEvents, UI, STRINGS);
