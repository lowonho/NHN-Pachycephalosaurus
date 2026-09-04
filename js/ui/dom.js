/*
 * 기능(B) — DOM 참조 캐시.
 * 이 파일만 querySelector를 호출한다. 다른 모듈은 UI.xxx로 받아 쓴다.
 */

const UI = Object.freeze({
  titleScreen: document.querySelector("#title-screen"),
  titleStartButton: document.querySelector("#title-start-button"),

  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),

  statusDot: document.querySelector("#status-dot"),
  statusLabel: document.querySelector("#status-label"),

  pitchNeedle: document.querySelector("#pitch-needle"),
  pitchLabel: document.querySelector("#pitch-label"),
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
});
