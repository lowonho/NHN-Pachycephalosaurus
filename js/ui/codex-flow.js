/*
 * 기능(B) — 미니게임 도감.
 *
 * 메인 화면의 "미니게임 도감"으로 열고, 10개 미니게임을 한 장에 펼친다.
 * 한 판에 랜덤 5개만 뽑히는 프로토콜 선택 화면과 달리 여기는 언제나 전부 나온다 —
 * 아직 안 해 본 게임이 무엇인지 보여 주는 것이 이 화면의 일이다.
 *
 * 열림/딤드의 기준은 클리어가 아니라 "한 번이라도 해 봤는가"다(js/archive/plays.mjs).
 * 해 보지 않은 칸은 번호와 이름만 남기고 딤드로 두며, 조작·목표·변수는 감춘다.
 *
 * 예전에 클리어한 사람은 플레이 기록(archive-2026-minigame-plays-v1)이 없어도
 * 복구 등급·최고 기록이 남아 있으므로 그것도 "해 본 것"으로 친다.
 * 그래서 도감을 새로 붙였다고 이미 연 칸이 다시 잠기지 않는다.
 *
 * 목록은 엔진을 기다리지 않는다 — 프로토콜 선택 화면과 같은 MINIGAME_CATALOG로 그린다.
 */

/* progress.mjs의 RECORD_STATUS와 같은 문자열이다(클래식 스크립트라 import할 수 없다). */
const CODEX_RECORD_DAMAGED = "DAMAGED";
const CODEX_RECORD_FULL = "FULLY RESTORED";

class CodexFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.catalog = PROTOCOLS;

    this.ui.codexCloseButton?.addEventListener("click", () => this.close());

    // 프레임 바깥(어두운 배경)을 누르면 닫는다 — 설정 화면과 같은 규칙이다.
    this.ui.codexBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === this.ui.codexBackdrop) this.close();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen()) this.close();
    });

    /*
     * 도감을 열어 둔 채로는 게임이 시작될 수 없지만, 판이 끝나고 메인으로
     * 돌아오는 길에 새로 열린 칸이 생긴다. 다음에 열 때 다시 그리면 되므로
     * 여기서는 STAGE_CLEAR 같은 신호를 따로 듣지 않는다 — open()이 매번 그린다.
     */
  }

  isOpen() {
    return Boolean(this.ui.codexBackdrop) && !this.ui.codexBackdrop.classList.contains("hidden");
  }

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  open() {
    this.soundBus.resume();
    this.render();
    this.ui.codexBackdrop?.classList.remove("hidden");
    // 뒤 화면(메인)은 보이더라도 만질 수 없어야 한다.
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.codexDialog?.focus();
  }

  close({ restoreFocus = true } = {}) {
    this.ui.codexBackdrop?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
    if (restoreFocus) this.ui.mainCodexButton?.focus();
  }

  /* 엔진이 더 자세한 목록을 넘겨 주면 갈아 끼운다(프로토콜 선택과 같은 경로다). */
  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    if (this.isOpen()) this.render();
  }

  /*
   * 해 본 게임인가 — 플레이 기록이 첫째 기준이고,
   * 그 기록이 생기기 전에 남은 복구 등급·최고 기록도 같이 인정한다.
   */
  isDiscovered(stageId) {
    if (window.archivePlays?.has(stageId)) return true;
    const status = window.archiveProgress?.status(stageId);
    if (status && status !== CODEX_RECORD_DAMAGED) return true;
    return Boolean(window.archiveRecords?.best(stageId));
  }

  render() {
    const grid = this.ui.codexGrid;
    if (!grid) return;

    const stages = Array.isArray(this.catalog) ? this.catalog : [];
    grid.replaceChildren(...stages.map((stage) => this.buildCard(stage)));

    if (this.ui.codexCount) {
      const discovered = stages.filter((stage) => this.isDiscovered(stage.id)).length;
      this.ui.codexCount.textContent = `DISCOVERED ${discovered} / ${stages.length}`;
    }
  }

  buildCard(stage) {
    const discovered = this.isDiscovered(stage.id);
    const card = document.createElement("li");
    card.className = "codex-card";
    card.dataset.stageId = stage.id;
    // 딤드 처리의 스위치. 색·투명도는 css/codex.css가 이 값으로 잡는다.
    card.dataset.discovered = String(discovered);

    const head = document.createElement("div");
    head.className = "codex-card-head";

    const number = document.createElement("span");
    number.className = "codex-card-number";
    number.textContent = stage.number;

    const icon = document.createElement("span");
    icon.className = "codex-card-icon";
    icon.setAttribute("aria-hidden", "true");
    // 해 보지 않은 칸은 기호도 물음표로 둔다 — 실루엣만 남기는 도감의 관례다.
    icon.textContent = discovered ? stage.recordSymbol : "?";

    head.append(number, icon);

    const title = document.createElement("strong");
    title.className = "codex-card-title";
    title.textContent = stage.title;

    card.append(head, title);

    if (discovered) {
      card.append(
        CodexFlow.buildLine("조작", stage.controls),
        CodexFlow.buildLine("목표", stage.objective),
        CodexFlow.buildLine("변수", stage.anomaly),
      );

      const best = window.archiveRecords?.best(stage.id);
      const full = window.archiveProgress?.status(stage.id) === CODEX_RECORD_FULL;
      const mark = document.createElement("p");
      mark.className = "codex-card-record";
      mark.textContent = best
        ? `BEST ${best.elapsed.toFixed(2)}s · ${stage.actionLabel} ${best.actions}회`
        : "기록 없음 · 아직 클리어하지 못했습니다";
      if (full) mark.dataset.full = "true";
      card.append(mark);
    } else {
      const locked = document.createElement("p");
      locked.className = "codex-card-locked";
      locked.textContent = "아직 플레이하지 않았습니다";
      card.append(locked);
    }

    return card;
  }

  static buildLine(label, value) {
    const line = document.createElement("p");
    line.className = "codex-card-line";
    const tag = document.createElement("span");
    tag.className = "codex-card-tag";
    tag.textContent = label;
    const text = document.createElement("span");
    text.className = "codex-card-text";
    text.textContent = value;
    line.append(tag, text);
    return line;
  }
}

const codexFlow = new CodexFlow(gameEvents, UI, audioBus);
