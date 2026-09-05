/* 20.26초 결과: 선택 / 기록 재도전 / 메인. 성공과 실패 모두 자동 재시작하지 않습니다. */
class ModalFlow {
  constructor(events, dom) {
    this.events = events; this.ui = dom; this.returnFocus = null;
    dom.primaryButton.addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_STAGE_SELECT, {}));
    dom.secondaryButton.addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_RESTART, {}));
    document.querySelector('#result-main-button').addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
    for (const name of [GAME_EVENTS.REQUEST_START, GAME_EVENTS.REQUEST_RESTART, GAME_EVENTS.REQUEST_STAGE_SELECT, GAME_EVENTS.REQUEST_MAIN_MENU]) events.on(name, () => this.close());
    events.on(GAME_EVENTS.STAGE_CLEAR, detail => this.showResult(true, detail));
    events.on(GAME_EVENTS.STAGE_FAIL, detail => this.showResult(false, detail));
    window.addEventListener('keydown', event => {
      if (event.code === 'KeyR' && !event.repeat && this.isOpen()) { event.preventDefault(); events.emit(GAME_EVENTS.REQUEST_RESTART, {}); }
    });
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
  showResult(success, { stage, elapsed = 0, actions = 0, extra = '', run, record } = {}) {
    this.open();
    this.ui.modalStep.textContent = `${stage.id.toUpperCase()} / ${success ? 'CLEAR' : 'RETRY'}`;
    // 제한시간은 QA 모드가 바꿔 둘 수 있다(js/config/qa.js). 문구도 그 값을 따라간다.
    const limit = globalThis.archiveStageTimeLimit?.() ?? 20.26;
    const total = run?.totalStages ?? 5;
    this.ui.modalTitle.textContent = success ? (run?.clearedCount === total ? `${total}개 스테이지 클리어!` : '클리어!') : '다시 도전!';
    this.ui.modalCopy.textContent = success ? `${stage.title} · ${elapsed.toFixed(2)}초` : (extra || `${limit.toFixed(2)}초 안에 목표를 달성하지 못했습니다.`);
    const lines = [`${stage.actionLabel} ${actions}회 · 이번 판 ${run?.clearedCount ?? 0}/${total} 클리어`];
    if (success && extra) lines.push(extra);
    if (record) lines.push(`${record.isNew ? 'NEW BEST! ' : '최고 기록 '}${record.best.elapsed.toFixed(2)}초 · ${record.best.actions}회`);
    this.ui.modalResult.textContent = lines.join('\n');
    this.ui.primaryButton.textContent = '스테이지 선택'; this.ui.primaryButton.disabled = false;
    this.ui.secondaryButton.textContent = '다시하기 · 기록 도전 (R)'; this.ui.secondaryButton.hidden = false;
    this.ui.primaryButton.focus();
  }
}
const modalFlow = new ModalFlow(gameEvents, UI);
