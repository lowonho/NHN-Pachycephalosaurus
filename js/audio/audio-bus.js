/*
 * C2(사운드) 전용 — 볼륨·뮤트·재생 정책의 단일 창구.
 *
 * 주의할 점
 *  1) autoplay 정책 — 사용자 제스처 전에는 AudioContext가 suspended다.
 *                     resume()을 버튼 클릭에 걸어 둔다(메인 화면·모달 버튼).
 *  2) duck()        — 특정 순간에만 BGM을 잠깐 낮추는 유틸. 지금은 부르는 곳이 없고,
 *                     필요한 연출이 생기면 그 이벤트에 연결한다.
 *
 * 저장 키(AUDIO_STORAGE_KEY)를 바꾸면 사용자가 맞춰 둔 볼륨이 초기화되므로 그대로 둔다.
 */

const AUDIO_STORAGE_KEY = "geoje-yaho.audio";

class AudioBus {
  constructor(events) {
    this.events = events;
    this.scene = null;
    this.volumes = { master: 0.8, bgm: 0.45, sfx: 0.9 };
    // 마스터 뮤트. 켜지면 채널 설정과 무관하게 전부 조용해진다.
    this.muted = false;
    // 채널별 뮤트. 설정 화면의 볼륨 줄마다 붙은 전원 토글이 여기를 건드린다.
    // 볼륨 값을 0으로 떨어뜨리지 않고 따로 두는 이유는, 껐다 켰을 때
    // 사용자가 맞춰 둔 볼륨이 그대로 돌아와야 하기 때문이다.
    this.channelMuted = { bgm: false, sfx: false };
    this.duckTimer = 0;
    this.duckFactor = 1;

    this.load();
    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => this.attachScene(scene));
  }

  attachScene(scene) {
    this.scene = scene;
    this.apply();
  }

  // 브라우저 autoplay 정책 때문에 사용자 제스처 시점에 한 번 호출해야 한다.
  resume() {
    const context = this.scene?.sound?.context;
    if (context && context.state === "suspended") {
      context.resume().catch(() => {});
    }
  }

  startGameAudio() {
    // Starting the game explicitly enables sound, including saved silent settings.
    this.muted = false;
    if (this.volumes.master <= 0) this.volumes.master = 0.8;
    if (this.volumes.bgm <= 0) this.volumes.bgm = 0.45;
    this.save();
    this.apply();
    this.resume();
    const audio = window.archiveAudio;
    if (!audio) return;
    audio.setBgmVolume(this.channelVolume("bgm"));
    audio.setVolume(this.channelVolume("sfx"));
    // Keep play() in the click/keyboard handler; do not await scene loading first.
    audio.startBgm();
    audio.ensureContext();
  }

  pausePlayback() {
    this.scene?.sound?.pauseAll();
  }

  resumePlayback() {
    this.resume();
    this.scene?.sound?.resumeAll();
  }

  stopPlayback() {
    this.scene?.sound?.stopAll();
  }

  isReady(key) {
    return Boolean(key) && Boolean(this.scene?.cache?.audio?.exists(key));
  }

  channelVolume(channel) {
    if (this.isChannelMuted(channel)) return 0;
    const base = this.volumes[channel] ?? 1;
    return this.volumes.master * base * (channel === "bgm" ? this.duckFactor : 1);
  }

  // master는 별도 채널이 아니라 전체를 덮는 스위치라 this.muted가 곧 답이다.
  isChannelMuted(channel) {
    return this.muted || Boolean(this.channelMuted[channel]);
  }

  setVolume(channel, value) {
    this.volumes[channel] = Math.max(0, Math.min(1, value));
    this.save();
    this.apply();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.save();
    this.apply();
  }

  setChannelMuted(channel, muted) {
    if (channel === "master") {
      this.setMuted(muted);
      return;
    }
    this.channelMuted[channel] = Boolean(muted);
    this.save();
    this.apply();
  }

  // 필요한 순간에 BGM만 잠시 낮춘다. 현재 호출부 없음.
  duck(factor = 0.35, durationMs = 450) {
    this.duckFactor = factor;
    this.apply();
    window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.duckFactor = 1;
      this.apply();
    }, durationMs);
  }

  apply() {
    if (!this.scene?.sound) return;
    this.scene.sound.mute = this.muted;
    this.scene.sound.volume = this.volumes.master;
    this.events.emit(GAME_EVENTS.AUDIO_VOLUME_CHANGED, {
      ...this.volumes,
      muted: this.muted,
      channelMuted: { ...this.channelMuted },
    });
  }

  load() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY) || "null");
      if (saved) {
        this.volumes = { ...this.volumes, ...saved.volumes };
        this.muted = Boolean(saved.muted);
        // channelMuted가 없던 시절에 저장된 값도 그대로 읽힌다(전부 켜짐으로 시작).
        this.channelMuted = { ...this.channelMuted, ...saved.channelMuted };
      }
    } catch (_) {
      /* 저장값이 깨졌으면 기본값을 쓴다 */
    }
  }

  save() {
    try {
      window.localStorage.setItem(
        AUDIO_STORAGE_KEY,
        JSON.stringify({
          volumes: this.volumes,
          muted: this.muted,
          channelMuted: this.channelMuted,
        }),
      );
    } catch (_) {
      /* 시크릿 모드 등에서 실패해도 재생에는 영향이 없다 */
    }
  }

  destroy() {
    window.clearTimeout(this.duckTimer);
  }
}

const audioBus = new AudioBus(gameEvents);
