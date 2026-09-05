/*
 * 기능(B) — DOM 참조 캐시.
 * 이 파일만 querySelector를 호출한다. 다른 모듈은 UI.xxx로 받아 쓴다.
 */

const UI = Object.freeze({
  mainMenu: document.querySelector("#main-menu"),
  mainSettingsButton: document.querySelector("#main-settings-button"),
  mainPlayButton: document.querySelector("#main-play-button"),
  mainSoundButton: document.querySelector("#main-sound-button"),

  cutscene: document.querySelector("#cutscene"),
  cutsceneChapter: document.querySelector("#cutscene-chapter"),
  cutsceneSpeaker: document.querySelector("#cutscene-speaker-name"),
  cutscenePanel: document.querySelector("#cutscene-panel"),
  cutsceneLine: document.querySelector("#cutscene-line"),
  cutsceneAutoButton: document.querySelector("#cutscene-auto-button"),
  cutsceneLogButton: document.querySelector("#cutscene-log-button"),
  cutsceneSkipButton: document.querySelector("#cutscene-skip-button"),
  cutsceneSkipTopButton: document.querySelector("#cutscene-skip-top-button"),
  cutsceneLog: document.querySelector("#cutscene-log"),
  cutsceneLogList: document.querySelector("#cutscene-log-list"),

  /*
   * 모니터 화면 한 채. 그 안의 스크린(#protocol-screen)이 data-mode로
   * 프로토콜 선택(#protocol-desktop)과 플레이(.app-shell) 사이를 오간다.
   */
  stageSelectScreen: document.querySelector("#stage-select-screen"),
  protocolScreen: document.querySelector("#protocol-screen"),
  protocolDesktop: document.querySelector("#protocol-desktop"),
  stageSelectGrid: document.querySelector("#stage-select-grid"),
  stageSelectBackButton: document.querySelector("#stage-select-back-button"),
  protocolProgress: document.querySelector("#protocol-progress"),

  /*
   * 책상 위 탁상시계 — 남은 복구 시간(2:26)을 1/100초까지 띄우는 유일한 표시다.
   * 스크린 밖이라 프로토콜을 고르는 동안에도, 미니게임을 하는 동안에도 보인다.
   */
  deskClock: document.querySelector("#desk-clock"),
  deskClockMinutes: document.querySelector("#desk-clock-minutes"),
  deskClockSeconds: document.querySelector("#desk-clock-seconds"),
  deskClockCentis: document.querySelector("#desk-clock-centis"),

  /*
   * ARCHIVE 복구 현황 — 판을 넘어 남는 누적 기록이다(js/archive/progress.mjs).
   * 복구율은 메인 화면과 프로토콜 선택 화면 두 곳에 같이 뜨므로 목록으로 받는다.
   */
  archiveRecoveryRates: document.querySelectorAll("[data-archive-recovery]"),
  archiveRecoveryDetail: document.querySelector("#archive-recovery-detail"),
  archiveEndingStatus: document.querySelector("#archive-ending-status"),
  recoveryFailed: document.querySelector("#recovery-failed"),
  recoveryFailedButton: document.querySelector("#recovery-failed-button"),

  settingsBackdrop: document.querySelector("#settings-modal"),
  settingsDialog: document.querySelector("#settings-dialog"),
  masterVolume: document.querySelector("#master-volume"),
  masterVolumeValue: document.querySelector("#master-volume-value"),
  masterVolumeToggle: document.querySelector("#master-volume-toggle"),
  bgmVolume: document.querySelector("#bgm-volume"),
  bgmVolumeValue: document.querySelector("#bgm-volume-value"),
  bgmVolumeToggle: document.querySelector("#bgm-volume-toggle"),
  sfxVolume: document.querySelector("#sfx-volume"),
  sfxVolumeValue: document.querySelector("#sfx-volume-value"),
  sfxVolumeToggle: document.querySelector("#sfx-volume-toggle"),
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
  stageHudPenalty: document.querySelector("#stage-hud-penalty"),

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
