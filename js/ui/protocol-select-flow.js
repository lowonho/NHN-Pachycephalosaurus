/*
 * 기능(B) — 프로토콜 선택 화면(옛 스테이지 선택).
 *
 * 1인칭 모니터 화면 안에 복구할 기록 5개를 데스크톱 앱처럼 펼친다.
 * 타일을 누르면 그 프로토콜이 바로 시작된다(REQUEST_START).
 *
 * ── 2:26 ────────────────────────────────────────────────────────────
 * 스테이지마다 도는 20.26초와 별개로, 이 화면은 판 전체의 제한시간 하나를 들고 있다.
 * 다섯 스테이지의 재도전을 포함한 146초(2:26)가 한 판의 예산이고,
 * 이 안에 프로토콜 5개를 전부 복구하지 못하면 복구 실패다.
 *
 * 예산은 벽시계 기준으로 계속 줄어든다. 화면을 처음 열 때 돌기 시작해서
 * 스테이지를 플레이하는 동안에도 계속 줄고, 일시정지 중에만 멈춘다.
 * 메인 화면으로 나가면(reset) 판이 끝나고 예산과 복구 기록이 처음으로 돌아간다.
 */

const RECOVERY_BUDGET_MS = 146_000; // 2:26 — 재도전을 포함한 전체 예산
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
  constructor(events, dom, soundBus, strings) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.strings = strings;

    /*
     * 엔진을 기다리지 않는다 — js/config/protocols.js의 목록으로 바로 그린다.
     * 엔진이 뜨면 setStages가 더 자세한 목록으로 갈아 끼운다.
     */
    this.stages = PROTOCOLS;
    this.restored = new Set();
    this.remainingMs = RECOVERY_BUDGET_MS;
    this.tickHandle = 0;
    this.lastTickAt = 0;
    this.timedOut = false;
    this.warnHandle = 0;

    this.ui.recoveryFailedButton?.addEventListener("click", () => this.closeFailure());

    // 예산은 벽시계로 줄지만 일시정지 중에는 멈춘다.
    this.events.on(GAME_EVENTS.STAGE_PAUSE, () => this.pauseTimer());
    this.events.on(GAME_EVENTS.STAGE_RESUME, () => this.startTimer());
    this.events.on(GAME_EVENTS.STAGE_CLEAR, ({ stageId } = {}) => this.markRestored(stageId));

    this.render();
  }

  /* ── 화면 여닫기 ─────────────────────────────────────────────────── */

  open() {
    this.soundBus.resume();
    this.render();
    // 뒤 화면(메인·플레이)은 보이더라도 만질 수 없어야 한다.
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.appShell?.setAttribute("inert", "");
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.startTimer();

    const firstTile = this.ui.stageSelectGrid?.querySelector("button:not(:disabled)");
    (firstTile ?? this.ui.stageSelectBackButton)?.focus();
  }

  close() {
    this.ui.stageSelectScreen?.classList.add("hidden");
  }

  /* 한 판을 접는다 — 메인 화면으로 나갈 때 부른다. */
  reset() {
    this.pauseTimer();
    this.remainingMs = RECOVERY_BUDGET_MS;
    this.timedOut = false;
    this.restored.clear();
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

    this.soundBus.resume();
    this.close();
    this.ui.appShell?.removeAttribute("inert");
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

  /* ── 2:26 예산 ───────────────────────────────────────────────────── */

  startTimer() {
    if (this.tickHandle || this.timedOut) return;
    if (this.remainingMs <= 0) return;
    if (this.isComplete()) return;
    this.lastTickAt = performance.now();
    // 1초가 아니라 100ms — 남은 초가 바뀌는 순간을 눈에 띄게 늦추지 않는다.
    this.tickHandle = window.setInterval(() => this.tick(), 100);
  }

  pauseTimer() {
    if (!this.tickHandle) return;
    this.drain();
    window.clearInterval(this.tickHandle);
    this.tickHandle = 0;
  }

  /* 지난 시간만큼 예산을 깎는다. setInterval 간격이 밀려도 벽시계와 어긋나지 않는다. */
  drain() {
    const now = performance.now();
    this.remainingMs = Math.max(0, this.remainingMs - (now - this.lastTickAt));
    this.lastTickAt = now;
  }

  tick() {
    this.drain();
    this.renderTimer();
    if (this.remainingMs <= 0) this.onTimeout();
  }

  isComplete() {
    return this.stages.length > 0 && this.restored.size >= this.stages.length;
  }

  markRestored(stageId) {
    if (!stageId || this.timedOut) return;
    this.restored.add(stageId);
    if (this.isComplete()) this.pauseTimer();
    this.render();
  }

  /*
   * 시간 초과 — 이 판은 실패다.
   * 플레이 중이었다면 REQUEST_MAIN_MENU가 스테이지·HUD·결과 모달을 정리하고
   * 메인 화면을 다시 세운다. 실패 안내는 그 위에 따로 덮는다.
   */
  onTimeout() {
    this.pauseTimer();
    this.timedOut = true;
    this.remainingMs = 0;
    this.close();

    /*
     * 이 신호가 스테이지·HUD·결과 모달을 정리하고 메인 화면을 다시 세운다.
     * 그 과정에서 reset()이 불려 다음 판 예산(2:26)이 채워지므로,
     * 실패 안내는 그 뒤에 별도 레이어로 덮는다(화면 상태에 기대지 않는다).
     */
    this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});

    // 뒤에 남은 메인 화면은 안내를 닫기 전까지 만질 수 없다(결과 모달과 같은 방식).
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.recoveryFailed?.classList.remove("hidden");
    this.ui.recoveryFailedButton?.focus();
  }

  closeFailure() {
    this.ui.recoveryFailed?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainPlayButton?.focus();
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */

  render() {
    this.renderTiles();
    this.renderTimer();
    this.renderProgress();
    this.renderArchive();
  }

  renderTimer() {
    const timer = this.ui.protocolTimer;
    if (!timer) return;

    timer.textContent = ProtocolSelectFlow.formatClock(this.remainingMs);
    if (this.isComplete()) timer.dataset.state = "done";
    else if (this.remainingMs <= RECOVERY_URGENT_MS) timer.dataset.state = "urgent";
    else timer.dataset.state = "idle";
  }

  renderProgress() {
    const label = this.ui.protocolProgress;
    if (!label) return;
    window.clearTimeout(this.warnHandle);
    delete label.dataset.state;
    label.textContent = this.strings.protocol.progress(this.restored.size, this.stages.length || 7);
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

  /* 146000 → "2:26". 올림이라 시작은 2:26, 0:00은 예산이 실제로 바닥났을 때만 나온다. */
  static formatClock(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
}

const protocolSelectFlow = new ProtocolSelectFlow(gameEvents, UI, audioBus, STRINGS);
