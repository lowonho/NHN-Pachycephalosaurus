/*
 * 기능(B) — 설정/결과 모달의 화면 전환.
 * 이전 mic-test-controller.js + game.js의 showResult/버튼 핸들러를 합친 자리다.
 *
 * 화면 흐름을 하나의 상태값(this.step)으로 관리한다. 이전 구조처럼
 * dataset.action 문자열이 두 파일에 흩어져 있지 않다.
 */

const MODAL_STEP = Object.freeze({
  INTRO: "intro",
  CALIBRATING: "calibrating",
  CALIBRATION_FAILED: "calibration-failed",
  MIC_ERROR: "mic-error",
  READY: "ready",
  RESULT: "result",
});

class ModalFlow {
  constructor(events, dom, voice, strings) {
    this.events = events;
    this.ui = dom;
    this.voice = voice;
    this.strings = strings;
    this.step = MODAL_STEP.INTRO;
    this.destination = "main";
    this.stageId = "geoje";
    this.returnFocus = null;

    this.ui.primaryButton?.addEventListener("click", () => this.onPrimary());
    this.ui.secondaryButton?.addEventListener("click", () => this.onSecondary());

    // 시작·재시작 요청이 어디서 오든(버튼이든 R키든) 모달은 여기서 닫는다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());
    this.events.on(GAME_EVENTS.REQUEST_RESTART, () => this.close());

    this.events.on(GAME_EVENTS.STAGE_CLEAR, ({ elapsed, stageId }) => this.showResult(true, elapsed, stageId));
    this.events.on(GAME_EVENTS.STAGE_FAIL, ({ stageId } = {}) => this.showResult(false, undefined, stageId));
  }

  isOpen() {
    return Boolean(this.ui.modal) && !this.ui.modal.classList.contains("hidden");
  }

  /*
   * 이 모달은 자기를 부른 화면을 지우지 않는다. 메인 화면의 "게임 시작"에서 왔으면
   * 메인 화면 위에, 설정의 "마이크 조정"에서 왔으면 설정 화면 위에 그대로 덮인다.
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

  showIntro() {
    const { ui } = this;
    this.step = MODAL_STEP.INTRO;
    ui.calibrationVisual.classList.remove("listening");
    ui.modalStep.textContent = this.strings.intro.step;
    ui.modalTitle.textContent = this.strings.intro.title;
    ui.modalCopy.textContent = this.strings.intro.copy;
    ui.calibrationResult.textContent = "";
    ui.primaryButton.textContent = this.strings.buttons.connect;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.keyboard;
  }

  /*
   * destination은 어느 화면 위에 덮였는지이자 측정을 마치면 돌아갈 곳이다.
   *   "stage"    — 메인 화면의 "게임 시작". 메인으로 돌아가지 않고 곧장 스테이지를 연다.
   *   "settings" — 설정의 "마이크 조정". 뒤에 그대로 있는 설정 화면으로 돌아간다.
   *   "main"     — 그 밖(결과 화면의 "중간음 다시 측정"). 메인 화면으로 돌아간다.
   */
  beginCalibration(destination = "main", stageId = "geoje") {
    this.destination = destination;
    this.stageId = stageId;
    this.open();
    this.runCalibration();
  }

  startStage(voiceEnabled) {
    this.events.emit(GAME_EVENTS.REQUEST_START, { voiceEnabled, stageId: this.stageId });
  }

  onPrimary() {
    // 사용자 제스처 시점에 오디오 컨텍스트를 깨운다(autoplay 정책).
    audioBus.resume();

    if (this.step === MODAL_STEP.READY) {
      // "settings"도 메인 화면 신호를 쓴다 — 설정 화면은 그 위에 그대로 남아 다시 드러난다.
      if (this.destination === "stage") this.startStage(true);
      else this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
      return;
    }

    if (this.step === MODAL_STEP.RESULT) {
      this.events.emit(GAME_EVENTS.REQUEST_RESTART, {});
      return;
    }

    this.runCalibration();
  }

  onSecondary() {
    audioBus.resume();

    const keyboardFallback =
      this.step === MODAL_STEP.INTRO ||
      this.step === MODAL_STEP.CALIBRATION_FAILED ||
      this.step === MODAL_STEP.MIC_ERROR;

    if (keyboardFallback) {
      // 마이크를 포기해도 흐름은 유지한다 — 게임 시작에서 왔으면 그대로 스테이지로.
      if (this.destination === "stage") this.startStage(false);
      else this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
      return;
    }

    if (this.step === MODAL_STEP.RESULT) {
      if (this.resultStageId === "dujjonku") {
        this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
        return;
      }
      this.beginCalibration("main");
      return;
    }

    this.runCalibration();
  }

  async runCalibration() {
    const { ui } = this;
    const copy = this.strings.calibration;

    this.step = MODAL_STEP.CALIBRATING;
    ui.primaryButton.disabled = true;
    ui.secondaryButton.hidden = true;
    ui.modalStep.textContent = copy.step;
    ui.modalTitle.textContent = copy.title;
    ui.modalCopy.textContent = copy.copy;
    ui.calibrationResult.textContent = copy.listening;
    ui.calibrationVisual.classList.add("listening");

    try {
      if (!this.voice.stream) await this.voice.connect();
      const result = await this.voice.calibrate();
      ui.calibrationVisual.classList.remove("listening");

      if (!result.ok) {
        this.showCalibrationFailed();
        return;
      }
      this.showReady(Math.round(result.pitch));
    } catch (error) {
      ui.calibrationVisual.classList.remove("listening");
      this.showMicError(error);
    }
  }

  showCalibrationFailed() {
    const { ui } = this;
    const copy = this.strings.calibration;

    this.step = MODAL_STEP.CALIBRATION_FAILED;
    ui.modalTitle.textContent = copy.failTitle;
    ui.modalCopy.textContent = copy.failCopy;
    ui.calibrationResult.textContent = copy.failResult;
    ui.primaryButton.textContent = this.strings.buttons.retryCalibration;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.continueKeyboard;
  }

  showMicError(error) {
    const { ui } = this;
    const copy = this.strings.calibration;

    this.step = MODAL_STEP.MIC_ERROR;
    ui.modalTitle.textContent = copy.errorTitle;
    ui.modalCopy.textContent = copy.errorCopy;
    ui.calibrationResult.textContent = error?.message || copy.errorFallback;
    ui.primaryButton.textContent = this.strings.buttons.reconnect;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.continueKeyboard;

    this.events.emit(GAME_EVENTS.MIC_FAILED, { message: this.strings.status.micDenied });
  }

  showReady(pitchHz) {
    const { ui } = this;
    const copy = this.strings.calibration;

    this.step = MODAL_STEP.READY;
    ui.modalTitle.textContent = copy.doneTitle;
    ui.modalCopy.innerHTML = copy.doneCopyHtml;
    ui.calibrationResult.textContent = copy.doneResult(pitchHz);
    ui.primaryButton.textContent = this.strings.buttons.done[this.destination];
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = this.strings.buttons.recalibrate;
  }

  showResult(success, elapsed, stageId = "geoje") {
    const { ui } = this;
    const copy = this.strings.result;

    this.step = MODAL_STEP.RESULT;
    this.resultStageId = stageId;
    this.open();
    ui.modalStep.textContent = success ? copy.clearStep : copy.failStep;
    ui.modalTitle.textContent = success ? copy.clearTitle : copy.failTitle;
    ui.modalCopy.textContent = success ? copy.clearCopy(elapsed) : copy.failCopy;
    ui.calibrationResult.textContent = success ? copy.clearResult : copy.failResult;
    ui.primaryButton.textContent = this.strings.buttons.retryStage;
    ui.primaryButton.disabled = false;
    ui.secondaryButton.hidden = false;
    ui.secondaryButton.textContent = stageId === "dujjonku"
      ? "메인 화면"
      : this.strings.buttons.recalibrate;
  }
}

const modalFlow = new ModalFlow(gameEvents, UI, voiceController, STRINGS);
