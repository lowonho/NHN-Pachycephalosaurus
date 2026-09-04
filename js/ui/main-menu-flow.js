/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 스테이지 선택 → (스테이지)
 * 순서지만, 게임 내용을 다시 정하는 중이라 지금은 스테이지가 하나도 없다.
 * 스테이지 카드 3장은 모두 "준비 중"이고 선택·시작 배선은 끊어 둔 상태다.
 *
 * 스테이지가 정해지면 이 파일에 카드 선택(selectStage)과 시작(REQUEST_START 발행)을
 * 다시 넣는다. 그 자리는 startStage()에 표시해 두었다.
 *
 * 설정 화면은 settings-flow가 통째로 들고 있다. 여기서는 열고 닫는 신호만 보낸다.
 */

class MainMenuFlow {
  constructor(events, dom, soundBus, settings) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.settings = settings;
    this.stages = [];

    this.ui.mainPlayButton?.addEventListener("click", () => this.openStageSelect());
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.settings.toggle());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());

    // 스테이지가 실제로 열릴 때 메인 화면을 비운다.
    this.events.on(GAME_EVENTS.REQUEST_START, () => this.close());

    this.open();
  }

  open() {
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  /*
   * 게임 시작 → 스테이지 선택. 메인 화면은 뒤에 그대로 두고 그 위에 덮는다.
   * 뒤 화면은 보이되 만질 수는 없어야 하므로 modal-flow와 같은 방식으로 inert를 건다.
   */
  openStageSelect() {
    this.soundBus.resume();
    this.renderStages();
    this.ui.mainMenu?.setAttribute("inert", "");
    this.ui.stageSelectScreen?.classList.remove("hidden");
    const firstCard = this.ui.stageSelectGrid?.querySelector("button:not(:disabled)");
    if (firstCard) firstCard.focus();
    else this.ui.stageSelectBackButton?.focus();
  }

  setStages(stages) {
    this.stages = Array.isArray(stages) ? stages : [];
    this.renderStages();
  }

  renderStages() {
    const grid = this.ui.stageSelectGrid;
    if (!grid) return;
    grid.replaceChildren();

    if (this.stages.length === 0) {
      const loading = document.createElement("div");
      loading.className = "stage-select-card stage-select-card--soon";
      loading.innerHTML = "<span class=\"stage-number\">LOADING</span><strong>스테이지 불러오는 중</strong><span class=\"stage-description\">게임 엔진을 준비하고 있습니다.</span>";
      grid.append(loading);
      return;
    }

    this.stages.forEach((stage) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "stage-select-card";
      card.dataset.stageId = stage.id;

      const number = document.createElement("span");
      number.className = "stage-number";
      number.textContent = `STAGE ${stage.number}`;

      const title = document.createElement("strong");
      title.textContent = stage.title;

      const description = document.createElement("span");
      description.className = "stage-description";
      description.textContent = stage.objective;

      const duration = document.createElement("span");
      duration.className = "stage-duration";
      duration.textContent = "20.26 SEC";

      const controls = document.createElement("span");
      controls.className = "stage-controls";
      controls.textContent = stage.controls;

      card.append(number, title, description, controls, duration);
      card.addEventListener("click", () => this.startStage(stage.id));
      grid.append(card);
    });
  }

  closeStageSelect() {
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.removeAttribute("inert");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.mainPlayButton?.focus();
  }

  /*
   * 스테이지 진입 자리. 지금은 진입할 스테이지가 없어 아무 데서도 부르지 않는다.
   * 스테이지가 생기면 선택된 카드의 id를 넘겨 여기서 시작 신호를 쏜다.
   */
  startStage(stageId) {
    this.soundBus.resume();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.appShell?.removeAttribute("inert");
    this.events.emit(GAME_EVENTS.REQUEST_START, { stageId });
  }
}

const mainMenuFlow = new MainMenuFlow(gameEvents, UI, audioBus, settingsFlow);
