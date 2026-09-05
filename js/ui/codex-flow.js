/*
 * 기록실 — 밈 기록과 미니게임 도감을 한 판때기에 담는다.
 *
 *   · 밈 기록       : 현재 게임에 쓰는 9개 밈을 한 칸씩 펼친다. 기본 탭이다.
 *   · 미니게임 도감 : 9개 미니게임을 전부 펼친다. 언제나 열려 있다.
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
 * ── 밈 기록 ─────────────────────────────────────────────────────────
 * 밈 하나가 반드시 카드 한 칸을 차지한다. 하나의 밈에서 여러 미니게임을 만들더라도
 * 카드 수는 늘리지 않고 stageIds로 관련 게임만 함께 표시한다.
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
  memes: "현재 기록된 밈을 한 칸씩 확인할 수 있습니다.",
  minigames: "한 번이라도 플레이한 미니게임이 열립니다. 열린 칸을 누르면 난이도를 골라 바로 연습할 수 있습니다.",
};

class CodexFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.catalog = PROTOCOLS;
    /* 기록실을 열 때마다 밈 기록이 미니게임 도감보다 먼저 보인다. */
    this.view = "memes";

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

  /* 밈 기록과 도감은 조건 없이 열린다. */
  open() {
    this.soundBus.resume();
    this.showTab("memes");
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

  showTab(view) {
    this.view = view === "minigames" ? "minigames" : "memes";
    this.render();
  }

  render() {
    const grid = this.ui.codexGrid;
    if (!grid) return;

    this.ui.codexTabs?.forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.codexTab === this.view));
    });

    /* 두 목록은 각각 9개지만 카드 내용과 칸 크기가 달라서 격자를 data-view로 갈아 끼운다. */
    grid.dataset.view = this.view;
    grid.setAttribute("aria-labelledby", `codex-tab-${this.view}`);
    if (this.ui.codexHint) this.ui.codexHint.textContent = CODEX_HINTS[this.view];

    if (this.view === "minigames") this.renderMinigames(grid);
    else this.renderMemes(grid);
  }

  /* ── 밈 기록 ─────────────────────────────────────────────────────── */

  renderMemes(grid) {
    grid.replaceChildren(...globalThis.MEME_RECORDS.map((meme) => this.buildMemeCard(meme)));
    if (this.ui.codexCount) {
      this.ui.codexCount.textContent = `MEMES ${globalThis.MEME_RECORDS.length} / ${globalThis.MEME_RECORDS.length}`;
    }
  }

  buildMemeCard(meme) {
    const card = document.createElement("li");
    card.className = "codex-card codex-card--meme";
    card.dataset.memeId = meme.id;
    card.dataset.discovered = "true";

    const head = document.createElement("div");
    head.className = "codex-card-head";
    const number = document.createElement("span");
    number.className = "codex-card-number";
    number.textContent = meme.number;
    const icon = document.createElement("span");
    icon.className = "codex-card-icon";
    const iconStage = this.catalog.find((stage) => stage.id === meme.stageIds[0]);
    const recordSymbol = iconStage?.recordSymbol ?? "◇";
    if (recordSymbol.trim().startsWith("<")) icon.innerHTML = recordSymbol;
    else icon.textContent = recordSymbol;
    head.append(number, icon);

    const title = document.createElement("strong");
    title.className = "codex-card-title";
    title.textContent = meme.title;

    const linkedStages = meme.stageIds
      .map((stageId) => this.catalog.find((stage) => stage.id === stageId))
      .filter(Boolean)
      .map((stage) => `${stage.number} · ${stage.title}`);
    const linked = document.createElement("p");
    linked.className = "codex-card-linked";
    linked.textContent = linkedStages.length > 0
      ? `연결 미니게임 ${linkedStages.join(" / ")}`
      : "연결 미니게임 준비 중";

    card.append(head, title, linked);
    return card;
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
    /* 열린 칸은 눌러서 바로 연습할 수 있다(js/ui/practice-flow.js가 클릭·Enter/Space를 듣는다). */
    if (discovered) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${stage.title} 연습하기`);
    }

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

}

const codexFlow = new CodexFlow(gameEvents, UI, audioBus);
