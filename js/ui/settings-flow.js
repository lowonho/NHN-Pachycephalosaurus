/*
 * 기능(B) — 설정 다이얼로그.
 * 화면 구성은 assets/images/concept/setting.png 기준이고, 값의 단일 출처는 audio-bus다.
 *
 * 다이얼로그를 열 때 값을 스냅샷으로 떠 두고, 조작은 즉시 반영한다(귀로 확인해야 하니까).
 * "적용"은 그대로 닫고, "뒤로가기"는 스냅샷으로 되돌린다.
 *
 * "음성 입력 감도"만 슬라이더가 아니라 버튼이다. 감도는 숫자로 맞추는 값이 아니라
 * 중간음 측정으로 잡는 값이라, 버튼이 곧 피치 조정 화면을 연다. 실제로 화면을 넘기는 일은
 * main-menu-flow가 하고(메인 화면도 같이 닫아야 한다) 여기서는 자기 상태만 정리한다.
 */

class SettingsFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.snapshot = null;
    this.reopenAfterCalibration = false;

    this.sliders = [
      { channel: "master", input: dom.masterVolume, output: dom.masterVolumeValue },
      { channel: "bgm", input: dom.bgmVolume, output: dom.bgmVolumeValue },
      { channel: "sfx", input: dom.sfxVolume, output: dom.sfxVolumeValue },
    ];

    this.sliders.forEach(({ channel, input }) => {
      input?.addEventListener("input", () => {
        this.soundBus.setVolume(channel, Number(input.value) / 100);
        this.syncAudio();
      });
    });

    this.ui.settingsMuteButton?.addEventListener("click", () => {
      this.soundBus.setMuted(!this.soundBus.muted);
      this.syncAudio();
    });

    this.ui.settingsFullscreenToggle?.addEventListener("click", () => this.toggleFullscreen());
    this.ui.settingsApplyButton?.addEventListener("click", () => this.apply());
    this.ui.settingsBackButton?.addEventListener("click", () => this.cancel());

    // 프레임 바깥(어두운 배경)을 누르면 뒤로가기와 같게 취급한다.
    this.ui.settingsBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === this.ui.settingsBackdrop) this.cancel();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen()) this.cancel();
    });

    document.addEventListener("fullscreenchange", () => this.syncFullscreen());

    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncAudio());

    // 마이크 조정을 마치고 메인 화면으로 돌아오면 설정 화면을 다시 띄운다.
    this.events.on(GAME_EVENTS.REQUEST_MAIN_MENU, () => {
      if (!this.reopenAfterCalibration) return;
      this.reopenAfterCalibration = false;
      this.open();
    });

    this.syncAudio();
    this.syncFullscreen();
  }

  isOpen() {
    return Boolean(this.ui.settingsBackdrop) && !this.ui.settingsBackdrop.classList.contains("hidden");
  }

  toggle() {
    if (this.isOpen()) this.cancel();
    else this.open();
  }

  open() {
    this.snapshot = { volumes: { ...this.soundBus.volumes }, muted: this.soundBus.muted };
    this.ui.settingsBackdrop?.classList.remove("hidden");
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "true");
    this.syncAudio();
    this.syncFullscreen();
    // 슬라이더에 바로 포커스를 주면 두꺼운 포커스 링이 먼저 눈에 띈다. 컨테이너로 넘긴다.
    this.ui.settingsDialog?.focus();
  }

  close({ restoreFocus = true } = {}) {
    this.snapshot = null;
    this.ui.settingsBackdrop?.classList.add("hidden");
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "false");
    if (restoreFocus) this.ui.mainSettingsButton?.focus();
  }

  apply() {
    this.close();
  }

  cancel() {
    const previous = this.snapshot;
    if (previous) {
      Object.entries(previous.volumes).forEach(([channel, volume]) => {
        this.soundBus.setVolume(channel, volume);
      });
      this.soundBus.setMuted(previous.muted);
    }
    this.close();
  }

  /* 마이크 조정으로 넘어갈 때 — 여기까지 만진 값은 되돌리지 않고 그대로 둔다. */
  prepareRecalibration() {
    this.reopenAfterCalibration = true;
    this.close({ restoreFocus: false });
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  syncFullscreen() {
    const active = Boolean(document.fullscreenElement);
    this.ui.settingsFullscreenToggle?.setAttribute("aria-checked", String(active));
    if (this.ui.settingsFullscreenState) {
      this.ui.settingsFullscreenState.textContent = active ? "ON" : "OFF";
    }
  }

  syncAudio() {
    this.sliders.forEach(({ channel, input, output }) => {
      const percent = Math.round((this.soundBus.volumes[channel] ?? 0) * 100);
      if (input) {
        input.value = String(percent);
        // 채움 그라디언트 위치. css/settings.css의 --p가 이 값을 읽는다.
        input.style.setProperty("--p", String(percent / 100));
      }
      if (output) output.textContent = String(percent);
    });

    this.ui.settingsMuteButton?.setAttribute("aria-pressed", String(this.soundBus.muted));
  }
}

const settingsFlow = new SettingsFlow(gameEvents, UI, audioBus);
