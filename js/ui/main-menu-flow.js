/*
 * 기능(B) — 메인 화면.
 *
 * 최초 진입 화면이자 게임의 허브다. 화면 흐름은
 *   메인 화면 → 스테이지 선택 → 피치 조정(중간음 측정) → 선택한 스테이지
 * 순서이고, "게임 시작"이 그 첫 단계를 연다.
 */

class MainMenuFlow {
  constructor(events, dom, setupFlow, soundBus) {
    this.events = events;
    this.ui = dom;
    this.setupFlow = setupFlow;
    this.soundBus = soundBus;
    this.selectedStage = "geoje";

    this.ui.mainPlayButton?.addEventListener("click", () => this.openStageSelect());
    this.ui.stageGeojeButton?.addEventListener("click", () => this.selectGeoje());
    this.ui.stageDujjonkuButton?.addEventListener("click", () => this.selectStage("dujjonku"));
    this.ui.stageSelectConfirmButton?.addEventListener("click", () => this.startGame());
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.mainMicButton?.addEventListener("click", () => this.recalibrate());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.toggleSettings());
    this.ui.masterVolume?.addEventListener("input", () => this.changeVolume());
    this.ui.muteToggle?.addEventListener("change", () => this.changeMuted());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, (state) => this.syncSettings(state));

    this.open();
  }

  open() {
    this.setupFlow.close();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainSettingsPanel.hidden = true;
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "false");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
    this.syncSettings({ ...this.soundBus.volumes, muted: this.soundBus.muted });
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  /* 게임 시작 → 피치 조정 UI. 스테이지는 측정이 끝난 뒤 modal-flow가 연다. */
  startGame() {
    this.soundBus.resume();
    this.close();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.setupFlow.beginCalibration("stage", this.selectedStage);
  }

  openStageSelect() {
    this.close();
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.ui.stageGeojeButton?.focus();
  }

  closeStageSelect() {
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.mainPlayButton?.focus();
  }

  selectGeoje() {
    this.selectStage("geoje");
  }

  selectStage(stageId) {
    this.selectedStage = stageId;
    const geojeSelected = stageId === "geoje";
    this.ui.stageGeojeButton?.classList.toggle("selected", geojeSelected);
    this.ui.stageGeojeButton?.setAttribute("aria-pressed", String(geojeSelected));
    this.ui.stageDujjonkuButton?.classList.toggle("selected", !geojeSelected);
    this.ui.stageDujjonkuButton?.setAttribute("aria-pressed", String(!geojeSelected));
  }

  recalibrate() {
    this.soundBus.resume();
    this.close();
    this.setupFlow.beginCalibration("main");
  }

  toggleSettings() {
    const opening = Boolean(this.ui.mainSettingsPanel?.hidden);
    this.ui.mainSettingsPanel.hidden = !opening;
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", String(opening));
    if (opening) this.ui.masterVolume?.focus();
  }

  changeVolume() {
    const volume = Number(this.ui.masterVolume.value) / 100;
    this.soundBus.setVolume("master", volume);
  }

  changeMuted() {
    this.soundBus.setMuted(this.ui.muteToggle.checked);
  }

  syncSettings(state) {
    const percent = Math.round((state.master ?? this.soundBus.volumes.master) * 100);
    if (this.ui.masterVolume) this.ui.masterVolume.value = String(percent);
    if (this.ui.masterVolumeValue) this.ui.masterVolumeValue.textContent = `${percent}%`;
    if (this.ui.muteToggle) this.ui.muteToggle.checked = Boolean(state.muted);
  }
}

const mainMenuFlow = new MainMenuFlow(gameEvents, UI, modalFlow, audioBus);
