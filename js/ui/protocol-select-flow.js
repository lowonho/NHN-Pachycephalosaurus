/*
 * 기능(B) — 프로토콜 브리핑 화면(옛 스테이지 선택).
 *
 * 화면이 열리면(open) 이번 차례의 기억을 곧바로 브리핑한다. 고를 것이 없어
 * 앞에 목록을 두지 않는다 — 이야기는 정해진 순서대로 흐르고, 예전 선택 화면도
 * 이번 차례 타일 하나만 누를 수 있었다. "증언 시작"을 누르면 그 프로토콜이
 * 시작된다(REQUEST_START).
 *
 * 각 게임은 독립된 20.26초 타이머를 사용한다. 남은 시간은 게임 화면 안에서만
 * 보여 준다 — 이 화면은 시간을 그리지 않는다(책상 위 탁상시계는 걷어냈다).
 * 메인 화면으로 나가면(reset) 랜덤 6개와 이번 판의 클리어 현황만 초기화하며
 * 최고 기록은 유지한다.
 */

/* 브리핑 하단 바의 안내 문구. 엔진 경고가 잠깐 덮었다가 이 문장으로 되돌아온다. */
const BRIEF_NOTE = "Enter · Space로 시작 / Esc로 일시정지";

/* 전원 연출 길이(ms). css/protocol-select.css의 .protocol-power 애니메이션과 같은 값이다. */
const POWER_ON_MS = 980;

class ProtocolSelectFlow {
  constructor(events, dom, soundBus, strings, cutscene) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.strings = strings;
    this.cutscene = cutscene;

    /*
     * 브리핑에서 "시작"과 "돌아가기"가 할 일. 브리핑을 접을 때 함께 비운다.
     * 돌아갈 곳은 QA 모드에만 있다(js/ui/qa-mode.js) — 이야기 흐름에는 null이다.
     */
    this.briefStart = null;
    this.briefBack = null;

    /*
     * 불을 넣어 둔 막("막 번호:시도 횟수"). 같은 막을 다시 열 때는 켜지 않는다.
     * powerHandle은 연출을 되돌려 끄는 타이머다.
     */
    this.poweredAct = "";
    this.powerHandle = 0;

    /*
     * 엔진을 기다리지 않는다 — js/config/protocols.js의 목록으로 바로 그린다.
     * 엔진이 뜨면 setStages가 더 자세한 목록으로 갈아 끼운다.
     */
    this.catalog = PROTOCOLS;
    this.stages = [];
    this.warnHandle = 0;

    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.render());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.render());
    this.events.on(GAME_EVENTS.TOTAL_TIMER_TICK, () => this.syncRun());
    this.events.on(GAME_EVENTS.RUN_RESET, () => this.syncRun());
    this.events.on(GAME_EVENTS.REQUEST_CONTINUE, () => this.continueStory());

    this.ui.protocolBriefStartButton?.addEventListener("click", () => this.confirmBrief());
    window.addEventListener("keydown", (event) => this.onBriefKeyDown(event));

    this.render();
  }

  /* ── 화면 여닫기 ─────────────────────────────────────────────────── */

  /*
   * 모니터를 세우고 이번 차례의 브리핑을 편다.
   * 오프닝 뒤, 한 기록을 끝낸 뒤, 이어하기에서 모두 이 하나로 들어온다.
   */
  open() {
    this.soundBus.resume();
    this.refreshStages();
    this.render();
    // 뒤 화면(메인)은 보이더라도 만질 수 없어야 한다.
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.stageSelectScreen?.classList.remove("hidden");

    const snapshot = window.archiveRun?.snapshot();
    // 새 막이면 여기서 모니터에 불이 들어온다(같은 막 안 기록 이동에는 켜지 않는다).
    this.powerOnForAct(snapshot);

    const stageId = snapshot?.expectedStageId;
    if (stageId) this.openBrief(stageId);
    else this.showScreen("brief");
  }

  /* 모니터를 통째로 내린다 — 메인 화면으로 나갈 때만 부른다. */
  close() {
    // 브리핑을 열어 둔 채로 나갔다면 예약된 "시작"도 함께 버린다.
    this.briefStart = null;
    this.briefBack = null;
    // 화면을 내렸으니 전원도 내려간다 — 다시 들어오면 같은 막이라도 불이 들어온다.
    this.stopPowerOn();
    this.poweredAct = "";
    this.showScreen("brief");
    this.ui.stageSelectScreen?.classList.add("hidden");
  }

  /* ── 전원 연출 ───────────────────────────────────────────────────── */

  /*
   * 막이 바뀌었을 때만 모니터에 불을 넣는다. 한 막 안에서 기록을 넘길 때는
   * 화면이 계속 켜져 있던 셈이므로 조용히 지나간다.
   * 막을 다시 짤 때(act-restarted)도 새 접속이라 한 번 더 켠다 — 그래서
   * 막 번호만이 아니라 시도 횟수까지 열쇠에 넣는다.
   */
  powerOnForAct(snapshot) {
    const act = snapshot?.currentAct ?? 1;
    const key = `${act}:${snapshot?.actAttemptCount?.[act - 1] ?? 1}`;
    if (key === this.poweredAct) return;
    this.poweredAct = key;
    this.playPowerOn();
  }

  /*
   * 검은 화면 → 십자 광선 → 가로선이 위아래로 열린다. 그림은 CSS가 그리고
   * (css/protocol-select.css의 .protocol-power) 여기서는 여닫기만 한다.
   * 연출은 브리핑 위에 얹힐 뿐이라 도는 동안에도 시작 버튼은 그대로 눌린다.
   */
  playPowerOn() {
    const power = this.ui.protocolPower;
    if (!power) return;
    // 모션을 줄여 달라고 했으면 번쩍임 없이 그냥 켜진 화면으로 시작한다.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    window.clearTimeout(this.powerHandle);
    /*
     * 돌던 중에 다시 부르면 애니메이션이 이어지지 않고 그대로 멈춰 있다.
     * 한 번 껐다 켜서(레이아웃을 한 번 읽어 강제로 반영) 처음부터 돌린다.
     */
    power.hidden = true;
    void power.offsetWidth;
    power.hidden = false;
    this.powerHandle = window.setTimeout(() => this.stopPowerOn(), POWER_ON_MS);
  }

  stopPowerOn() {
    window.clearTimeout(this.powerHandle);
    this.powerHandle = 0;
    if (this.ui.protocolPower) this.ui.protocolPower.hidden = true;
  }

  /*
   * 모니터 스크린 안에서 브리핑과 플레이가 자리를 바꾼다.
   * 모니터·방·책상은 두 상태에서 그대로 서 있다 — 스크린 안쪽만 갈린다.
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
     * 모니터 밖의 PAUSE는 브리핑에서만 선다. 플레이 중에는 스크린 안 HUD의
     * 일시정지 버튼(#pause-button)이 같은 일을 맡는다 — 둘을 함께 띄우지 않는다.
     */
    if (this.ui.protocolPauseButton) this.ui.protocolPauseButton.hidden = playing;

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
    this.syncRun();
    this.events.emit(GAME_EVENTS.RUN_RESET, snapshot);
    return snapshot;
  }

  refreshStages() {
    const selected = window.archiveRun?.snapshot().selectedStageIds ?? [];
    this.stages = selected.map((id) => this.catalog.find((stage) => stage.id === id)).filter(Boolean);
  }

  /*
   * 엔진이 보고해 온 목록으로 갈아 끼운다.
   * 빈 목록은 무시한다 — 이미 그려 둔 브리핑을 지우고 화면을 비우는 쪽이 더 나쁘다.
   */
  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    this.refreshStages();
    this.render();
  }

  /*
   * 기억 하나의 브리핑을 연다 — 이번 차례가 아닌 기록은 QA 모드에서만 열린다.
   * (open()이 이미 이 일을 하므로 이야기 흐름에서는 쓰이지 않는다. 검수·테스트 입구다.)
   */
  startStage(stageId) {
    const run = window.archiveRun?.snapshot();
    if (!run?.qaMode && stageId !== run?.expectedStageId) return;
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
   * onStart·onBack을 주면 그것을 따른다. 이야기 흐름에는 돌아갈 곳이 없어(고를
   * 목록이 없다) onBack이 없고, QA 모드만 Esc로 QA 판에 돌아간다.
   */
  openBrief(stageId, { onStart, onBack } = {}) {
    // 이번 차례가 아닌 기억도 열 수 있다 — QA 모드는 10개 전부를 바로 연다.
    const stage = this.stages.find((item) => item.id === stageId)
      ?? this.catalog.find((item) => item.id === stageId);
    if (!stage) return;

    this.briefStart = typeof onStart === "function" ? onStart : () => this.launchStage(stage.id);
    this.briefBack = typeof onBack === "function" ? onBack : null;

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

  /* 돌아가기 — QA 판으로만 되돌아간다. 무엇도 시작하지 않는다. */
  cancelBrief() {
    const back = this.briefBack;
    this.briefStart = null;
    this.briefBack = null;
    back?.();
  }

  isBriefOpen() {
    return this.ui.protocolScreen?.dataset.mode === "brief"
      && this.ui.stageSelectScreen?.classList.contains("hidden") === false;
  }

  /*
   * 브리핑에서는 Enter·Space로 시작하고 Esc로 일시정지한다 —
   * 플레이 중과 같은 창(js/ui/pause-flow.js)이 뜬다. 돌아갈 목록이 없어졌으므로
   * Esc가 화면을 물릴 곳도 없다. QA 모드만 예외로 QA 판으로 되돌아간다.
   *
   * 버튼에 포커스가 있으면 그 버튼이 알아서 처리하므로 여기서는 비켜선다.
   */
  onBriefKeyDown(event) {
    if (!this.isBriefOpen()) return;
    // 위에 덮인 창(일시정지·설정)이 있으면 키는 그쪽 것이다.
    if (pauseFlow.paused || pauseFlow.menuPaused || settingsFlow.isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      if (this.briefBack) this.cancelBrief();
      else pauseFlow.pauseMenu();
      return;
    }

    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.closest(".protocol-brief-button")) return;
    event.preventDefault();
    this.confirmBrief();
  }

  /* 브리핑 내용 — 이번 기록의 목표·조작·이상현상·최고 기록을 화면에 펼친다. */
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
    /*
     * 엔진이 아직 없으면 이 화면을 떠나지 않는다.
     * 나가 버리면 빈 캔버스만 남고 일시정지 버튼도 없어서 돌아올 길이 사라진다.
     * (엔진이 늦게 뜨는 중이거나, index.html을 file://로 열어 모듈이 막힌 경우다.)
     */
    if (!window.archiveGame) {
      this.warnEngineMissing();
      return;
    }

    this.showScreen("play");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }

  continueStory() {
    if (globalThis.ARCHIVE_QA?.active) return;
    const before = window.archiveRun?.snapshot();
    const advanced = window.archiveRun?.advance();
    if (!before || !advanced) return;
    this.syncRun();
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

  /* 하단 바 안내 문구를 잠깐 경고로 바꾼다. 잠시 뒤 원래 문구로 되돌아온다. */
  warnEngineMissing() {
    const note = this.ui.protocolBriefNote;
    if (!note) return;
    note.dataset.state = "warn";
    note.textContent = this.strings.protocol.engineMissing;
    window.clearTimeout(this.warnHandle);
    this.warnHandle = window.setTimeout(() => this.restoreNote(), 2800);
  }

  restoreNote() {
    const note = this.ui.protocolBriefNote;
    if (!note) return;
    delete note.dataset.state;
    note.textContent = BRIEF_NOTE;
  }

  syncRun() {
    this.refreshStages();
    this.render();
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */

  render() {
    this.renderProgress();
    this.renderArchive();
  }

  /*
   * 브리핑 하단 바 왼쪽 — 남은 목숨 하나뿐이다.
   *
   * 막·스테이지·기록 수는 여기 두지 않는다. 브리핑에서 정할 것은 "시작할지"
   * 하나뿐이고, 그 판단에 필요한 것은 실패했을 때 무엇을 잃느냐다. 나머지 진행도는
   * 플레이 HUD(#stage-hud)와 결과 화면이 이미 말한다.
   */
  renderProgress() {
    const label = this.ui.protocolBriefLives;
    const run = window.archiveRun?.snapshot();
    if (!label || !run) return;
    const lives = `${"◆".repeat(run.lives)}${"◇".repeat(Math.max(0, 3 - run.lives))}`;
    label.textContent = `LIVES ${lives}`;
  }

  /*
   * ARCHIVE 복구 현황 — 판을 넘어 남는 누적 기록이다(js/archive/progress.mjs).
   *
   * 이번 판에서 복구한 개수(reset()으로 0이 된다)와 달리 localStorage에 저장돼
   * 다음 판에도 남는다. 지금 이 숫자가 뜨는 곳은 메인 화면의 [data-archive-recovery]다.
   *
   * 기록은 엔진(js/archive/game.mjs)이 세우므로 엔진이 뜨기 전에는 없을 수 있다.
   * 그때는 마크업의 기본값을 그대로 두고 아무것도 건드리지 않는다 —
   * 0으로 덮어써도 같은 값이라 얻는 것이 없고, 엔진이 뜨면 setStages가 다시 부른다.
   */
  renderArchive() {
    const run = window.archiveRun?.snapshot();
    if (!run) return;

    this.ui.archiveRecoveryRates?.forEach((element) => {
      element.textContent = `TOTAL RECORDS ${run.totalRecordCount}/18`;
    });
  }

  /* 143000 → "02:23.00". 1/100초까지 스테이지 HUD와 같은 기준으로 표시한다. */
  static formatClock(milliseconds) {
    const safe = Math.max(0, Math.round(milliseconds));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor(safe / 1000) % 60;
    const hundredths = Math.floor((safe % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
  }
}

const protocolSelectFlow = new ProtocolSelectFlow(gameEvents, UI, audioBus, STRINGS, cutsceneFlow);
