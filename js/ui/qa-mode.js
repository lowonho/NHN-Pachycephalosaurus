/*
 * 기능(B) — QA 모드. 검수용 뒷문이다.
 *
 * 여는 법: 메인 화면 왼쪽 위 "2026 ARCHIVE"를 QA_UNLOCK_WINDOW_MS 안에 10번 누른다.
 * (켜져 있는 동안은 Shift+Q로도 패널을 여닫는다.)
 *
 * 하는 일은 세 가지다.
 *   1) 10개 미니게임 중 아무거나 바로 연다 — 막별 선정 순서와 브리핑을 건너뛴다.
 *   2) 한 판의 제한시간을 20.26초 대신 다른 값으로 준다.
 *   3) 오프닝부터 엔딩까지 스토리 컷신을 진행 상태와 무관하게 바로 재생한다.
 *
 * 1)은 엔진이 "현재 막에 뽑힌 6개"만 열어 주기 때문에(js/game.js의 start) 그냥
 * 시작시킬 수 없다. 그래서 이번 판의 선택 목록을 10개 전부로 갈아 끼운다
 * (run-state.mjs의 setSelection). QA를 끄면 저장해 둔 이야기 진행으로 되돌린다.
 *
 * 2)의 값은 js/config/qa.js의 전역 하나에 둔다 — 엔진(클래식 번들)과 UI가 같은 값을 봐야 한다.
 *
 * 이 파일은 다른 화면 흐름보다 뒤에 로드된다. 결과·일시정지에서 "스테이지 선택 /
 * 메인으로"를 누르면 원래 흐름이 먼저 프로토콜 선택을 열고, 그 뒤에 여기가 그것을
 * 도로 접고 QA 패널을 세운다. 순서가 바뀌면 QA 패널 밑에서 모니터가 켜진 채로 남는다.
 */

/* 10번을 "빠르게" 누르는 기준. 한 번 누른 뒤 이만큼 조용하면 세던 것을 버린다. */
const QA_UNLOCK_TAPS = 10;
const QA_UNLOCK_WINDOW_MS = 800;

/* 눌리고 있다는 힌트를 슬쩍 주기 시작하는 지점(그 전에는 티가 나지 않는다). */
const QA_UNLOCK_HINT_FROM = 5;

const QA_STORY_LABELS = Object.freeze({
  opening: "오프닝 · 아카이브 진입",
  assist: "CS-H1 · 보조 절차",
  betrayal: "CS-01 · 복구 기록 회수",
  source: "CS-02 · 삭제 주체",
  experiment: "CS-03 · 기억 소거 실험",
  ending: "CS-06 · ARIA-26 폐기",
});

const QA_SCENE_LABELS = Object.freeze({
  "op-01": "OP-01 반복되는 피드",
  "op-02": "OP-02 일괄 삭제",
  "op-03": "OP-03 삭제된 장면 재현",
  "op-05": "OP-05 완전기억 소지자",
  "op-09": "OP-09 아카이브 진입",
  assist: "CS-H1 보조 절차 활성화",
  betrayal: "CS-01 복구 기록 강제 회수",
  source: "CS-02 삭제 실행 주체 확인",
  experiment: "CS-03 성공한 기억 소거 실험",
  "ending-a": "CS-06A 최종 증거 전송",
  "ending-b": "CS-06B 개발자 검증",
  "ending-c": "CS-06C ARIA-26 폐기",
  "ending-a-break": "CS-06A 최종 증거 전송",
  "ending-d": "CS-06D 복구 기록 귀환",
});

const QA_CUE_KIND_LABELS = Object.freeze({
  dialogue: "대사",
  narration: "장면 설명",
  system: "화면 문구",
  silent: "무대사/정적",
});

class QaModeFlow {
  constructor(events, dom, soundBus, protocolSelect, cutscene, catalog) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.protocolSelect = protocolSelect;
    this.cutscene = cutscene;

    /* 엔진이 뜨면 game.js가 더 자세한 목록으로 갈아 끼운다(setStages). */
    this.catalog = catalog;
    this.active = false;
    this.taps = 0;
    this.lastTapAt = 0;
    this.playBrief = false;
    this.hintDefault = "";

    this.bindUnlock();
    this.bindPanel();
    this.bindReturns();

    this.renderTiles();
    this.applyTimeLimit(ARCHIVE_QA.timeLimit, { silent: true });
  }

  /* ── 자물쇠 ──────────────────────────────────────────────────────── */

  bindUnlock() {
    this.ui.qaUnlock?.addEventListener("pointerdown", () => this.tap());

    window.addEventListener("keydown", (event) => {
      if (!this.active || !event.shiftKey || event.code !== "KeyQ" || event.repeat) return;
      event.preventDefault();
      if (this.isOpen()) this.close();
      else this.open();
    });
  }

  tap() {
    const now = performance.now();
    this.taps = now - this.lastTapAt > QA_UNLOCK_WINDOW_MS ? 1 : this.taps + 1;
    this.lastTapAt = now;

    if (this.taps >= QA_UNLOCK_TAPS) {
      this.taps = 0;
      this.showUnlockProgress(0);
      this.activate();
      return;
    }
    this.showUnlockProgress(this.taps);
  }

  /*
   * 5번째부터 글자가 조금씩 밝아진다 — 우연히 누른 사람에게는 보이지 않고,
   * 일부러 세는 사람에게는 되고 있다는 것이 보인다.
   */
  showUnlockProgress(taps) {
    if (!this.ui.qaUnlock) return;
    const shown = taps >= QA_UNLOCK_HINT_FROM ? taps - QA_UNLOCK_HINT_FROM + 1 : 0;
    this.ui.qaUnlock.dataset.qaProgress = String(shown);
    window.clearTimeout(this.hintHandle);
    if (shown > 0) {
      this.hintHandle = window.setTimeout(() => {
        this.ui.qaUnlock.dataset.qaProgress = "0";
      }, QA_UNLOCK_WINDOW_MS);
    }
  }

  /* ── 켜고 끄기 ───────────────────────────────────────────────────── */

  activate() {
    this.active = true;
    ARCHIVE_QA.active = true;
    this.soundBus.resume();
    window.archiveAudio?.play("success");

    /*
     * QA 선택을 10개 전부로 갈아 끼운다. 이게 없으면 엔진이 현재 막의 6개만 열어 준다.
     * (엔진이 아직 없으면 setStages가 도착한 뒤 다시 부른다.)
     */
    this.selectAllStages();
    this.syncRunBudget();
    this.ui.qaBadge?.classList.remove("hidden");
    this.open();
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    ARCHIVE_QA.active = false;
    this.ui.qaBadge?.classList.add("hidden");
    this.close();
    window.archiveRun?.exitQa?.();
    /* 예산도 20.26초로 되돌린다 — 다음 판의 책상 시계는 다시 원래 숫자여야 한다. */
    this.syncRunBudget();
  }

  isOpen() {
    return this.ui.qaPanel ? !this.ui.qaPanel.classList.contains("hidden") : false;
  }

  open() {
    if (!this.active) return;
    this.renderTiles();
    this.ui.qaPanel?.classList.remove("hidden");
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.qaPanel?.querySelector(".qa-story-button, .qa-stage")?.focus();
  }

  close() {
    this.ui.qaPanel?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
  }

  /* ── 패널 조작 ───────────────────────────────────────────────────── */

  bindPanel() {
    this.ui.qaCloseButton?.addEventListener("click", () => this.close());
    this.ui.qaBadge?.addEventListener("click", () => this.open());
    this.ui.qaExitButton?.addEventListener("click", () => {
      this.deactivate();
      /* QA 상태를 접고 메인 화면의 저장된 이야기 진행으로 돌아간다. */
      this.events.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {});
    });

    this.ui.qaTimeSlider?.addEventListener("input", (event) => {
      this.applyTimeLimit(Number(event.target.value));
    });
    this.ui.qaTimeNumber?.addEventListener("change", (event) => {
      this.applyTimeLimit(Number(event.target.value));
    });
    this.ui.qaTimePresets?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-seconds]");
      if (button) this.applyTimeLimit(Number(button.dataset.seconds));
    });

    this.ui.qaBriefToggle?.addEventListener("change", (event) => {
      this.playBrief = event.target.checked;
    });
  }

  /*
   * 제한시간 하나를 세 입력(숫자 칸 · 슬라이더 · 프리셋)이 나눠 만진다.
   * 값을 보내온 쪽도 다시 그린다 — 범위 밖 숫자를 직접 적었을 때 잘린 값이 보여야 한다.
   */
  applyTimeLimit(seconds, { silent = false } = {}) {
    const raw = Number.isFinite(seconds) ? seconds : ARCHIVE_QA.DEFAULT_TIME_LIMIT;
    const clamped = Math.min(
      ARCHIVE_QA.MAX_TIME_LIMIT,
      Math.max(ARCHIVE_QA.MIN_TIME_LIMIT, Math.round(raw * 100) / 100),
    );

    ARCHIVE_QA.timeLimit = clamped;
    const text = String(clamped);
    if (this.ui.qaTimeNumber && this.ui.qaTimeNumber.value !== text) this.ui.qaTimeNumber.value = text;
    if (this.ui.qaTimeSlider && this.ui.qaTimeSlider.value !== text) this.ui.qaTimeSlider.value = text;
    this.ui.qaTimePresets?.querySelectorAll("button[data-seconds]").forEach((button) => {
      button.dataset.selected = String(Number(button.dataset.seconds) === clamped);
    });
    if (this.ui.qaBadgeTime) this.ui.qaBadgeTime.textContent = `${clamped}초`;

    this.syncRunBudget();
    if (!silent) this.soundBus.resume();
  }

  /* 책상 시계(한 시도의 예산)를 지금 제한시간에 맞춘다. */
  syncRunBudget() {
    const seconds = globalThis.archiveStageTimeLimit?.() ?? ARCHIVE_QA.DEFAULT_TIME_LIMIT;
    const snapshot = window.archiveRun?.setAttemptTime(Math.round(seconds * 1000));
    if (snapshot) this.events.emit(GAME_EVENTS.TOTAL_TIMER_TICK, snapshot);
  }

  selectAllStages() {
    const ids = this.catalog.map((stage) => stage.id);
    const snapshot = window.archiveRun?.setSelection(ids);
    if (snapshot) this.events.emit(GAME_EVENTS.TOTAL_TIMER_TICK, snapshot);
  }

  /* QA 컷신의 각 줄에 장면·장면 내 순번·전체 큐 순번을 붙인다. 원본 대본은 변경하지 않는다. */
  buildStoryPreviewScript(script) {
    const source = Array.isArray(script) ? script : [];
    const kindOf = (cue) => cue.kind ?? (cue.speaker === "SYSTEM" ? "system" : "dialogue");
    const countKey = (cue) => `${cue.phase ?? "scene"}\u0000${kindOf(cue)}`;
    const totals = new Map();
    const current = new Map();

    source.forEach((cue) => {
      const key = countKey(cue);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    });

    return source.map((cue, index) => {
      const kind = kindOf(cue);
      const key = countKey(cue);
      const ordinal = (current.get(key) ?? 0) + 1;
      current.set(key, ordinal);
      const scene = QA_SCENE_LABELS[cue.phase] ?? String(cue.phase ?? "SCENE").toUpperCase();
      const cueType = QA_CUE_KIND_LABELS[kind] ?? kind;
      return {
        ...cue,
        chapterLabel: `QA // ${scene} · ${cueType} ${ordinal}/${totals.get(key)} · 큐 ${index + 1}/${source.length}`,
      };
    });
  }

  /* 진행 기록·본편의 시청 완료 상태를 건드리지 않는 독립 컷신 미리보기. */
  playStory(storyId) {
    const story = SCENARIO_DATA.cutscenes[storyId];
    if (!this.active || !story) return;
    this.soundBus.resume();
    this.protocolSelect.close();
    this.close();
    this.ui.mainMenu?.setAttribute("inert", "");
    this.cutscene.play({
      chapter: `QA PREVIEW // ${story.chapter}`,
      script: this.buildStoryPreviewScript(story.script),
      auto: story.auto,
      forceDisplay: true,
      onDone: () => {
        if (this.active) this.open();
      },
    });
  }

  /* ── 바로 진입 ───────────────────────────────────────────────────── */

  launch(stageId) {
    if (!window.archiveGame) {
      this.showHint("엔진이 아직 준비되지 않았습니다. 잠시 뒤 다시 시도하세요.");
      return;
    }
    this.soundBus.resume();
    this.selectAllStages();
    this.syncRunBudget();
    this.close();

    /*
     * 브리핑은 모니터 스크린 안에서 열린다(js/ui/protocol-select-flow.js).
     * 그래서 QA에서도 모니터부터 세우고, Esc는 QA 판으로 되돌린다 —
     * 이야기 흐름에서 Esc는 일시정지지만, QA는 돌아갈 판이 따로 있다.
     */
    if (this.playBrief) {
      this.ui.stageSelectScreen?.classList.remove("hidden");
      this.protocolSelect.openBrief(stageId, {
        onStart: () => this.startNow(stageId),
        onBack: () => {
          this.protocolSelect.close();
          this.open();
        },
      });
      return;
    }
    this.startNow(stageId);
  }

  /*
   * 프로토콜 선택 화면을 거치지 않고 모니터만 세워 플레이로 바꾼다.
   * (플레이 화면은 모니터 스크린 안이라 모니터를 감춘 채로는 시작할 수 없다.)
   */
  startNow(stageId) {
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.protocolSelect.showScreen("play");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }

  /* ── 돌아올 곳 ───────────────────────────────────────────────────── */

  bindReturns() {
    /*
     * 결과의 "스테이지 선택"과 일시정지·결과의 "메인으로".
     * 원래 흐름이 이미 프로토콜 선택이나 메인 화면을 열어 둔 뒤라 그 위를 덮는다.
     */
    this.events.on(GAME_EVENTS.REQUEST_STAGE_SELECT, () => {
      if (!this.active) return;
      this.protocolSelect.close();
      this.open();
    });
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.deactivate());

    /* 결과 화면 버튼 이름도 실제로 돌아갈 곳으로 바꾼다(modal-flow가 먼저 그린 뒤다). */
    const relabel = () => {
      if (this.active && this.ui.primaryButton) this.ui.primaryButton.textContent = "QA 패널로";
    };
    this.events.on(GAME_EVENTS.STAGE_CLEAR, relabel);
    this.events.on(GAME_EVENTS.STAGE_FAIL, relabel);
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */

  /* 엔진이 준비되면 game.js가 넘겨 준다 — 카탈로그와 같은 10개다. */
  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    if (this.active) this.selectAllStages();
    this.renderTiles();
  }

  renderTiles() {
    this.renderStoryTiles();
    const grid = this.ui.qaStageGrid;
    if (!grid) return;
    grid.replaceChildren();

    this.catalog.forEach((stage) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "qa-stage";
      tile.dataset.stageId = stage.id;

      const code = document.createElement("span");
      code.className = "qa-stage-code";
      code.textContent = stage.id.toUpperCase();

      const icon = document.createElement("span");
      icon.className = "qa-stage-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = stage.recordSymbol;

      const title = document.createElement("strong");
      title.className = "qa-stage-title";
      title.textContent = stage.title;

      const controls = document.createElement("small");
      controls.className = "qa-stage-controls";
      controls.textContent = stage.controls;

      tile.append(code, icon, title, controls);
      tile.title = `${stage.objective}\n${stage.anomaly}`;
      tile.addEventListener("click", () => this.launch(stage.id));
      grid.append(tile);
    });
  }

  renderStoryTiles() {
    const grid = this.ui.qaStoryGrid;
    if (!grid) return;
    grid.replaceChildren();

    Object.entries(SCENARIO_DATA.cutscenes).forEach(([storyId, story], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "qa-story-button";
      button.dataset.storyId = storyId;

      const code = document.createElement("span");
      code.className = "qa-story-code";
      code.textContent = String(index + 1).padStart(2, "0");

      const title = document.createElement("strong");
      title.className = "qa-story-title";
      title.textContent = QA_STORY_LABELS[storyId] ?? story.chapter;

      button.append(code, title);
      const dialogueCount = story.script.filter((cue) => (cue.kind ?? "dialogue") === "dialogue").length;
      const systemCount = story.script.filter((cue) => cue.kind === "system").length;
      const sceneCount = new Set(story.script.map((cue) => cue.phase)).size;
      button.title = `${story.chapter}\n장면 ${sceneCount} · 대사 ${dialogueCount} · 화면 문구 ${systemCount}`;
      button.addEventListener("click", () => this.playStory(storyId));
      grid.append(button);
    });
  }

  /* 안내 줄을 잠깐 경고로 바꾼다(프로토콜 선택의 warnEngineMissing과 같은 방식). */
  showHint(message) {
    const hint = this.ui.qaHint;
    if (!hint) return;
    if (!this.hintDefault) this.hintDefault = hint.innerHTML;
    hint.dataset.state = "warn";
    hint.textContent = message;
    window.clearTimeout(this.messageHandle);
    this.messageHandle = window.setTimeout(() => {
      delete hint.dataset.state;
      hint.innerHTML = this.hintDefault;
    }, 2800);
  }
}

const qaModeFlow = new QaModeFlow(
  gameEvents,
  UI,
  audioBus,
  protocolSelectFlow,
  cutsceneFlow,
  PROTOCOLS,
);
