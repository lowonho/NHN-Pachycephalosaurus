/*
 * 기능(B) — 기록실 연습. 도감에서 이미 열린(플레이해 본) 미니게임 칸을 누르면
 * 막(1/2/3) 난이도를 골라 그 미니게임 하나만 바로 시작한다.
 *
 * QA 모드(js/ui/qa-mode.js)와 같은 격리 방식을 쓴다 — window.archiveRun.startPractice가
 * 진짜 이야기 진행을 잠깐 접어 두고(qaBackup) 임의의 스테이지 하나만 선택 목록에 넣는다.
 * 다른 점은 딱 하나, 고른 막의 실제 억제 배율(난이도)을 그대로 쓴다는 것뿐이다
 * (js/archive/game.mjs — run.practiceMode). 끝나면 exitQa로 원래 진행을 되돌리고
 * 기록실로 돌아온다. 기록(최고 기록·복구 등급)은 평범한 플레이처럼 그대로 저장된다 —
 * QA 패널 플레이만 저장하지 않는다(globalThis.ARCHIVE_QA.active 기준, js/game.js).
 */

class PracticeFlow {
  constructor(events, dom, soundBus, protocolSelect, codex) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.protocolSelect = protocolSelect;
    this.codex = codex;
    this.active = false;
    this.pendingStageId = null;

    /* 도감 격자에 위임해서 듣는다 — render()가 카드를 통째로 다시 그려도 그대로 듣는다. */
    this.ui.codexGrid?.addEventListener("click", (event) => {
      const card = event.target.closest(".codex-card[data-discovered='true'][data-stage-id]");
      if (!card || card.classList.contains("codex-card--meme")) return;
      this.openDifficultyPicker(card.dataset.stageId);
    });
    this.ui.codexGrid?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".codex-card[data-discovered='true'][data-stage-id]");
      if (!card || card.classList.contains("codex-card--meme")) return;
      event.preventDefault();
      this.openDifficultyPicker(card.dataset.stageId);
    });

    this.ui.practiceDifficultyButtons?.forEach((button) => {
      button.addEventListener("click", () => this.launch(Number(button.dataset.act)));
    });
    this.ui.practiceDifficultyCancelButton?.addEventListener("click", () => this.closeDifficultyPicker());
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.isDifficultyPickerOpen()) {
        event.preventDefault();
        this.closeDifficultyPicker();
      }
    });

    /*
     * 결과 화면의 "기록실로"(js/ui/modal-flow.js)가 이 둘을 쏜다 — QA 모드가 자기 패널로
     * 돌아갈 때 쓰는 것과 같은 신호다. 연습 중이 아니면(qaModeFlow가 대신 처리하거나
     * 평범한 이야기 진행 중이면) 손대지 않는다.
     */
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => {
      if (!this.active) return;
      this.active = false;
      this.protocolSelect.close();
      window.archiveRun?.exitQa?.();
      this.codex.open();
    });
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => {
      if (!this.active) return;
      this.active = false;
      window.archiveRun?.exitQa?.();
    });
  }

  openDifficultyPicker(stageId) {
    if (!stageId) return;
    this.pendingStageId = stageId;
    this.ui.practiceDifficultyModal?.classList.remove("hidden");
    this.ui.practiceDifficultyButtons?.[0]?.focus();
  }

  closeDifficultyPicker() {
    this.ui.practiceDifficultyModal?.classList.add("hidden");
    this.pendingStageId = null;
  }

  isDifficultyPickerOpen() {
    return Boolean(this.ui.practiceDifficultyModal && !this.ui.practiceDifficultyModal.classList.contains("hidden"));
  }

  /* 브리핑에서 시작을 누르면 판을 세운다 — QA의 startNow와 같은 자리다. */
  startNow(stageId) {
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.protocolSelect.showScreen("play");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }

  launch(act) {
    const stageId = this.pendingStageId;
    this.closeDifficultyPicker();
    if (!stageId || !window.archiveGame || !window.archiveRun) return;
    this.soundBus.resume();
    window.archiveRun.startPractice(stageId, act);
    this.active = true;
    this.codex.close({ restoreFocus: false });
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.protocolSelect.openBrief(stageId, {
      onStart: () => this.startNow(stageId),
      onBack: () => {
        this.active = false;
        this.protocolSelect.close();
        window.archiveRun?.exitQa?.();
        this.codex.open();
      },
    });
  }
}

const practiceFlow = new PracticeFlow(
  gameEvents,
  UI,
  audioBus,
  protocolSelectFlow,
  codexFlow,
);
