/* 스테이지 기록 등록 및 목숨 차감 결과. */
class ModalFlow {
  constructor(events, dom) {
    this.events = events;
    this.ui = dom;
    this.returnFocus = null;
    this.nextEvent = null;
    this.failureResult = false;
    dom.primaryButton.addEventListener('click', () => this.activatePrimary());
    dom.secondaryButton.addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_RESTART, {}));
    document.querySelector('#result-main-button').addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
    for (const name of [GAME_EVENTS.REQUEST_START, GAME_EVENTS.REQUEST_RESTART, GAME_EVENTS.REQUEST_CONTINUE, GAME_EVENTS.REQUEST_STAGE_SELECT, GAME_EVENTS.REQUEST_MAIN_MENU]) {
      events.on(name, () => this.close());
    }
    events.on(GAME_EVENTS.STAGE_CLEAR, (detail) => this.showResult(true, detail));
    events.on(GAME_EVENTS.STAGE_FAIL, (detail) => this.showResult(false, detail));
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR' && !event.repeat && this.isOpen()
        && (this.failureResult || !this.ui.secondaryButton.hidden)) {
        event.preventDefault();
        if (!this.ui.secondaryButton.hidden) this.ui.secondaryButton.click();
        else this.activatePrimary();
      }
    });
  }

  isOpen() { return !this.ui.modal.classList.contains('hidden'); }

  open() {
    this.returnFocus = document.activeElement;
    this.ui.modal.classList.remove('hidden');
    this.ui.appShell.setAttribute('inert', '');
  }

  close() {
    this.failureResult = false;
    this.ui.modal.classList.add('hidden');
    this.ui.appShell.removeAttribute('inert');
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
  }

  activatePrimary() {
    if (this.nextEvent) this.events.emit(this.nextEvent, {});
  }

  showResult(success, { stage, elapsed = 0, actions = 0, extra = '', run, record } = {}) {
    this.open();
    this.failureResult = !success;
    const qa = Boolean(globalThis.ARCHIVE_QA?.active || run?.qaMode);
    if (qa) {
      this.ui.modalStep.textContent = `${stage.id.toUpperCase()} / ${success ? 'CLEAR' : 'RETRY'}`;
      this.ui.modalTitle.textContent = success ? 'QA 클리어' : 'QA 재도전';
      this.ui.modalCopy.textContent = success ? `${stage.title} · ${elapsed.toFixed(2)}초` : (extra || '제한시간 안에 목표를 달성하지 못했습니다.');
      this.ui.modalResult.textContent = `${stage.actionLabel} ${actions}회`;
      this.ui.primaryButton.textContent = 'QA 패널로';
      this.ui.secondaryButton.hidden = false;
      this.ui.secondaryButton.textContent = '다시하기 (R)';
      this.nextEvent = GAME_EVENTS.REQUEST_STAGE_SELECT;
      this.ui.primaryButton.focus();
      return;
    }

    const act = run?.currentAct ?? 1;
    const slot = run?.currentStageInAct ?? 1;
    const recordId = `A${act}-${String(slot).padStart(2, '0')}`;
    const lives = `${'◆'.repeat(run?.lives ?? 0)}${'◇'.repeat(Math.max(0, 3 - (run?.lives ?? 0)))}`;
    this.ui.secondaryButton.hidden = true;

    if (success) {
      this.ui.modalStep.textContent = `${recordId} / REGISTERED`;
      this.ui.modalTitle.textContent = 'STAGE RECORD REGISTERED';
      this.ui.modalCopy.textContent = stage.title;
      const lines = [
        `${stage.actionLabel} ${actions}회 · ${elapsed.toFixed(2)}초`,
      ];
      if (record) lines.push(`${record.isNew ? 'NEW BEST! ' : 'BEST '}${record.best.elapsed.toFixed(2)}초`);
      this.ui.modalResult.textContent = lines.join('\n');
      this.ui.primaryButton.textContent = run?.transition === 'ending' ? '최종 증언 전송' : '계속';
      this.nextEvent = GAME_EVENTS.REQUEST_CONTINUE;
    } else {
      const actRestarted = run?.transition === 'act-restarted';
      this.ui.modalStep.textContent = actRestarted ? `ACT ${act} / 재도전` : 'ARCHIVE CONNECTION LOST';
      this.ui.modalTitle.textContent = actRestarted ? '현재 막을 다시 시작합니다' : '목숨을 잃었습니다';
      this.ui.modalCopy.textContent = actRestarted
        ? '목숨을 모두 소진했습니다.\n현재 막의 게임 구성을 새로 뽑아 다시 도전합니다.'
        : `${extra || '기록 접속에 실패했습니다.'}\n남은 목숨 ${lives}`;
      this.ui.modalResult.textContent = actRestarted
        ? `${run?.actAttemptCount?.[act - 1] ?? 1}번째 도전`
        : '같은 게임과 순서로 다시 접속합니다.';
      this.ui.primaryButton.textContent = actRestarted ? '현재 막 다시 도전 (R)' : '재접속 (R)';
      this.nextEvent = actRestarted ? GAME_EVENTS.REQUEST_CONTINUE : GAME_EVENTS.REQUEST_RESTART;
    }
    this.ui.primaryButton.disabled = false;
    this.ui.primaryButton.focus();
  }
}

const modalFlow = new ModalFlow(gameEvents, UI);
