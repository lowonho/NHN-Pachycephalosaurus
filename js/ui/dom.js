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
  stageSelectConfirmButton: document.querySelector("#stage-select-confirm-button"),
  stageSelectBackButton: document.querySelector("#stage-select-back-button"),
  stageGeojeButton: document.querySelector("#stage-geoje-button"),
  stageDujjonkuButton: document.querySelector("#stage-dujjonku-button"),

  settingsBackdrop: document.querySelector("#settings-modal"),
  settingsDialog: document.querySelector("#settings-dialog"),
  masterVolume: document.querySelector("#master-volume"),
  masterVolumeValue: document.querySelector("#master-volume-value"),
  bgmVolume: document.querySelector("#bgm-volume"),
  bgmVolumeValue: document.querySelector("#bgm-volume-value"),
  sfxVolume: document.querySelector("#sfx-volume"),
  sfxVolumeValue: document.querySelector("#sfx-volume-value"),
  settingsMuteButton: document.querySelector("#settings-mute-button"),
  settingsMicButton: document.querySelector("#settings-mic-button"),
  settingsFullscreenToggle: document.querySelector("#settings-fullscreen-toggle"),
  settingsFullscreenState: document.querySelector("#settings-fullscreen-state"),
  settingsApplyButton: document.querySelector("#settings-apply-button"),
  settingsBackButton: document.querySelector("#settings-back-button"),

  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),

  statusDot: document.querySelector("#status-dot"),
  statusLabel: document.querySelector("#status-label"),

  pitchNeedle: document.querySelector("#pitch-needle"),
  pitchLabel: document.querySelector("#pitch-label"),
  voiceWaveform: document.querySelector("#voice-waveform"),
  voiceInputState: document.querySelector("#voice-input-state"),
  voiceTranscriptKind: document.querySelector("#voice-transcript-kind"),
  voiceTranscript: document.querySelector("#voice-transcript"),
  commandDeck: document.querySelector("#command-deck"),

  helpToggle: document.querySelector("#help-toggle"),
  helpCopy: document.querySelector("#help-copy"),

  modal: document.querySelector("#setup-modal"),
  modalStep: document.querySelector("#modal-step"),
  modalTitle: document.querySelector("#modal-title"),
  modalCopy: document.querySelector("#modal-copy"),
  primaryButton: document.querySelector("#primary-button"),
  secondaryButton: document.querySelector("#secondary-button"),
  calibrationVisual: document.querySelector("#calibration-visual"),
  calibrationResult: document.querySelector("#calibration-result"),

  pauseButton: document.querySelector("#pause-button"),
  pauseModal: document.querySelector("#pause-modal"),
  resumeButton: document.querySelector("#resume-button"),
  pauseMainButton: document.querySelector("#pause-main-button"),
});
