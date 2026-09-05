/*
 * C2(사운드) 전용 — 이벤트를 구독해 효과음을 재생한다.
 *
 * 기능 코드는 이 파일의 존재를 모른다. Phaser 캐시에 없으면 ArchiveAudio의
 * 네이티브 파일 풀로 넘겨 file:// 직접 실행에서도 같은 소리를 낸다.
 */

class SfxPlayer {
  constructor(events, bus, eventMap) {
    this.bus = bus;
    this.lastPlayed = new Map();

    eventMap.forEach(({ event, key }) => {
      events.on(event, (payload) => {
        const resolved = typeof key === "function" ? key(payload) : key;
        this.play(resolved);
      });
    });
  }

  play(key, config = {}) {
    if (!this.bus.isReady(key)) {
      /* 아카이브 게임은 file:// 호환 네이티브 풀로 같은 파일을 재생한다. */
      return window.archiveAudio?.play(key) ?? null;
    }

    // 같은 효과음이 한 프레임에 여러 번 겹쳐 터지는 것을 막는다.
    const tuning = globalThis.ARCHIVE_AUDIO_TUNING?.sfx;
    const fileTuning = tuning?.files?.[key] ?? {};
    const throttleMs = fileTuning.throttleMs ?? tuning?.throttleMs ?? 60;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) || 0) < throttleMs) return null;
    this.lastPlayed.set(key, now);

    this.bus.resume();
    const sound = this.bus.scene.sound.add(key, {
      volume: this.bus.channelVolume("sfx") * (fileTuning.gain ?? 1),
      rate: fileTuning.rate ?? 1,
      ...config,
    });
    sound.once("complete", () => sound.destroy());
    sound.play();
    return sound;
  }

  stop(key) {
    this.bus.scene?.sound?.getAll(key)?.forEach((sound) => { sound.stop(); sound.destroy(); });
  }

  stopAll() {
    [...(this.bus.scene?.sound?.sounds ?? [])].forEach((sound) => { sound.stop(); sound.destroy(); });
  }
}

const sfxPlayer = new SfxPlayer(gameEvents, audioBus, SFX_EVENT_MAP);
globalThis.archiveSfx = sfxPlayer;
