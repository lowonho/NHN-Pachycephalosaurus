/*
 * 기능(B) — 프로토콜 선택 화면(옛 스테이지 선택).
 *
 * 1인칭 모니터 화면 안에 복구할 기록 5개를 데스크톱 앱처럼 펼친다.
 * 타일을 누르면 같은 스크린 안에서 브리핑(openBrief)이 열리고,
 * 거기서 "증언 시작"을 눌러야 그 프로토콜이 시작된다(REQUEST_START).
 *
 * 각 게임은 독립된 20.26초 타이머를 사용한다. 책상 시계도 현재 시도의 시간을
 * 표시한다. 선택/소개/결과/일시정지에서는 멈춘다. 메인 화면으로 나가면(reset)
 * 랜덤 5개와 이번 판의 클리어 현황만 초기화하며 최고 기록은 유지한다.
 *
 * 남은 시간을 보여 주는 곳은 책상 위 탁상시계(#desk-clock) 하나뿐이다.
 * 모니터 스크린 안에는 두지 않는다 — 스크린은 플레이가 시작되면 게임 화면으로
 * 바뀌어서, 거기 둔 숫자는 정작 필요한 순간에 사라진다.
 */

const RECOVERY_BUDGET_MS = 20260;
const RECOVERY_URGENT_MS = 5000;

/*
 * ARCHIVE 복구 등급 — js/archive/progress.mjs의 RECORD_STATUS와 같은 문자열이다.
 * 그쪽은 ES 모듈이라 클래식 스크립트인 이 파일에서 import할 수 없어 값만 옮겨 적는다.
 * (progress.mjs의 값을 바꾸면 여기도 함께 바꿔야 한다.)
 */
const RECORD_DAMAGED = "DAMAGED";
const RECORD_PARTIAL = "PARTIALLY RESTORED";
const RECORD_FULL = "FULLY RESTORED";

/*
 * 앱 아이콘 — 스테이지가 뒤트는 물리 채널 하나를 그림 하나로 보여 준다.
 * (지침 9절: 물리 상태는 숫자보다 그림으로 알린다.)
 */
const PROTOCOL_GLYPHS = Object.freeze({
  stack: '<path d="M3 20h18M6 14h12v6H6zM8 8h10v6H8zM5 2h10v6H5z"/>',
  // 속도 — 가속선과 화살촉
  maze: '<path d="M3 8h9M3 12h12M3 16h7"/><path d="M15 6l5 6-5 6"/>',
  // 중력 — 바닥으로 떨어지는 화살
  gravity: '<path d="M12 3v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  // 탄성 — 튀어 오르는 공
  bounce: '<circle cx="12" cy="5" r="2.5"/><path d="M3 20c3-8 6-8 9 0s6 8 9 0"/>',
  // 반동 — 조준점
  recoil: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  // 마찰 — 미끄러지는 화물
  friction: '<path d="M3 20h18"/><path d="M6 16l2.5-6h7l2.5 6z"/><path d="M15 5h6M17 8h4"/>',
  // 시야 — 꺼져 가는 눈
  darkness: '<path d="M2.5 12S6.5 6.5 12 6.5 21.5 12 21.5 12 17.5 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.4"/><path d="M4 20L20 4"/>',
  // 각속도 — 멈추지 않는 회전
  rotation: '<path d="M20 12a8 8 0 1 1-2.9-6.2"/><path d="M20.5 4v5h-5"/>',
});

const PROTOCOL_GLYPH_FALLBACK = '<circle cx="12" cy="12" r="7"/><path d="M12 8v5"/>';

class ProtocolSelectFlow {
  constructor(events, dom, soundBus, strings, cutscene) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.strings = strings;
    this.cutscene = cutscene;

    /* 브리핑 화면의 두 버튼이 할 일. 브리핑을 접을 때 함께 비운다. */
    this.briefStart = null;
    this.briefBack = null;

    /*
     * 엔진을 기다리지 않는다 — js/config/protocols.js의 목록으로 바로 그린다.
     * 엔진이 뜨면 setStages가 더 자세한 목록으로 갈아 끼운다.
     */
    this.catalog = PROTOCOLS;
    this.stages = [];
    this.remainingMs = RECOVERY_BUDGET_MS;
    this.warnHandle = 0;

    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.render());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.render());
    this.events.on(GAME_EVENTS.TOTAL_TIMER_TICK, (snapshot = {}) => this.syncRun(snapshot));
    this.events.on(GAME_EVENTS.RUN_RESET, (snapshot = {}) => this.syncRun(snapshot));
    this.events.on(GAME_EVENTS.REQUEST_CONTINUE, () => this.continueStory());

    this.ui.protocolBriefStartButton?.addEventListener("click", () => this.confirmBrief());
    this.ui.protocolBriefBackButton?.addEventListener("click", () => this.cancelBrief());
    window.addEventListener("keydown", (event) => this.onBriefKeyDown(event));

    this.render();
  }

  /* ── 화면 여닫기 ─────────────────────────────────────────────────── */

  open() {
    this.soundBus.resume();
    this.refreshStages();
    this.render();
    // 뒤 화면(메인)은 보이더라도 만질 수 없어야 한다.
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.showScreen("select");

    const firstTile = this.ui.stageSelectGrid?.querySelector("button:not(:disabled)");
    (firstTile ?? this.ui.stageSelectBackButton)?.focus();
  }

  /* 모니터를 통째로 내린다 — 메인 화면으로 나갈 때만 부른다. */
  close() {
    // 브리핑을 열어 둔 채로 나갔다면 예약된 "시작"도 함께 버린다.
    this.briefStart = null;
    this.briefBack = null;
    this.showScreen("select");
    this.ui.stageSelectScreen?.classList.add("hidden");
  }

  /*
   * 모니터 스크린 안에서 선택 · 브리핑 · 플레이가 자리를 바꾼다.
   * 모니터·방·책상은 세 상태에서 그대로 서 있다 — 스크린 안쪽만 갈린다.
   */
  showScreen(mode) {
    const playing = mode === "play";
    if (this.ui.protocolScreen) this.ui.protocolScreen.dataset.mode = mode;

    // 브리핑은 스크린 안의 한 레이어다. 안 보일 때는 탭 순서에서도 빠져야 한다.
    if (this.ui.protocolBrief) this.ui.protocolBrief.hidden = mode !== "brief";

    if (this.ui.appShell) {
      this.ui.appShell.hidden = !playing;
      if (playing) this.ui.appShell.removeAttribute("inert");
      else this.ui.appShell.setAttribute("inert", "");
    }


    /*
     * Phaser는 부팅할 때 부모(#game-container)를 재는데, 그때 모니터가 아직
     * display:none이라 0×0으로 읽힌다. 스크린이 처음 보이는 이 시점에 다시 재게 한다.
     * (한 번이면 충분하다 — 부모의 레이아웃 크기는 1440×810로 고정이고,
     *  창 크기 변화는 조상의 --ui-scale 변환이 흡수한다.)
     */
    if (playing) window.archivePhaserGame?.scale?.refresh();
  }

  /* 한 판을 접는다 — 메인 화면으로 나갈 때 부른다. */
  reset() {
    const snapshot = window.archiveRun?.startNew();
    this.syncRun(snapshot);
    this.events.emit(GAME_EVENTS.RUN_RESET, snapshot);
    return snapshot;
  }

  refreshStages() {
    const selected = window.archiveRun?.snapshot().selectedStageIds ?? [];
    this.stages = selected.map((id) => this.catalog.find((stage) => stage.id === id)).filter(Boolean);
  }

  /*
   * 엔진이 보고해 온 목록으로 갈아 끼운다.
   * 빈 목록은 무시한다 — 이미 그려 둔 타일을 지우고 화면을 비우는 쪽이 더 나쁘다.
   */
  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    this.refreshStages();
    this.render();
  }

  startStage(stageId) {
    const run = window.archiveRun?.snapshot();
    if (!run?.qaMode && stageId !== run?.expectedStageId) return;

    /*
     * 엔진이 아직 없으면 이 화면을 떠나지 않는다.
     * 나가 버리면 빈 캔버스만 남고 일시정지 버튼도 없어서 돌아올 길이 사라진다.
     * (엔진이 늦게 뜨는 중이거나, index.html을 file://로 열어 모듈이 막힌 경우다.)
     */
    if (!window.archiveGame) {
      this.warnEngineMissing();
      return;
    }

    const stage = this.stages.find((item) => item.id === stageId);
    if (!stage) return;
    this.soundBus.resume();
    // 브리핑 중에는 누적 시간도 스테이지 시간도 시작하지 않는다.
    this.openBrief(stageId);
  }

  /* ── 브리핑 ──────────────────────────────────────────────────────── */

  /*
   * 고른 기억의 프로토콜을 스크린 안에서 설명한다.
   *
   * 예전에는 컷신(화면 전체를 덮는 대사창)이 이 자리를 맡았다. 지금은 모니터
   * 안에서 앱 하나가 더 열리는 모양이라 방·책상·탁상시계가 계속 보인다 —
   * 1인칭으로 모니터를 마주 본다는 화면 전제가 브리핑에서도 끊기지 않는다.
   *
   * onStart·onBack을 주면 그것을 따른다(QA 모드는 목록 대신 QA 판으로 돌아간다).
   * 기본값은 이 화면의 흐름 그대로 — 시작하면 플레이로, 돌아가면 기억 목록으로.
   */
  openBrief(stageId, { onStart, onBack } = {}) {
    // 목록에 없는 기억도 열 수 있다 — QA 모드는 9개 전부를 바로 연다.
    const stage = this.stages.find((item) => item.id === stageId)
      ?? this.catalog.find((item) => item.id === stageId);
    if (!stage) return;

    this.briefStart = typeof onStart === "function" ? onStart : () => this.launchStage(stage.id);
    this.briefBack = typeof onBack === "function" ? onBack : () => this.closeBrief(stage.id);

    this.renderBrief(stage);
    this.showScreen("brief");
    this.ui.protocolBriefStartButton?.focus();
  }

  /* 시작 — 브리핑을 접고 저장해 둔 다음 걸음을 밟는다. */
  confirmBrief() {
    const start = this.briefStart;
    this.briefStart = null;
    this.briefBack = null;
    start?.();
  }

  /* 목록으로 — 무엇도 시작하지 않는다(시간은 아직 흐르지 않았다). */
  cancelBrief() {
    const back = this.briefBack;
    this.briefStart = null;
    this.briefBack = null;
    back?.();
  }

  /* 기억 목록으로 되돌리고, 방금 고른 타일에 포커스를 돌려준다. */
  closeBrief(stageId) {
    this.showScreen("select");
    const tile = stageId
      ? this.ui.stageSelectGrid?.querySelector(`[data-stage-id="${stageId}"]`)
      : null;
    (tile ?? this.ui.stageSelectGrid?.querySelector("button:not(:disabled)"))?.focus();
  }

  isBriefOpen() {
    return this.ui.protocolScreen?.dataset.mode === "brief"
      && this.ui.stageSelectScreen?.classList.contains("hidden") === false;
  }

  /*
   * 브리핑에서는 Enter·Space로 시작하고 Esc로 목록으로 돌아간다.
   * 버튼에 포커스가 있으면 그 버튼이 알아서 처리하므로 여기서는 비켜선다.
   */
  onBriefKeyDown(event) {
    if (!this.isBriefOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.cancelBrief();
      return;
    }

    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.closest(".protocol-brief-button")) return;
    event.preventDefault();
    this.confirmBrief();
  }

  /* 브리핑 내용 — 목록 타일이 title로만 갖고 있던 설명을 화면에 펼친다. */
  renderBrief(stage) {
    const set = (element, text) => {
      if (element) element.textContent = text;
    };

    const run = window.archiveRun?.snapshot();
    const slot = Math.max(1, run?.currentStageInAct ?? 1);
    const act = SCENARIO_DATA.acts[(run?.currentAct ?? 1) - 1];
    const recordId = `A${run?.currentAct ?? 1}-${String(slot).padStart(2, "0")}`;
    set(this.ui.protocolBriefCode, `// ${recordId}`);
    set(this.ui.protocolBriefTitle, stage.title);
    set(this.ui.protocolBriefId, stage.id.toUpperCase());
    set(this.ui.protocolBriefNumber, recordId);
    set(this.ui.protocolBriefSymbol, stage.recordSymbol);
    set(this.ui.protocolBriefObjective, `${stage.objective}\n${act?.objective ?? ""}`);
    set(this.ui.protocolBriefControls, stage.controls);
    set(this.ui.protocolBriefAnomaly, stage.anomaly);

    const registered = Boolean(run?.stageRecords?.[(run?.currentAct ?? 1) - 1]?.[slot - 1]);
    const status = registered ? "REGISTERED" : "CONNECT";
    if (this.ui.protocolBriefRecord) {
      this.ui.protocolBriefRecord.dataset.recovery = registered ? "full" : "damaged";
    }
    set(this.ui.protocolBriefStamp, status);

    const best = window.archiveRecords?.best(stage.id);
    if (this.ui.protocolBriefBest) {
      this.ui.protocolBriefBest.textContent = "";
      this.ui.protocolBriefBest.append(
        document.createTextNode(best ? best.elapsed.toFixed(2) : "--.--"),
      );
      const unit = document.createElement("small");
      unit.textContent = "s";
      this.ui.protocolBriefBest.append(unit);
    }
  }

  launchStage(stageId) {
    this.showScreen("play");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }

  continueStory() {
    if (globalThis.ARCHIVE_QA?.active) return;
    const before = window.archiveRun?.snapshot();
    const advanced = window.archiveRun?.advance();
    if (!before || !advanced) return;
    this.syncRun(advanced.snapshot);
    const open = () => this.open();
    const play = (name, done = open) => this.playStoryCutscene(name, done);

    if (advanced.transition === "next-stage") {
      open();
      return;
    }
    if (advanced.transition === "next-act") {
      if (before.currentAct === 1) play("betrayal");
      else play("source", () => play("experiment"));
      return;
    }
    if (advanced.transition === "act-restarted") {
      if (advanced.snapshot.currentAct === 1 && advanced.snapshot.assistProtocolAct1) play("assist");
      else open();
      return;
    }
    if (advanced.transition === "ending") {
      play("ending", () => this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {}));
      return;
    }
    open();
  }

  playStoryCutscene(name, onDone) {
    const data = SCENARIO_DATA.cutscenes[name];
    if (!data || window.archiveRun?.hasSeenCutscene(data.id)) {
      onDone?.();
      return;
    }
    this.close();
    this.cutscene.play({
      chapter: data.chapter,
      script: data.script,
      auto: data.auto,
      onDone: () => {
        window.archiveRun?.markCutsceneSeen(data.id);
        onDone?.();
      },
    });
  }

  /* 하단 바 문구를 잠깐 경고로 바꾼다. 엔진이 도착하면 setStages가 알아서 되돌린다. */
  warnEngineMissing() {
    const label = this.ui.protocolProgress;
    if (!label) return;
    label.dataset.state = "warn";
    label.textContent = this.strings.protocol.engineMissing;
    window.clearTimeout(this.warnHandle);
    this.warnHandle = window.setTimeout(() => this.renderProgress(), 2800);
  }

  syncRun(snapshot = {}) {
    if (Number.isFinite(snapshot.stageRemainingMs)) this.remainingMs = snapshot.stageRemainingMs;
    else if (Number.isFinite(snapshot.totalRemainingMs)) this.remainingMs = snapshot.totalRemainingMs;
    this.refreshStages();
    this.render();
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */

  render() {
    this.renderTiles();
    this.renderTimer();
    this.renderProgress();
    this.renderArchive();
  }

  /*
   * 남은 시간은 책상 위 탁상시계 한 곳에만 뜬다.
   * 스크린 안에 또 두면 플레이 중에만 사라져서 오히려 헷갈린다.
   */
  renderTimer() {
    if (!this.ui.deskClock) return;

    const parts = ProtocolSelectFlow.clockParts(this.remainingMs);
    this.ui.deskClock.dataset.state = this.remainingMs <= RECOVERY_URGENT_MS ? "urgent" : "idle";

    if (this.ui.deskClockMinutes) this.ui.deskClockMinutes.textContent = parts.minutes;
    if (this.ui.deskClockSeconds) this.ui.deskClockSeconds.textContent = parts.seconds;
    if (this.ui.deskClockCentis) this.ui.deskClockCentis.textContent = parts.centis;
  }

  renderProgress() {
    const label = this.ui.protocolProgress;
    const run = window.archiveRun?.snapshot();
    if (!label || !run) return;
    window.clearTimeout(this.warnHandle);
    delete label.dataset.state;
    const lives = `${"◆".repeat(run.lives)}${"◇".repeat(Math.max(0, 3 - run.lives))}`;
    label.textContent = `ACT ${run.currentAct}/3 · STAGE ${run.currentStageInAct}/6 · LIVES ${lives} · RECORDS ${run.totalRecordCount}/18`;
    if (this.ui.stageSelectTitle) {
      const act = SCENARIO_DATA.acts[run.currentAct - 1];
      this.ui.stageSelectTitle.textContent = `ACT ${run.currentAct} ${act?.code ?? ""} · 6 OF 10 RECORDS CONNECTED`;
    }
  }

  /*
   * ARCHIVE 복구 현황 — 판을 넘어 남는 누적 기록이다(js/archive/progress.mjs).
   *
   * 위의 renderProgress(RESTORED n / 5)와 성격이 다르다. 그쪽은 이번 판에서
   * 복구한 개수라 reset()으로 0이 되고, 여기는 localStorage에 저장돼 다음 판에도 남는다.
   *
   * 기록은 엔진(js/archive/game.mjs)이 세우므로 엔진이 뜨기 전에는 없을 수 있다.
   * 그때는 마크업의 기본값(0%)을 그대로 두고 아무것도 건드리지 않는다 —
   * 0으로 덮어써도 같은 값이라 얻는 것이 없고, 엔진이 뜨면 setStages가 다시 부른다.
   *
   * 복구율은 메인 화면에도 같은 [data-archive-recovery]로 떠 있어서 함께 갱신된다.
   */
  renderArchive() {
    const run = window.archiveRun?.snapshot();
    if (!run) return;

    this.ui.archiveRecoveryRates?.forEach((element) => {
      element.textContent = `TOTAL RECORDS ${run.totalRecordCount}/18`;
    });

    if (this.ui.archiveRecoveryDetail) {
      this.ui.archiveRecoveryDetail.textContent = `ACT ${run.currentAct} RECORDS ${run.actRecordCount}/6 · ATTEMPT ${run.actAttemptCount[run.currentAct - 1]}`;
    }

    const ending = this.ui.archiveEndingStatus;
    if (ending) {
      ending.hidden = !run.assistProtocolAct1;
      ending.textContent = run.assistProtocolAct1 ? "ASSIST PROTOCOL ENABLED" : "";
    }
  }

  renderTiles() {
    const grid = this.ui.stageSelectGrid;
    if (!grid) return;
    grid.replaceChildren();
    const run = window.archiveRun?.snapshot();
    if (!run?.active && !run?.qaMode) {
      const loading = document.createElement("div");
      loading.className = "stage-select-card stage-select-card--soon";
      loading.textContent = "기록 접속을 시작해 주세요.";
      grid.append(loading);
      return;
    }

    this.stages.forEach((stage, index) => grid.append(this.buildTile(stage, index, run)));
  }

  buildTile(stage, index, run) {
    const tile = document.createElement("button");
    const slot = index + 1;
    const restored = Boolean(run.stageRecords?.[run.currentAct - 1]?.[index]);
    const current = slot === run.currentStageInAct;
    tile.type = "button";
    // .stage-select-card / data-stage-id는 화면 밖(테스트·스크립트)에서 쓰는 이름이라 유지한다.
    tile.className = "stage-select-card protocol-app";
    tile.dataset.stageId = stage.id;
    tile.dataset.slot = String(slot);
    tile.dataset.restored = String(restored);
    tile.dataset.current = String(current);
    tile.dataset.recovery = restored ? "full" : "damaged";
    tile.disabled = !run.qaMode && (!current || restored);

    const icon = document.createElement("span");
    icon.className = "protocol-app-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = stage.recordSymbol;

    const code = document.createElement("span");
    code.className = "protocol-app-code";
    // ◆ 완전 복구 / ◇ 그 외 — 복구 등급을 글자 하나로 붙인다.
    code.textContent = `A${run.currentAct}-${String(slot).padStart(2, "0")} · ${restored ? "◆" : current ? "▶" : "◇"}`;

    const title = document.createElement("strong");
    title.className = "protocol-app-title";
    title.textContent = stage.title;

    const mark = document.createElement("span");
    mark.className = "protocol-app-mark";
    mark.textContent = restored ? "REGISTERED" : current ? "CONNECT" : "LOCKED";

    tile.append(icon, code, title, mark);
    tile.title = `${stage.controls}\n${stage.objective}\n${stage.anomaly}`;
    const best = window.archiveRecords?.best(stage.id);
    if (best) {
      const record = document.createElement('small');
      record.className = 'protocol-best'; record.textContent = `BEST ${best.elapsed.toFixed(2)}s · ${best.actions}회`;
      tile.append(record);
    }
    tile.addEventListener("click", () => this.startStage(stage.id));
    return tile;
  }

  static glyph(stageId) {
    const paths = PROTOCOL_GLYPHS[stageId] ?? PROTOCOL_GLYPH_FALLBACK;
    return `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  /* 143000 → "02:23.00". 1/100초까지 스테이지 HUD와 같은 기준으로 표시한다. */
  static formatClock(milliseconds) {
    const safe = Math.max(0, Math.round(milliseconds));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor(safe / 1000) % 60;
    const hundredths = Math.floor((safe % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
  }

  /*
   * 143000 → { minutes: "2", seconds: "23", centis: "00" }.
   *
   * 전부 내림이다. 초만 올림하면 시계가 0:01.50인데 초 자리는 0:02가 되어
   * 같은 판 위의 두 숫자가 서로 안 맞는다.
   */
  static clockParts(milliseconds) {
    const total = Math.max(0, milliseconds);
    return {
      minutes: String(Math.floor(total / 60000)),
      seconds: String(Math.floor(total / 1000) % 60).padStart(2, "0"),
      centis: String(Math.floor(total / 10) % 100).padStart(2, "0"),
    };
  }
}

const protocolSelectFlow = new ProtocolSelectFlow(gameEvents, UI, audioBus, STRINGS, cutsceneFlow);
