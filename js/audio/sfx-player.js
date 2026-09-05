/*
 * C2(사운드) 전용 — 이벤트를 구독해 효과음을 재생한다.
 *
 * 기능 코드는 이 파일의 존재를 모른다. 재생할 파일이 아직 없으면 조용히 무시하므로
 * 오디오 에셋을 하나씩 채워 넣는 동안에도 게임은 정상 동작한다.
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
      /* 파일형 SFX가 아직 납품 전이면 조용히 빠지는 대신 조정 가능한 합성 프리셋을 쓴다. */
      const fallback = typeof SFX_SYNTH_FALLBACKS === "undefined" ? null : SFX_SYNTH_FALLBACKS[key];
      if (fallback) window.archiveAudio?.play(fallback);
      return null;
    }

    // 같은 효과음이 한 프레임에 여러 번 겹쳐 터지는 것을 막는다.
    const tuning = globalThis.ARCHIVE_AUDIO_TUNING?.sfx;
    const fileTuning = tuning?.files?.[key] ?? {};
    const throttleMs = fileTuning.throttleMs ?? tuning?.throttleMs ?? 60;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) || 0) < throttleMs) return null;
    this.lastPlayed.set(key, now);

    this.bus.resume();
    return this.bus.scene.sound.play(key, {
      volume: this.bus.channelVolume("sfx") * (fileTuning.gain ?? 1),
      rate: fileTuning.rate ?? 1,
      ...config,
    });
  }
}

const sfxPlayer = new SfxPlayer(gameEvents, audioBus, SFX_EVENT_MAP);
