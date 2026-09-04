/* 기능(B) — 스테이지 선택, 마이크 진입, 공통 오디오 설정을 관리한다. */

class MainMenuFlow {
  constructor(events, dom, setupFlow, soundBus) {
    this.events = events;
    this.ui = dom;
    this.setupFlow = setupFlow;
    this.soundBus = soundBus;

    this.ui.stageGeojeButton?.addEventListener("click", () => this.selectGeoje());
    this.ui.mainPlayButton?.addEventListener("click", () => this.openStageSetup());
    this.ui.mainMicButton?.addEventListener("click", () => this.openMicSetup());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.toggleSettings());
    this.ui.masterVolume?.addEventListener("input", () => this.changeVolume());
    this.ui.muteToggle?.addEventListener("change", () => this.changeMuted());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, (state) => this.syncSettings(state));
    this.syncSettings({ ...this.soundBus.volumes, muted: this.soundBus.muted });
  }

  open() {
    this.setupFlow.close();
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
    this.syncSettings({ ...this.soundBus.volumes, muted: this.soundBus.muted });
    this.ui.stageGeojeButton?.focus();
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  selectGeoje() {
    this.ui.stageGeojeButton?.classList.add("selected");
    this.ui.stageGeojeButton?.setAttribute("aria-pressed", "true");
  }

  openStageSetup() {
    this.soundBus.resume();
    this.close();
    this.setupFlow.showIntro();
    this.setupFlow.open();
    this.ui.primaryButton?.focus();
  }

  openMicSetup() {
    this.soundBus.resume();
    this.close();
    this.setupFlow.showIntro();
    this.setupFlow.open();
    this.setupFlow.runCalibration();
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
