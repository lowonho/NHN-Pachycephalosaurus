/*
 * 기록실 — 탭 두 장을 한 판때기에 담는다.
 *
 *   · 미니게임 도감 : 10개 미니게임을 전부 펼친다. 언제나 열려 있다.
 *   · 증언 기록     : 18개 증언 기록. 엔딩(archiveViewerUnlocked)에서 열린다.
 *
 * 두 목록이 한 화면을 나눠 쓰는 이유는 성격이 같아서다 —
 * 둘 다 "지금까지 무엇이 남았는가"를 보여 주고, 아직 못 채운 칸은
 * 지우지 않고 딤드로 남긴다. 메인 메뉴 버튼 하나로 둘 다 닿는다.
 *
 * ── 미니게임 도감 ───────────────────────────────────────────────────
 * 한 막에 6개만 뽑히는 프로토콜 선택 화면과 달리 여기는 언제나 전부 나온다 —
 * 아직 안 해 본 게임이 무엇인지 보여 주는 것이 이 탭의 일이다.
 *
 * 열림/딤드의 기준은 클리어가 아니라 "한 번이라도 해 봤는가"다(js/archive/plays.mjs).
 * 해 보지 않은 칸은 번호와 이름만 남기고 딤드로 두며, 목표는 감춘다.
 * 열린 칸에도 목표 한 줄만 적는다 — 조작과 변수는 판을 시작할 때 브리핑이 말해 준다.
 *
 * 예전에 클리어한 사람은 플레이 기록(archive-2026-minigame-plays-v1)이 없어도
 * 복구 등급·최고 기록이 남아 있으므로 그것도 "해 본 것"으로 친다.
 * 그래서 도감을 새로 붙였다고 이미 연 칸이 다시 잠기지 않는다.
 *
 * 목록은 엔진을 기다리지 않는다 — 프로토콜 선택 화면과 같은 MINIGAME_CATALOG로 그린다.
 *
 * ── 증언 기록 ───────────────────────────────────────────────────────
 * 엔딩 뒤 해금된다. 이번 회차에 실제로 등록한 기록(run.archiveEntries)만 열리고,
 * 어느 미니게임으로 증언했는지와 기록 본문을 함께 적는다.
 */

/* progress.mjs의 RECORD_STATUS와 같은 문자열이다(클래식 스크립트라 import할 수 없다). */
const CODEX_RECORD_DAMAGED = "DAMAGED";
const CODEX_RECORD_FULL = "FULLY RESTORED";

/*
 * 아직 열지 않은 칸의 자물쇠. 다른 칸의 기호(⇅ ◉ ▤ …)와 같은 자리에 들어가므로
 * 색은 currentColor로 물려받고 크기는 1em으로 맞춘다 — css/codex.css가 잡는 값을 따른다.
 */
const CODEX_LOCK_ICON = `
  <svg class="codex-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
`;

/* 탭마다 발치에 적는 한 줄 — 이 화면이 지금 무엇을 세고 있는지 말한다. */
const CODEX_HINTS = {
  minigames: "한 번이라도 플레이한 미니게임이 열립니다.",
  records: "최종 증언을 마치면 진행 중 등록한 기록을 다시 읽을 수 있습니다.",
};

class CodexFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.catalog = PROTOCOLS;
    /* 열 때마다 도감으로 돌아온다 — 언제나 볼 것이 있는 쪽이라서다. */
    this.view = "minigames";

    this.ui.codexTabs?.forEach((tab) => {
      tab.addEventListener("click", () => this.showTab(tab.dataset.codexTab));
    });
    this.ui.codexCloseButton?.addEventListener("click", () => this.close());
    this.ui.codexBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === this.ui.codexBackdrop) this.close();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen()) this.close();
    });
  }

  isOpen() {
    return Boolean(this.ui.codexBackdrop) && !this.ui.codexBackdrop.classList.contains("hidden");
  }

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  /* 도감은 조건 없이 열린다 — 잠기는 것은 안쪽의 "증언 기록" 탭뿐이다. */
  open() {
    this.soundBus.resume();
    this.showTab("minigames");
    this.ui.codexBackdrop?.classList.remove("hidden");
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.codexDialog?.focus();
  }

  close({ restoreFocus = true } = {}) {
    this.ui.codexBackdrop?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
    if (restoreFocus) this.ui.mainCodexButton?.focus();
  }

  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    if (this.isOpen()) this.render();
  }

  /* 엔딩 전에 증언 기록으로 넘어가려 하면 도감에 그대로 둔다. */
  showTab(view) {
    const unlocked = Boolean(window.archiveRun?.snapshot().archiveViewerUnlocked);
    this.view = view === "records" && unlocked ? "records" : "minigames";
    this.render();
  }

  render() {
    const grid = this.ui.codexGrid;
    if (!grid) return;

    const unlocked = Boolean(window.archiveRun?.snapshot().archiveViewerUnlocked);
    if (this.ui.codexRecordsTab) this.ui.codexRecordsTab.disabled = !unlocked;
    this.ui.codexTabs?.forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.codexTab === this.view));
    });

    /* 두 목록은 칸 수(10 / 18)도 칸 크기도 달라서 격자를 data-view로 갈아 끼운다. */
    grid.dataset.view = this.view;
    grid.setAttribute("aria-labelledby", `codex-tab-${this.view}`);
    if (this.ui.codexHint) this.ui.codexHint.textContent = CODEX_HINTS[this.view];

    if (this.view === "records") this.renderRecords(grid);
    else this.renderMinigames(grid);
  }

  /* ── 미니게임 도감 ───────────────────────────────────────────────── */

  renderMinigames(grid) {
    const opened = this.catalog.filter((stage) => CodexFlow.hasPlayed(stage.id));
    grid.replaceChildren(...this.catalog.map((stage) => this.buildMinigameCard(stage)));
    if (this.ui.codexCount) {
      this.ui.codexCount.textContent = `PLAYED ${opened.length} / ${this.catalog.length}`;
    }
  }

  /*
   * "해 본 것"의 판정. 플레이 기록이 먼저지만, 그 기록을 붙이기 전에
   * 클리어해 둔 사람도 이미 연 칸을 잃지 않도록 복구 등급·최고 기록도 함께 본다.
   */
  static hasPlayed(stageId) {
    if (window.archivePlays?.has(stageId)) return true;
    if (window.archiveRecords?.best(stageId)) return true;
    const status = window.archiveProgress?.status(stageId);
    return Boolean(status) && status !== CODEX_RECORD_DAMAGED;
  }

  buildMinigameCard(stage) {
    const discovered = CodexFlow.hasPlayed(stage.id);
    const card = document.createElement("li");
    card.className = "codex-card";
    card.dataset.stageId = stage.id;
    card.dataset.discovered = String(discovered);

    const head = document.createElement("div");
    head.className = "codex-card-head";
    const number = document.createElement("span");
    number.className = "codex-card-number";
    number.textContent = stage.number;
    const icon = document.createElement("span");
    icon.className = "codex-card-icon";
    /* 안 열린 칸은 기호마저 감춘다 — 자물쇠가 그 자리를 대신한다. */
    if (!discovered) icon.innerHTML = CODEX_LOCK_ICON;
    /* 기호가 SVG 마크업(거미줄 질주 등)이면 그대로 꽂고, 아니면 여느 문자 기호처럼 넣는다. */
    else if (stage.recordSymbol.trim().startsWith("<")) icon.innerHTML = stage.recordSymbol;
    else icon.textContent = stage.recordSymbol;
    head.append(number, icon);

    const title = document.createElement("strong");
    title.className = "codex-card-title";
    title.textContent = stage.title;
    card.append(head, title);

    if (discovered) {
      /*
       * 도감은 "무엇을 해야 하는 게임인가"만 보여 준다.
       * 조작·변수 안내는 판을 시작할 때 브리핑(프로토콜 선택 화면)이 맡는다 —
       * 열 칸이 한 화면에 늘어서는 곳이라 줄이 길어지면 목록으로 읽히지 않는다.
       */
      card.append(CodexFlow.buildGoal(stage.objective));

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
      locked.textContent = "미접속 기록";
      card.append(locked);
    }
    return card;
  }

  /* 한 줄뿐이라 머리표("목표")를 달지 않는다 — 붙일 이름이 없는 유일한 문장이다. */
  static buildGoal(objective) {
    const goal = document.createElement("p");
    goal.className = "codex-card-goal";
    goal.textContent = objective;
    return goal;
  }

  /* ── 증언 기록 ───────────────────────────────────────────────────── */

  renderRecords(grid) {
    const run = window.archiveRun?.snapshot();
    const entries = run?.archiveEntries ?? [];
    const byRecord = new Map(entries.map((entry) => [entry.recordId, entry]));
    grid.replaceChildren(
      ...SCENARIO_DATA.records.map((record) => this.buildRecordCard(record, byRecord.get(record.id))),
    );
    if (this.ui.codexCount) {
      this.ui.codexCount.textContent = `RECORDS ${entries.length} / ${SCENARIO_DATA.totalRecords}`;
    }
  }

  buildRecordCard(record, entry) {
    const stage = this.catalog.find((item) => item.id === entry?.gameId);
    const card = document.createElement("li");
    card.className = "codex-card";
    card.dataset.recordId = record.id;
    card.dataset.discovered = String(Boolean(entry));

    const head = document.createElement("div");
    head.className = "codex-card-head";
    const number = document.createElement("span");
    number.className = "codex-card-number";
    number.textContent = record.id;
    const icon = document.createElement("span");
    icon.className = "codex-card-icon";
    icon.textContent = entry ? "◆" : "◇";
    head.append(number, icon);

    const title = document.createElement("strong");
    title.className = "codex-card-title";
    title.textContent = record.title;
    card.append(head, title);

    if (entry) {
      const game = document.createElement("p");
      game.className = "codex-card-record";
      game.textContent = `${entry.gameId.toUpperCase()} · ${stage?.title ?? "기록 미상"}`;
      game.dataset.full = "true";
      const detail = document.createElement("p");
      detail.className = "codex-card-text codex-card-testimony";
      detail.textContent = record.text;
      card.append(game, detail);
    } else {
      const locked = document.createElement("p");
      locked.className = "codex-card-locked";
      locked.textContent = "등록되지 않은 증언";
      card.append(locked);
    }
    return card;
  }
}

const codexFlow = new CodexFlow(gameEvents, UI, audioBus);
