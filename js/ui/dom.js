/*
 * 기능(B) — DOM 참조 캐시.
 * 이 파일만 querySelector를 호출한다. 다른 모듈은 UI.xxx로 받아 쓴다.
 */

const UI = Object.freeze({
  mainMenu: document.querySelector("#main-menu"),
  mainSettingsButton: document.querySelector("#main-settings-button"),
  mainPlayButton: document.querySelector("#main-play-button"),
  mainChallengeButton: document.querySelector("#main-challenge-button"),

  stageSelectScreen: document.querySelector("#stage-select-screen"),
  stageSelectGrid: document.querySelector("#stage-select-grid"),
  stageSelectBackButton: document.querySelector("#stage-select-back-button"),

  settingsBackdrop: document.querySelector("#settings-modal"),
  settingsDialog: document.querySelector("#settings-dialog"),
  masterVolume: document.querySelector("#master-volume"),
  masterVolumeValue: document.querySelector("#master-volume-value"),
  bgmVolume: document.querySelector("#bgm-volume"),
  bgmVolumeValue: document.querySelector("#bgm-volume-value"),
  sfxVolume: document.querySelector("#sfx-volume"),
  sfxVolumeValue: document.querySelector("#sfx-volume-value"),
  settingsMuteButton: document.querySelector("#settings-mute-button"),
  settingsFullscreenToggle: document.querySelector("#settings-fullscreen-toggle"),
  settingsFullscreenState: document.querySelector("#settings-fullscreen-state"),
  settingsApplyButton: document.querySelector("#settings-apply-button"),
  settingsBackButton: document.querySelector("#settings-back-button"),

  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),
  stageHud: document.querySelector("#stage-hud"),
  stageHudTitle: document.querySelector("#stage-hud-title"),
  stageHudTimer: document.querySelector("#stage-hud-timer"),
  stageHudAction: document.querySelector("#stage-hud-action"),
  stageHudAnomaly: document.querySelector("#stage-hud-anomaly"),
  stageHudRisk: document.querySelector("#stage-hud-risk"),

  modal: document.querySelector("#result-modal"),
  modalStep: document.querySelector("#modal-step"),
  modalTitle: document.querySelector("#modal-title"),
  modalCopy: document.querySelector("#modal-copy"),
  modalResult: document.querySelector("#modal-result"),
  primaryButton: document.querySelector("#primary-button"),
  secondaryButton: document.querySelector("#secondary-button"),

  pauseButton: document.querySelector("#pause-button"),
  pauseModal: document.querySelector("#pause-modal"),
  resumeButton: document.querySelector("#resume-button"),
  pauseMainButton: document.querySelector("#pause-main-button"),
});
