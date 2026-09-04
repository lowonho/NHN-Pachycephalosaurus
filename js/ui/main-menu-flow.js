/* 기능(B) — 메인 메뉴, 별도 스테이지 선택 화면, 공통 설정을 관리한다. */

class MainMenuFlow {
  constructor(events, dom, setupFlow, soundBus, voice) {
    this.events = events;
    this.ui = dom;
    this.setupFlow = setupFlow;
    this.soundBus = soundBus;
    this.voice = voice;
    this.selectedStage = "geoje";

    this.ui.mainPlayButton?.addEventListener("click", () => this.startGame());
    this.ui.stageSelectOpenButton?.addEventListener("click", () => this.openStageSelect());
    this.ui.stageGeojeButton?.addEventListener("click", () => this.selectGeoje());
    this.ui.stageSelectConfirmButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.stageSelectBackButton?.addEventListener("click", () => this.closeStageSelect());
    this.ui.mainMicButton?.addEventListener("click", () => this.recalibrate());
    this.ui.mainSettingsButton?.addEventListener("click", () => this.toggleSettings());
    this.ui.masterVolume?.addEventListener("input", () => this.changeVolume());
    this.ui.muteToggle?.addEventListener("change", () => this.changeMuted());

    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => this.open());
    this.events.on(GAME_EVENTS.MIC_CALIBRATED, () => this.updateMicStatus());
    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, (state) => this.syncSettings(state));
    this.syncSettings({ ...this.soundBus.volumes, muted: this.soundBus.muted });
  }

  open() {
    this.setupFlow.close();
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainSettingsPanel.hidden = true;
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "false");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.appShell?.setAttribute("inert", "");
    this.updateMicStatus();
    this.syncSettings({ ...this.soundBus.volumes, muted: this.soundBus.muted });
    this.ui.mainPlayButton?.focus();
  }

  close() {
    this.ui.mainMenu?.classList.add("hidden");
  }

  startGame() {
    this.soundBus.resume();
    this.close();
    this.ui.appShell?.removeAttribute("inert");
    this.events.emit(GAME_EVENTS.REQUEST_START, {
      voiceEnabled: Boolean(this.voice.stream && this.voice.isCalibrated),
      stageId: this.selectedStage,
    });
  }

  openStageSelect() {
    this.close();
    this.ui.stageSelectScreen?.classList.remove("hidden");
    this.ui.stageGeojeButton?.focus();
  }

  closeStageSelect() {
    this.ui.stageSelectScreen?.classList.add("hidden");
    this.ui.mainMenu?.classList.remove("hidden");
    this.ui.stageSelectOpenButton?.focus();
  }

  selectGeoje() {
    this.selectedStage = "geoje";
    this.ui.stageGeojeButton?.classList.add("selected");
    this.ui.stageGeojeButton?.setAttribute("aria-pressed", "true");
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

  updateMicStatus() {
    if (!this.ui.mainMicStatus) return;
    const ready = Boolean(this.voice.stream && this.voice.isCalibrated);
    this.ui.mainMicStatus.textContent = ready
      ? `중간음 ${Math.round(this.voice.basePitch)} Hz`
      : "키보드 모드";
    this.ui.mainMicStatus.classList.toggle("keyboard", !ready);
  }
}

const mainMenuFlow = new MainMenuFlow(
  gameEvents,
  UI,
  modalFlow,
  audioBus,
  voiceController,
);
