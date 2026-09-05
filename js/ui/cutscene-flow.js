/*
 * 기능(B) — 컷신(대사 출력).
 * 화면 구성은 assets/images/concept/cutscene.png 기준이다.
 *
 * 화면 흐름에서의 자리:
 *   메인 화면 → [게임 시작] → 컷신 → 스테이지 선택 → (스테이지)
 * 컷신이 끝나거나 SKIP을 누르면 play()에 넘어온 onDone을 부른다.
 * 그 뒤에 무엇을 열지는 이 파일이 정하지 않는다(main-menu-flow가 스테이지 선택을 연다).
 *
 * 대본은 js/content/strings.ko.js의 STRINGS.cutscene.script다.
 * 줄을 늘리거나 문구를 고칠 때 이 파일은 건드리지 않는다.
 *
 * 조작
 *   새 장면에서 아무 키·클릭 — 배경 확인 후 첫 대사 표시
 *   화면 아무 데나 클릭 · Space · Enter — 타자 중이면 즉시 완성, 다 나왔으면 다음 줄
 *   AUTO — 한 줄이 다 나오면 잠시 뒤 자동으로 다음 줄
 *   LOG  — 지나간 대사 목록
 *   SKIP · Esc — 컷신을 통째로 건너뛴다
 */

class CutsceneFlow {
  /* 타자 효과 한 글자 간격(ms). */
  static TYPE_INTERVAL = 32;

  /* AUTO 대기 시간 — 고정분 + 글자당 가산분(ms). 긴 대사일수록 더 기다린다. */
  static AUTO_HOLD = 1100;
  static AUTO_HOLD_PER_CHAR = 55;

  constructor(dom, strings) {
    this.ui = dom;
    this.copy = strings.cutscene;

    this.script = [];
    this.index = -1;
    this.chapter = "";
    this.onDone = null;
    this.returnFocus = null;

    this.typeTimer = 0;
    this.autoTimer = 0;
    this.typed = 0;
    this.fullText = "";
    this.auto = false;
    this.currentSceneKey = "";
    this.pendingSceneCue = null;
    this.awaitingSceneInput = false;
    this.sceneTransitioning = false;
    this.sceneReadyTimer = 0;
    this.backgrounds = globalThis.SCENARIO_DATA?.backgrounds ?? {};
    this.backgroundCache = new Map();
    this.preloadBackgrounds();

    // 버튼은 자기 일만 한다. 여기서 막지 않으면 컨테이너의 "다음 줄"까지 같이 걸린다.
    const onButton = (button, handler) => {
      button?.addEventListener("click", (event) => {
        event.stopPropagation();
        handler();
      });
    };

    onButton(this.ui.cutsceneAutoButton, () => this.toggleAuto());
    onButton(this.ui.cutsceneLogButton, () => this.toggleLog());
    onButton(this.ui.cutsceneSkipButton, () => this.finish());

    // 로그가 열려 있는 동안에는 로그 안을 눌러도 대사가 넘어가지 않아야 한다.
    this.ui.cutsceneLog?.addEventListener("click", (event) => event.stopPropagation());

    this.ui.cutscene?.addEventListener("click", () => this.advance());

    window.addEventListener("keydown", (event) => this.onKeyDown(event));
  }

  /* 장면 전환 순간 검은 화면이 뜨지 않도록 등록된 배경을 미리 읽어 둔다. */
  preloadBackgrounds() {
    if (typeof Image !== "function") return;
    new Set(Object.values(this.backgrounds)).forEach((path) => {
      const image = new Image();
      image.decoding = "async";
      image.src = new URL(path, document.baseURI).href;
      this.backgroundCache.set(path, image);
    });
  }

  showBackground(phase) {
    const path = this.backgrounds[phase] ?? "";
    if (!this.ui.cutsceneBackdrop || !this.ui.cutscene) return;
    if (!path) {
      this.ui.cutsceneBackdrop.style.removeProperty("--cutscene-image");
      this.ui.cutscene.dataset.hasBackground = "false";
      return;
    }
    const href = new URL(path, document.baseURI).href;
    this.ui.cutsceneBackdrop.style.setProperty("--cutscene-image", `url("${href}")`);
    this.ui.cutscene.dataset.hasBackground = "true";
  }

  isOpen() {
    return Boolean(this.ui.cutscene) && !this.ui.cutscene.classList.contains("hidden");
  }

  onKeyDown(event) {
    if (!this.isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      // 로그가 열려 있으면 Esc는 로그만 닫는다. 컷신까지 한 번에 건너뛰지 않는다.
      if (this.isLogOpen()) this.toggleLog();
      else this.finish();
      return;
    }

    /* 장면이 완전히 밝아진 뒤에는 문자·방향키 등 어떤 키든 첫 대사를 연다. */
    if (this.awaitingSceneInput || this.sceneTransitioning) {
      if (event.repeat) return;
      event.preventDefault();
      if (!this.sceneTransitioning) this.revealSceneCue();
      return;
    }

    if (event.key !== " " && event.key !== "Enter") return;
    // 버튼에 포커스가 있으면 Space·Enter는 그 버튼이 처리한다(중복 실행 방지).
    if (document.activeElement?.closest(".cutscene-button")) return;
    event.preventDefault();
    this.advance();
  }

  /*
   * 컷신 재생. onDone은 끝까지 봤을 때도 SKIP으로 건너뛰었을 때도 한 번만 불린다.
   * (부르는 쪽은 "컷신 다음"만 알면 되고, 어떻게 끝났는지는 알 필요가 없다.)
   */
  play({ onDone, script, chapter, auto, forceDisplay = false } = {}) {
    this.script = Array.isArray(script) ? script : (Array.isArray(this.copy.script) ? this.copy.script : []);
    this.onDone = typeof onDone === "function" ? onDone : null;
    this.returnFocus = document.activeElement;
    this.index = -1;
    this.resetSceneHold();

    if (!forceDisplay && globalThis.ARCHIVE_STORY_SETTINGS?.skipCutscenes) {
      const done = this.onDone;
      this.onDone = null;
      done?.();
      return;
    }

    // 컷신이 실제로 드러나는 순간을 암전으로 감싼다 — 직전 화면이 무엇이었든 상관없다.
    sceneFade.cut(() => {
      this.setAuto(auto ?? Boolean(this.copy.auto));
      this.closeLog();
      this.renderLog();

      this.chapter = chapter || this.copy.chapter;
      if (this.ui.cutsceneChapter) this.ui.cutsceneChapter.textContent = this.chapter;
      this.ui.cutscene?.classList.remove("hidden");
      // 컷신 안에서 Space·Enter·Esc를 받아야 하므로 컨테이너로 포커스를 옮긴다.
      this.ui.cutscene?.focus();

      // 대본이 비어 있으면 빈 화면을 띄우지 않고 곧장 다음 단계로 넘긴다.
      if (this.script.length === 0) {
        this.finish();
        return;
      }

      this.next({ transitionCovered: true });
    }).then(() => this.armSceneInput());
  }

  /* 화면 클릭·Space·Enter — 타자 중이면 완성, 다 나왔으면 다음 줄. */
  advance() {
    if (!this.isOpen()) return;
    if (this.sceneTransitioning) return;
    if (this.awaitingSceneInput) {
      this.revealSceneCue();
      return;
    }
    // 로그가 열려 있으면 먼저 로그를 닫는다.
    if (this.isLogOpen()) {
      this.closeLog();
      return;
    }
    if (this.isTyping()) this.completeTyping();
    else this.next();
  }

  next({ transitionCovered = false } = {}) {
    if (this.awaitingSceneInput || this.sceneTransitioning) return;
    this.clearAuto();
    this.index += 1;

    if (this.index >= this.script.length) {
      this.finish();
      return;
    }

    const currentCue = this.script[this.index] || {};
    const {
      phase = "dialogue",
      backgroundPhase = phase,
    } = currentCue;
    const visualPhase = backgroundPhase || phase;
    const sceneKey = `${phase}\u0000${visualPhase}`;

    /*
     * 대본의 장면 또는 실제 배경이 바뀌면 새 장면만 먼저 보여 준다.
     * AUTO가 켜져 있어도 여기서는 멈추며, 반드시 플레이어 확인 입력을 기다린다.
     */
    if (sceneKey !== this.currentSceneKey) {
      this.currentSceneKey = sceneKey;
      this.pendingSceneCue = { cue: currentCue, visualPhase };
      this.awaitingSceneInput = true;
      this.sceneTransitioning = true;
      const showScene = () => this.showSceneOnly(currentCue, visualPhase);
      if (transitionCovered) showScene();
      else sceneFade.cut(showScene).then(() => this.armSceneInput());
      return;
    }

    this.renderCue(currentCue, visualPhase);
  }

  showSceneOnly(currentCue, visualPhase) {
    this.stopTyping();
    this.clearAuto();
    this.closeLog();
    this.showBackground(visualPhase);
    this.ui.cutscene?.setAttribute("data-phase", visualPhase);
    this.ui.cutscene?.setAttribute("data-cue-kind", "scene");
    this.ui.cutscene?.setAttribute("data-awaiting-scene", "true");
    if (this.ui.cutsceneChapter) this.ui.cutsceneChapter.textContent = currentCue.chapterLabel || this.chapter;
    this.ui.cutscene?.setAttribute("data-qa-cue", String(Boolean(currentCue.chapterLabel)));
    this.ui.cutsceneDialogue?.setAttribute("inert", "");
    if (this.ui.cutsceneSpeaker) this.ui.cutsceneSpeaker.textContent = "";
    if (this.ui.cutsceneLine) this.ui.cutsceneLine.textContent = "";
    this.ui.cutscenePanel?.setAttribute("data-state", "scene");
    this.fullText = "";
    this.typed = 0;
    this.renderLog();
  }

  armSceneInput() {
    window.clearTimeout(this.sceneReadyTimer);
    this.sceneReadyTimer = 0;
    if (!this.awaitingSceneInput || !this.isOpen()) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay = globalThis.ARCHIVE_DISABLE_TRANSITIONS || reduced ? 0 : SceneFade.HOLD_MS;
    const ready = () => {
      this.sceneReadyTimer = 0;
      if (this.awaitingSceneInput && this.isOpen()) this.sceneTransitioning = false;
    };
    if (delay === 0) ready();
    else this.sceneReadyTimer = window.setTimeout(ready, delay);
  }

  revealSceneCue() {
    if (!this.awaitingSceneInput || this.sceneTransitioning || !this.pendingSceneCue) return;
    const { cue, visualPhase } = this.pendingSceneCue;
    this.pendingSceneCue = null;
    this.awaitingSceneInput = false;
    this.ui.cutscene?.removeAttribute("data-awaiting-scene");
    this.ui.cutsceneDialogue?.removeAttribute("inert");
    this.renderCue(cue, visualPhase);
  }

  renderCue(currentCue, visualPhase) {
    const {
      speaker = "",
      text = "",
      kind = speaker === "SYSTEM" ? "system" : "dialogue",
    } = currentCue;
    this.showBackground(visualPhase);
    this.ui.cutscene?.setAttribute("data-phase", visualPhase);
    this.ui.cutscene?.setAttribute("data-cue-kind", kind);
    /* 화자에 따라 대사창 자리와 색이 달라진다(ARIA는 좌하단·보라). css/cutscene.css 참고. */
    this.ui.cutscene?.setAttribute("data-speaker", speaker);
    if (this.ui.cutsceneChapter) this.ui.cutsceneChapter.textContent = currentCue.chapterLabel || this.chapter;
    this.ui.cutscene?.setAttribute("data-qa-cue", String(Boolean(currentCue.chapterLabel)));
    if (this.ui.cutsceneSpeaker) this.ui.cutsceneSpeaker.textContent = speaker;
    this.startTyping(String(text), { instant: kind !== "dialogue" });
    this.renderLog();
  }

  resetSceneHold() {
    window.clearTimeout(this.sceneReadyTimer);
    this.sceneReadyTimer = 0;
    this.currentSceneKey = "";
    this.pendingSceneCue = null;
    this.awaitingSceneInput = false;
    this.sceneTransitioning = false;
    this.ui.cutscene?.removeAttribute("data-awaiting-scene");
    this.ui.cutsceneDialogue?.removeAttribute("inert");
  }

  /* ── 타자 효과 ────────────────────────────────────────────────────── */

  isTyping() {
    return this.typeTimer !== 0;
  }

  startTyping(text, { instant = false } = {}) {
    this.stopTyping();
    this.fullText = text;
    this.typed = 0;
    this.ui.cutscenePanel?.setAttribute("data-state", "typing");
    if (this.ui.cutsceneLine) this.ui.cutsceneLine.textContent = "";

    /* 시스템 UI와 무대사 장면은 대사가 아니므로 타자 효과 없이 장면 시간만 유지한다. */
    if (instant) {
      this.completeTyping();
      return;
    }

    const speed = globalThis.ARCHIVE_STORY_SETTINGS?.cutsceneSpeed ?? 1;
    this.typeTimer = window.setInterval(() => {
      this.typed += 1;
      if (this.ui.cutsceneLine) this.ui.cutsceneLine.textContent = this.fullText.slice(0, this.typed);
      if (this.typed >= this.fullText.length) this.completeTyping();
    }, CutsceneFlow.TYPE_INTERVAL / speed);
  }

  stopTyping() {
    if (this.typeTimer) window.clearInterval(this.typeTimer);
    this.typeTimer = 0;
  }

  completeTyping() {
    this.stopTyping();
    this.typed = this.fullText.length;
    if (this.ui.cutsceneLine) this.ui.cutsceneLine.textContent = this.fullText;
    this.ui.cutscenePanel?.setAttribute("data-state", "done");
    if (this.auto) this.queueAuto();
  }

  /* ── AUTO ─────────────────────────────────────────────────────────── */

  toggleAuto() {
    this.setAuto(!this.auto);
    // 이미 다 나와 있는 줄에서 AUTO를 켜면 그 줄부터 바로 자동 진행한다.
    if (this.auto && !this.isTyping()) this.queueAuto();
  }

  setAuto(on) {
    this.auto = Boolean(on);
    this.ui.cutsceneAutoButton?.setAttribute("aria-pressed", String(this.auto));
    if (!this.auto) this.clearAuto();
  }

  queueAuto() {
    this.clearAuto();
    const cue = this.script[this.index] || {};
    const speed = globalThis.ARCHIVE_STORY_SETTINGS?.cutsceneSpeed ?? 1;
    const kind = cue.kind ?? (cue.speaker === "SYSTEM" ? "system" : "dialogue");
    const typedFor = kind === "dialogue"
      ? this.fullText.length * CutsceneFlow.TYPE_INTERVAL / speed
      : 0;
    const hold = Number.isFinite(cue.durationMs)
      ? Math.max(180, cue.durationMs / speed - typedFor)
      : (CutsceneFlow.AUTO_HOLD + this.fullText.length * CutsceneFlow.AUTO_HOLD_PER_CHAR) / speed;
    this.autoTimer = window.setTimeout(() => {
      this.autoTimer = 0;
      // 로그를 열어 둔 채로 대사가 넘어가면 읽던 자리를 잃는다. 닫힐 때까지 미룬다.
      if (this.isLogOpen()) this.queueAuto();
      else this.next();
    }, hold);
  }

  clearAuto() {
    if (this.autoTimer) window.clearTimeout(this.autoTimer);
    this.autoTimer = 0;
  }

  /* ── LOG ──────────────────────────────────────────────────────────── */

  isLogOpen() {
    return Boolean(this.ui.cutsceneLog) && !this.ui.cutsceneLog.hasAttribute("hidden");
  }

  toggleLog() {
    if (this.isLogOpen()) this.closeLog();
    else this.openLog();
  }

  openLog() {
    this.renderLog();
    this.ui.cutsceneLog?.removeAttribute("hidden");
    this.ui.cutsceneLogButton?.setAttribute("aria-expanded", "true");
  }

  closeLog() {
    this.ui.cutsceneLog?.setAttribute("hidden", "");
    this.ui.cutsceneLogButton?.setAttribute("aria-expanded", "false");
  }

  /* 지금 줄까지를 목록으로 다시 그린다. */
  renderLog() {
    const list = this.ui.cutsceneLogList;
    if (!list) return;
    list.replaceChildren();

    const seenThrough = this.awaitingSceneInput ? this.index : this.index + 1;
    const seen = this.script.slice(0, Math.max(0, seenThrough));
    if (seen.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cutscene-log-empty";
      empty.textContent = this.copy.logEmpty;
      list.append(empty);
      return;
    }

    seen.filter(({ kind }) => kind !== "silent").forEach(({ speaker = "", text = "", kind = "dialogue" }) => {
      const item = document.createElement("li");
      const who = document.createElement("strong");
      who.textContent = speaker || (kind === "narration" ? "장면 설명" : "");
      item.append(who, document.createTextNode(String(text)));
      list.append(item);
    });
  }

  /* ── 종료 ─────────────────────────────────────────────────────────── */

  /* 끝까지 봤을 때도 SKIP·Esc로 건너뛰었을 때도 이 하나를 지난다. */
  finish() {
    if (!this.isOpen()) return;
    const done = this.onDone;
    this.onDone = null;
    // 컷신을 걷고 다음 화면을 여는 순간도 암전으로 감싼다 — 다음 화면이 무엇이든 상관없다.
    sceneFade.cut(() => {
      this.close();
      done?.();
    });
  }

  close() {
    this.stopTyping();
    this.clearAuto();
    this.resetSceneHold();
    this.closeLog();
    this.setAuto(false);
    this.ui.cutscene?.classList.add("hidden");
    this.ui.cutscene?.removeAttribute("data-phase");
    this.ui.cutscene?.removeAttribute("data-cue-kind");
    this.ui.cutscene?.removeAttribute("data-speaker");
    this.ui.cutscene?.removeAttribute("data-qa-cue");
    this.ui.cutscene?.removeAttribute("data-has-background");
    this.ui.cutsceneBackdrop?.style.removeProperty("--cutscene-image");
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
    this.chapter = "";
  }
}

const cutsceneFlow = new CutsceneFlow(UI, STRINGS);
