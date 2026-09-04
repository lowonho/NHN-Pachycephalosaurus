/*
 * C2(사운드) 전용 — 볼륨·뮤트·재생 정책의 단일 창구.
 *
 * ⚠️ 마이크 입력과 스피커 출력이 충돌하는 지점이라 주의가 필요하다.
 *  1) AudioContext 2개  — voice-controller가 마이크용으로 1개, Phaser가 출력용으로 1개를 만든다.
 *                         attachContext()로 마이크 컨텍스트를 Phaser에 넘겨 하나로 합치는 것을
 *                         시도하되, Phaser 3.90에서 동작하는지 실측 후 확정한다.
 *  2) 에코 오인식      — BGM이 스피커→마이크로 되돌아가 "야호"로 오인식될 수 있다.
 *                         duck()으로 명령 인식 직후 잠시 볼륨을 낮춘다.
 *  3) 점프음 자기유발  — 효과음이 70~520Hz(피치 감지 대역)에 걸리면 스스로 명령을 만든다.
 *                         해당 대역을 피해 사운드를 설계한다.
 *  4) autoplay 정책    — 사용자 제스처 전에는 컨텍스트가 suspended다. resume()을 버튼 클릭에 건다.
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

  // 마이크가 듣는 동안 BGM을 잠시 낮춰 에코 오인식을 줄인다.
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
