/*
 * 기능(B) — 설정 다이얼로그.
 * 화면 구성은 assets/images/concept/setting.png 기준이고, 값의 단일 출처는 audio-bus다.
 *
 * 다이얼로그를 열 때 값을 스냅샷으로 떠 두고, 조작은 즉시 반영한다(귀로 확인해야 하니까).
 * "적용"은 그대로 닫고, "뒤로가기"는 스냅샷으로 되돌린다.
 *
 * 오디오·전체 화면과 함께 컷신 자동 속도 설정을 관리한다.
 */

const STORY_SETTINGS_KEY = "archive-2026-story-settings-v1";
// skipCutscenes · skipCountdown은 설정 화면에 없다 — 저장도 하지 않고, 테스트 하네스가 쓰는 런타임 플래그로만 남긴다.
// (skipCountdown은 판을 한 걸음씩 몰아 검사하는 스위트가 3 · 2 · 1을 기다리지 않게 한다.)
const STORY_SETTINGS_DEFAULTS = Object.freeze({ cutsceneSpeed: 1, skipCutscenes: false, skipCountdown: false });

function loadStorySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORY_SETTINGS_KEY) || "null");
    const cutsceneSpeed = Number(saved?.cutsceneSpeed);
    return {
      cutsceneSpeed: Number.isFinite(cutsceneSpeed) ? Math.max(.5, Math.min(2, cutsceneSpeed)) : 1,
      skipCutscenes: false,
      skipCountdown: false,
    };
  } catch {
    return { ...STORY_SETTINGS_DEFAULTS };
  }
}

globalThis.ARCHIVE_STORY_SETTINGS = loadStorySettings();

class SettingsFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.snapshot = null;
    this.returnFocus = null;

    this.sliders = [
      {
        channel: "master",
        input: dom.masterVolume,
        output: dom.masterVolumeValue,
        toggle: dom.masterVolumeToggle,
      },
      {
        channel: "bgm",
        input: dom.bgmVolume,
        output: dom.bgmVolumeValue,
        toggle: dom.bgmVolumeToggle,
      },
      {
        channel: "sfx",
        input: dom.sfxVolume,
        output: dom.sfxVolumeValue,
        toggle: dom.sfxVolumeToggle,
      },
    ];

    this.sliders.forEach(({ channel, input, toggle }) => {
      input?.addEventListener("input", () => {
        this.soundBus.setVolume(channel, Number(input.value) / 100);
        this.syncAudio();
      });

      // 숫자 왼쪽의 전원 토글. aria-checked가 "켜짐"이라 뮤트와는 반대다.
      toggle?.addEventListener("click", () => {
        const on = toggle.getAttribute("aria-checked") === "true";
        this.soundBus.setChannelMuted(channel, on);
        this.syncAudio();
      });
    });

    this.ui.settingsFullscreenToggle?.addEventListener("click", () => this.toggleFullscreen());
    this.ui.cutsceneSpeed?.addEventListener("input", () => {
      globalThis.ARCHIVE_STORY_SETTINGS.cutsceneSpeed = Number(this.ui.cutsceneSpeed.value) / 100;
      this.syncStory();
    });
    this.ui.settingsApplyButton?.addEventListener("click", () => this.apply());
    this.ui.settingsBackButton?.addEventListener("click", () => this.cancel());

    // 프레임 바깥(어두운 배경)을 누르면 뒤로가기와 같게 취급한다.
    this.ui.settingsBackdrop?.addEventListener("mousedown", (event) => {
      if (event.target === this.ui.settingsBackdrop) this.cancel();
    });

    /*
     * 결과 모달이 위에 덮여 있는 동안에는 Esc가 뒤 화면(설정)까지 닿으면 안 된다.
     * 여기서 닫았다는 표시로 preventDefault를 남긴다 — 안 그러면 같은 Esc가
     * 뒤의 일시정지 창(js/ui/pause-flow.js)까지 함께 걷어낸다.
     */
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.isOpen() || modalFlow.isOpen()) return;
      event.preventDefault();
      this.cancel();
    });

    document.addEventListener("fullscreenchange", () => this.syncFullscreen());

    this.events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.syncAudio());

    this.syncAudio();
    this.syncFullscreen();
    this.syncStory();
  }

  isOpen() {
    return Boolean(this.ui.settingsBackdrop) && !this.ui.settingsBackdrop.classList.contains("hidden");
  }

  toggle() {
    if (this.isOpen()) this.cancel();
    else this.open();
  }

  /*
   * returnFocus — 닫을 때 손가락을 돌려줄 곳. 메인 화면의 톱니바퀴가 기본이지만,
   * 일시정지 창에서 열었다면 그 창의 "설정" 버튼으로 돌아가야 한다
   * (메인 화면은 그때 숨어 있어 포커스를 받지 못한다).
   */
  open({ returnFocus = this.ui.mainSettingsButton } = {}) {
    this.snapshot = {
      volumes: { ...this.soundBus.volumes },
      muted: this.soundBus.muted,
      channelMuted: { ...this.soundBus.channelMuted },
      story: { ...globalThis.ARCHIVE_STORY_SETTINGS },
    };
    this.returnFocus = returnFocus;
    this.ui.settingsBackdrop?.classList.remove("hidden");
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "true");
    this.syncAudio();
    this.syncFullscreen();
    this.syncStory();
    // 슬라이더에 바로 포커스를 주면 두꺼운 포커스 링이 먼저 눈에 띈다. 컨테이너로 넘긴다.
    this.ui.settingsDialog?.focus();
  }

  close({ restoreFocus = true } = {}) {
    this.snapshot = null;
    const target = this.returnFocus ?? this.ui.mainSettingsButton;
    this.returnFocus = null;
    this.ui.settingsBackdrop?.classList.add("hidden");
    this.ui.mainSettingsButton?.setAttribute("aria-expanded", "false");
    if (restoreFocus) target?.focus();
  }

  apply() {
    const { cutsceneSpeed } = globalThis.ARCHIVE_STORY_SETTINGS;
    try { localStorage.setItem(STORY_SETTINGS_KEY, JSON.stringify({ cutsceneSpeed })); } catch { /* 설정은 현재 탭에서 유지 */ }
    this.close();
  }

  cancel() {
    const previous = this.snapshot;
    if (previous) {
      Object.entries(previous.volumes).forEach(([channel, volume]) => {
        this.soundBus.setVolume(channel, volume);
      });
      Object.entries(previous.channelMuted).forEach(([channel, muted]) => {
        this.soundBus.setChannelMuted(channel, muted);
      });
      this.soundBus.setMuted(previous.muted);
      Object.assign(globalThis.ARCHIVE_STORY_SETTINGS, previous.story);
    }
    this.close();
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
    this.sliders.forEach(({ channel, input, output, toggle }) => {
      const percent = Math.round((this.soundBus.volumes[channel] ?? 0) * 100);
      if (input) {
        input.value = String(percent);
        // 채움 그라디언트 위치. css/settings.css의 --p가 이 값을 읽는다.
        input.style.setProperty("--p", String(percent / 100));
      }
      if (output) output.textContent = String(percent);

      const on = !this.soundBus.isChannelMuted(channel);
      toggle?.setAttribute("aria-checked", String(on));
      // 꺼진 줄은 슬라이더와 숫자를 흐리게 둔다. css/settings.css가 읽는다.
      toggle?.closest(".settings-row")?.setAttribute("data-muted", String(!on));
    });
  }

  syncStory() {
    const { cutsceneSpeed } = globalThis.ARCHIVE_STORY_SETTINGS;
    if (this.ui.cutsceneSpeed) {
      const percent = Math.round(cutsceneSpeed * 100);
      this.ui.cutsceneSpeed.value = String(percent);
      this.ui.cutsceneSpeed.style.setProperty("--p", String((percent - 50) / 150));
    }
    if (this.ui.cutsceneSpeedValue) this.ui.cutsceneSpeedValue.textContent = `${cutsceneSpeed.toFixed(2)}×`;
  }
}

const settingsFlow = new SettingsFlow(gameEvents, UI, audioBus);
