/* 스테이지 기록 등록 및 목숨 차감 결과. */
class ModalFlow {
  constructor(events, dom) {
    this.events = events;
    this.ui = dom;
    this.returnFocus = null;
    this.nextEvent = null;
    this.autoHandle = 0;
    dom.primaryButton.addEventListener('click', () => this.activatePrimary());
    dom.secondaryButton.addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_RESTART, {}));
    document.querySelector('#result-main-button').addEventListener('click', () => events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
    for (const name of [GAME_EVENTS.REQUEST_START, GAME_EVENTS.REQUEST_RESTART, GAME_EVENTS.REQUEST_CONTINUE, GAME_EVENTS.REQUEST_STAGE_SELECT, GAME_EVENTS.REQUEST_MAIN_MENU]) {
      events.on(name, () => this.close());
    }
    events.on(GAME_EVENTS.STAGE_CLEAR, (detail) => this.showResult(true, detail));
    events.on(GAME_EVENTS.STAGE_FAIL, (detail) => this.showResult(false, detail));
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR' && !event.repeat && this.isOpen() && this.nextEvent === GAME_EVENTS.REQUEST_RESTART) {
        event.preventDefault();
        this.activatePrimary();
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
    window.clearTimeout(this.autoHandle);
    this.autoHandle = 0;
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
    const storyRecord = SCENARIO_DATA.records.find((item) => item.id === recordId);
    const lives = `${'◆'.repeat(run?.lives ?? 0)}${'◇'.repeat(Math.max(0, 3 - (run?.lives ?? 0)))}`;
    this.ui.secondaryButton.hidden = true;

    if (success) {
      this.ui.modalStep.textContent = `${recordId} / REGISTERED`;
      this.ui.modalTitle.textContent = 'STAGE RECORD REGISTERED';
      this.ui.modalCopy.textContent = `${storyRecord?.title ?? stage.title}\n${storyRecord?.text ?? ''}`;
      const lines = [
        `ACT RECORDS ${run?.actRecordCount ?? 0}/6 · TOTAL RECORDS ${run?.totalRecordCount ?? 0}/18`,
        `${stage.actionLabel} ${actions}회 · ${elapsed.toFixed(2)}초`,
      ];
      if (record) lines.push(`${record.isNew ? 'NEW BEST! ' : 'BEST '}${record.best.elapsed.toFixed(2)}초`);
      this.ui.modalResult.textContent = lines.join('\n');
      this.ui.primaryButton.textContent = run?.transition === 'ending' ? '최종 증언 전송' : '계속';
      this.nextEvent = GAME_EVENTS.REQUEST_CONTINUE;
    } else {
      const actRestarted = run?.transition === 'act-restarted';
      this.ui.modalStep.textContent = actRestarted ? 'CONNECTION PATH REBUILT' : 'ARCHIVE CONNECTION LOST';
      this.ui.modalTitle.textContent = actRestarted ? '막을 재구성합니다' : '목숨을 잃었습니다';
      this.ui.modalCopy.textContent = actRestarted
        ? `${SCENARIO_DATA.system.actRestarted}\n새로운 여섯 게임을 연결합니다.`
        : `${extra || '기록 접속에 실패했습니다.'}\nLIVES ${lives}`;
      this.ui.modalResult.textContent = actRestarted
        ? `ACT ${act} ATTEMPT ${run?.actAttemptCount?.[act - 1] ?? 1}`
        : '같은 게임과 순서로 다시 접속합니다.';
      this.ui.primaryButton.textContent = actRestarted ? '새 접속 경로 확인' : '재접속 (R)';
      this.nextEvent = actRestarted ? GAME_EVENTS.REQUEST_CONTINUE : GAME_EVENTS.REQUEST_RESTART;
      this.autoHandle = window.setTimeout(() => this.activatePrimary(), 900);
    }
    this.ui.primaryButton.disabled = false;
    this.ui.primaryButton.focus();
  }
}

const modalFlow = new ModalFlow(gameEvents, UI);
