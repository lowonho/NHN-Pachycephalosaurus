/*
 * 기능(B) — DOM 참조 캐시.
 * 이 파일만 querySelector를 호출한다. 다른 모듈은 UI.xxx로 받아 쓴다.
 */

const UI = Object.freeze({
  mainMenu: document.querySelector("#main-menu"),
  mainSettingsButton: document.querySelector("#main-settings-button"),
  mainPlayButton: document.querySelector("#main-play-button"),
  mainContinueButton: document.querySelector("#main-continue-button"),
  mainCodexButton: document.querySelector("#main-codex-button"),
  mainSoundButton: document.querySelector("#main-sound-button"),

  /*
   * QA 모드(js/ui/qa-mode.js) — 검수용 뒷문.
   * #qa-unlock은 메인 화면의 "2026 ARCHIVE" 글자다(빠르게 10번 누르면 열린다).
   */
  qaUnlock: document.querySelector("#qa-unlock"),
  qaPanel: document.querySelector("#qa-panel"),
  qaCloseButton: document.querySelector("#qa-close-button"),
  qaExitButton: document.querySelector("#qa-exit-button"),
  qaStoryGrid: document.querySelector("#qa-story-grid"),
  qaStageGrid: document.querySelector("#qa-stage-grid"),
  qaTimeNumber: document.querySelector("#qa-time-number"),
  qaTimeSlider: document.querySelector("#qa-time-slider"),
  qaTimePresets: document.querySelector("#qa-time-presets"),
  qaBriefToggle: document.querySelector("#qa-brief-toggle"),
  qaHint: document.querySelector("#qa-hint"),
  qaBadge: document.querySelector("#qa-badge"),
  qaBadgeTime: document.querySelector("#qa-badge-time"),

  cutscene: document.querySelector("#cutscene"),
  cutsceneBackdrop: document.querySelector("#cutscene-backdrop"),
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
   * 브리핑(#protocol-brief)과 플레이(.app-shell) 사이를 오간다.
   * PAUSE 버튼만 모니터 밖(방의 우상단)에 서서 두 상태에 다 걸린다.
   */
  stageSelectScreen: document.querySelector("#stage-select-screen"),
  protocolScreen: document.querySelector("#protocol-screen"),
  protocolPauseButton: document.querySelector("#protocol-pause-button"),

  /* 브리핑 레이어 — 이번 차례의 기억과 그 프로토콜을 설명한다. */
  protocolBrief: document.querySelector("#protocol-brief"),
  protocolBriefCode: document.querySelector("#protocol-brief-code"),
  protocolBriefTitle: document.querySelector("#protocol-brief-title"),
  protocolBriefRecord: document.querySelector("#protocol-brief-record"),
  protocolBriefId: document.querySelector("#protocol-brief-id"),
  protocolBriefNumber: document.querySelector("#protocol-brief-number"),
  protocolBriefSymbol: document.querySelector("#protocol-brief-symbol"),
  protocolBriefObjective: document.querySelector("#protocol-brief-objective"),
  protocolBriefStamp: document.querySelector("#protocol-brief-stamp"),
  protocolBriefControls: document.querySelector("#protocol-brief-controls"),
  protocolBriefAnomaly: document.querySelector("#protocol-brief-anomaly"),
  protocolBriefBest: document.querySelector("#protocol-brief-best"),
  protocolBriefStartButton: document.querySelector("#protocol-brief-start"),
  protocolBriefLives: document.querySelector("#protocol-brief-lives"),
  protocolBriefNote: document.querySelector("#protocol-brief-note"),

  /* 책상 위 탁상시계 — 현재 스테이지의 20.26초를 표시한다. */
  /* 책상 위 양손 — 입력에 따라 각각 움직인다(js/ui/desk-hands.js). */
  deskHandLeft: document.querySelector("#desk-hand-left"),
  deskHandRight: document.querySelector("#desk-hand-right"),

  /* 같은 손의 연출 자세 — 죽고 다시 소환될 때(주먹)와 클리어(따봉) 때만 뜬다. */
  deskPoseFists: document.querySelector("#desk-pose-fists"),
  deskPoseThumbs: document.querySelector("#desk-pose-thumbs"),

  deskClock: document.querySelector("#desk-clock"),
  deskClockMinutes: document.querySelector("#desk-clock-minutes"),
  deskClockSeconds: document.querySelector("#desk-clock-seconds"),
  deskClockCentis: document.querySelector("#desk-clock-centis"),

  /*
   * ARCHIVE 복구 현황 — 판을 넘어 남는 누적 기록이다(js/archive/progress.mjs).
   * 지금 이 숫자를 띄우는 곳은 메인 화면뿐이지만, 여러 곳에 붙을 수 있어 목록으로 받는다.
   */
  archiveRecoveryRates: document.querySelectorAll("[data-archive-recovery]"),
  recoveryFailed: document.querySelector("#recovery-failed"),
  recoveryFailedButton: document.querySelector("#recovery-failed-button"),

  /* 기록실 — 미니게임 도감 + 증언 기록 두 탭. 메인 화면에서만 연다(js/ui/codex-flow.js). */
  codexBackdrop: document.querySelector("#codex-modal"),
  codexDialog: document.querySelector("#codex-dialog"),
  codexGrid: document.querySelector("#codex-grid"),
  codexCount: document.querySelector("#codex-count"),
  codexHint: document.querySelector("#codex-hint"),
  codexTabs: document.querySelectorAll("[data-codex-tab]"),
  codexRecordsTab: document.querySelector("#codex-tab-records"),
  codexCloseButton: document.querySelector("#codex-close-button"),

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
  cutsceneSpeed: document.querySelector("#cutscene-speed"),
  cutsceneSpeedValue: document.querySelector("#cutscene-speed-value"),
  settingsApplyButton: document.querySelector("#settings-apply-button"),
  settingsBackButton: document.querySelector("#settings-back-button"),

  appShell: document.querySelector(".app-shell"),
  gameContainer: document.querySelector("#game-container"),
  stageHud: document.querySelector("#stage-hud"),
  stageHudTitle: document.querySelector("#stage-hud-title"),
  stageHudTimer: document.querySelector("#stage-hud-timer"),
  stageHudTotal: document.querySelector("#stage-hud-total"),
  stageHudAct: document.querySelector("#stage-hud-act"),
  stageHudStage: document.querySelector("#stage-hud-stage"),
  stageHudLives: document.querySelector("#stage-hud-lives"),
  stageHudActRecords: document.querySelector("#stage-hud-act-records"),
  stageHudMemory: document.querySelector("#stage-hud-memory"),
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
  touchControls: document.querySelector("#touch-controls"),
  touchButtons: document.querySelectorAll("#touch-controls button"),
  pauseModal: document.querySelector("#pause-modal"),
  pauseCopy: document.querySelector("#pause-copy"),
  resumeButton: document.querySelector("#resume-button"),
  pauseSettingsButton: document.querySelector("#pause-settings-button"),
  pauseMainButton: document.querySelector("#pause-main-button"),
});
