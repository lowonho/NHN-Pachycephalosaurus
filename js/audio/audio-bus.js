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
    this.muted = false;
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
    if (this.muted) return 0;
    const base = this.volumes[channel] ?? 1;
    return this.volumes.master * base * (channel === "bgm" ? this.duckFactor : 1);
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
    this.events.emit(GAME_EVENTS.AUDIO_VOLUME_CHANGED, { ...this.volumes, muted: this.muted });
  }

  load() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY) || "null");
      if (saved) {
        this.volumes = { ...this.volumes, ...saved.volumes };
        this.muted = Boolean(saved.muted);
      }
    } catch (_) {
      /* 저장값이 깨졌으면 기본값을 쓴다 */
    }
  }

  save() {
    try {
      window.localStorage.setItem(
        AUDIO_STORAGE_KEY,
        JSON.stringify({ volumes: this.volumes, muted: this.muted }),
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
