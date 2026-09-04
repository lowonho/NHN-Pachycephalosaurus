/*
 * 기능(B) — DOM 참조 캐시.
 * 이 파일만 querySelector를 호출한다. 다른 모듈은 UI.xxx로 받아 쓴다.
 */

const UI = Object.freeze({
  mainMenu: document.querySelector("#main-menu"),
  mainSettingsButton: document.querySelector("#main-settings-button"),
  mainSettingsPanel: document.querySelector("#main-settings-panel"),
  mainPlayButton: document.querySelector("#main-play-button"),
  mainChallengeButton: document.querySelector("#main-challenge-button"),
  mainMicButton: document.querySelector("#main-mic-button"),
  masterVolume: document.querySelector("#master-volume"),
  masterVolumeValue: document.querySelector("#master-volume-value"),
  muteToggle: document.querySelector("#mute-toggle"),

  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),

  statusDot: document.querySelector("#status-dot"),
  statusLabel: document.querySelector("#status-label"),

  pitchNeedle: document.querySelector("#pitch-needle"),
  pitchLabel: document.querySelector("#pitch-label"),
  pitchPanel: document.querySelector(".pitch-panel"),
  voiceWaveform: document.querySelector("#voice-waveform"),
  voiceInputState: document.querySelector("#voice-input-state"),
  voiceTranscriptKind: document.querySelector("#voice-transcript-kind"),
  voiceTranscript: document.querySelector("#voice-transcript"),
  commandDeck: document.querySelector("#command-deck"),

  helpToggle: document.querySelector("#help-toggle"),
  helpCopy: document.querySelector("#help-copy"),
  systemStatus: document.querySelector(".system-status"),

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
