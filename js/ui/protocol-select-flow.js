/*
 * 기능(B) — 프로토콜 선택 화면(옛 스테이지 선택).
 *
 * 1인칭 모니터 화면 안에 복구할 기록 5개를 데스크톱 앱처럼 펼친다.
 * 타일을 누르면 그 프로토콜이 바로 시작된다(REQUEST_START).
 *
 * ── 2:23.00 ─────────────────────────────────────────────────────────
 * 각 20.26초 타이머와 별개인 한 판의 누적 제한시간이다. Phaser가 실제 플레이를
 * 진행한 프레임만 game.js가 차감하며, 소개·결과·기억 감상·일시정지에서는 멈춘다.
 * 메인 화면으로 나가면(reset) 이번 판의 시간과 증언 기록이 처음으로 돌아간다.
 *
 * 남은 시간을 보여 주는 곳은 책상 위 탁상시계(#desk-clock) 하나뿐이다.
 * 모니터 스크린 안에는 두지 않는다 — 스크린은 플레이가 시작되면 게임 화면으로
 * 바뀌어서, 거기 둔 숫자는 정작 필요한 순간에 사라진다.
 */

const RECOVERY_BUDGET_MS = SCENARIO_DATA.totalTimeMs; // 정확히 2:23.00
const RECOVERY_URGENT_MS = 30_000; // 이 아래로 떨어지면 타이머가 깜빡인다.

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

    /*
     * 엔진을 기다리지 않는다 — js/config/protocols.js의 목록으로 바로 그린다.
     * 엔진이 뜨면 setStages가 더 자세한 목록으로 갈아 끼운다.
     */
    this.stages = PROTOCOLS;
    this.restored = new Set();
    this.remainingMs = RECOVERY_BUDGET_MS;
    this.timedOut = false;
    this.warnHandle = 0;

    this.events.on(GAME_EVENTS.STAGE_CLEAR, ({ stageId } = {}) => this.markRestored(stageId));
    this.events.on(GAME_EVENTS.TOTAL_TIMER_TICK, (snapshot = {}) => this.syncRun(snapshot));
    this.events.on(GAME_EVENTS.RUN_RESET, (snapshot = {}) => this.syncRun(snapshot));

    this.render();
  }

  /* ── 화면 여닫기 ─────────────────────────────────────────────────── */

  open() {
    this.soundBus.resume();
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
    this.showScreen("select");
    this.ui.stageSelectScreen?.classList.add("hidden");
  }

  /*
   * 모니터 스크린 안에서 프로토콜 선택과 플레이가 자리를 바꾼다.
   * 모니터·방·책상은 두 상태에서 그대로 서 있다 — 스크린 안쪽만 갈린다.
   */
  showScreen(mode) {
    const playing = mode === "play";
    if (this.ui.protocolScreen) this.ui.protocolScreen.dataset.mode = mode;

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
    const snapshot = window.archiveRun?.reset();
    this.remainingMs = snapshot?.totalRemainingMs ?? RECOVERY_BUDGET_MS;
    this.timedOut = false;
    this.restored.clear();
    this.events.emit(GAME_EVENTS.RUN_RESET, snapshot || { totalRemainingMs: this.remainingMs, memoryCount: 0, clearedCount: 0 });
    this.render();
  }

  /*
   * 엔진이 보고해 온 목록으로 갈아 끼운다.
   * 빈 목록은 무시한다 — 이미 그려 둔 타일을 지우고 화면을 비우는 쪽이 더 나쁘다.
   */
  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.stages = stages;
    this.render();
  }

  startStage(stageId) {
    if (this.timedOut) return;

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
    const story = SCENARIO_DATA.stages.find((item) => item.id === stageId);
    this.soundBus.resume();
    // 소개 중에는 누적 시간도 스테이지 시간도 시작하지 않는다.
    this.cutscene.play({
      chapter: `RECORD ${stage.number} // ${stage.title}`,
      script: story?.brief || [],
      auto: true,
      onDone: () => this.launchStage(stageId),
    });
  }

  launchStage(stageId) {
    if (this.timedOut) return;
    this.showScreen("play");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
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

  isComplete() {
    return this.stages.length > 0 && this.restored.size >= this.stages.length;
  }

  markRestored(stageId) {
    if (!stageId || this.timedOut) return;
    this.restored.add(stageId);
    this.render();
  }

  syncRun(snapshot = {}) {
    if (Number.isFinite(snapshot.totalRemainingMs)) this.remainingMs = snapshot.totalRemainingMs;
    this.timedOut = snapshot.ending === "failure";
    if (Array.isArray(snapshot.clearedStageIds)) this.restored = new Set(snapshot.clearedStageIds);
    this.renderTimer();
    this.renderProgress();
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
    this.ui.deskClock.dataset.state = this.isComplete()
      ? "done"
      : this.remainingMs <= RECOVERY_URGENT_MS
        ? "urgent"
        : "idle";

    if (this.ui.deskClockMinutes) this.ui.deskClockMinutes.textContent = parts.minutes;
    if (this.ui.deskClockSeconds) this.ui.deskClockSeconds.textContent = parts.seconds;
    if (this.ui.deskClockCentis) this.ui.deskClockCentis.textContent = parts.centis;
  }

  renderProgress() {
    const label = this.ui.protocolProgress;
    if (!label) return;
    window.clearTimeout(this.warnHandle);
    delete label.dataset.state;
    const run = window.archiveRun?.snapshot();
    label.textContent = this.strings.protocol.progress(
      this.restored.size,
      run?.memoryCount ?? 0,
      this.stages.length || 5,
    );
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
    const summary = window.archiveProgress?.summary();
    if (!summary) return;

    this.ui.archiveRecoveryRates?.forEach((element) => {
      element.textContent = this.strings.archive.rate(summary.recoveryRate);
    });

    if (this.ui.archiveRecoveryDetail) {
      this.ui.archiveRecoveryDetail.textContent = this.strings.archive.detail(
        summary.clearedCount,
        summary.fragmentCount,
        summary.totalRecords,
      );
    }

    // 엔딩 등급은 5개를 전부 복구했을 때만 뜬다.
    const ending = this.ui.archiveEndingStatus;
    if (ending) {
      ending.hidden = !summary.allCleared;
      ending.textContent = this.strings.archive.ending[summary.ending] ?? "";
    }
  }

  renderTiles() {
    const grid = this.ui.stageSelectGrid;
    if (!grid) return;
    grid.replaceChildren();

    if (this.stages.length === 0) {
      const loading = document.createElement("div");
      loading.className = "stage-select-card stage-select-card--soon";
      const title = document.createElement("strong");
      title.className = "protocol-app-title";
      title.textContent = this.strings.protocol.loading;
      loading.append(title);
      grid.append(loading);
      return;
    }

    this.stages.forEach((stage) => {
      grid.append(this.buildTile(stage));
    });
  }

  buildTile(stage) {
    const tile = document.createElement("button");
    tile.type = "button";
    // .stage-select-card / data-stage-id는 화면 밖(테스트·스크립트)에서 쓰는 이름이라 유지한다.
    tile.className = "stage-select-card protocol-app";
    tile.dataset.stageId = stage.id;
    if (this.restored.has(stage.id)) tile.dataset.restored = "true";

    /*
     * 이 기록의 ARCHIVE 복구 등급 — 이번 판이 아니라 지금까지 남은 기록이다.
     * 엔진이 아직 없으면 전부 DAMAGED로 그린다(엔진이 뜨면 setStages가 다시 그린다).
     */
    const status = window.archiveProgress?.status(stage.id) ?? RECORD_DAMAGED;
    const full = status === RECORD_FULL;
    tile.dataset.recovery = full ? "full" : status === RECORD_PARTIAL ? "partial" : "damaged";

    const icon = document.createElement("span");
    icon.className = "protocol-app-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ProtocolSelectFlow.glyph(stage.id);

    const code = document.createElement("span");
    code.className = "protocol-app-code";
    // ◆ 완전 복구 / ◇ 그 외 — 복구 등급을 글자 하나로 붙인다.
    code.textContent = `PROTO_${stage.number} · ${full ? "◆" : "◇"}`;

    const title = document.createElement("strong");
    title.className = "protocol-app-title";
    title.textContent = stage.title;

    const mark = document.createElement("span");
    mark.className = "protocol-app-mark";
    mark.textContent = this.strings.protocol.restored;

    tile.append(icon, code, title, mark);
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
