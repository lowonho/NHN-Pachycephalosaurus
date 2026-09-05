/* 결과 화면: 스테이지 선택 / 메인. 성공과 실패 모두 자동 재시작하지 않습니다. */
class ModalFlow {
  constructor(events, dom) {
    this.events = events; this.ui = dom; this.returnFocus = null;
    dom.primaryButton.addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_STAGE_SELECT, {}));
    document.querySelector('#result-main-button').addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
    for (const name of [GAME_EVENTS.REQUEST_START, GAME_EVENTS.REQUEST_RESTART, GAME_EVENTS.REQUEST_STAGE_SELECT, GAME_EVENTS.REQUEST_MAIN_MENU]) events.on(name, () => this.close());
    events.on(GAME_EVENTS.STAGE_CLEAR, detail => this.showResult(true, detail));
    events.on(GAME_EVENTS.STAGE_FAIL, detail => this.showResult(false, detail));
  }
  isOpen() { return !this.ui.modal.classList.contains('hidden'); }
  open() {
    this.returnFocus = document.activeElement;
    this.ui.modal.classList.remove('hidden'); this.ui.appShell.setAttribute('inert', '');
  }
  close() {
    this.ui.modal.classList.add('hidden'); this.ui.appShell.removeAttribute('inert');
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
  }
  showResult(success, { stage, run } = {}) {
    this.open();
    this.ui.modalStep.textContent = `${stage.id.toUpperCase()} / ${success ? 'CLEAR' : 'RETRY'}`;
    const total = run?.totalStages ?? 5;
    this.ui.modalTitle.textContent = success ? (run?.clearedCount === total ? `${total}개 스테이지 클리어!` : '클리어!') : '다시 도전!';
    // 기록·시간 문구는 노출하지 않는다.
    this.ui.modalCopy.textContent = ''; this.ui.modalCopy.hidden = true;
    this.ui.modalResult.textContent = ''; this.ui.modalResult.hidden = true;
    this.ui.primaryButton.textContent = '스테이지 선택'; this.ui.primaryButton.disabled = false;
    this.ui.secondaryButton.hidden = true;
    this.ui.primaryButton.focus();
  }
}
const modalFlow = new ModalFlow(gameEvents, UI);
