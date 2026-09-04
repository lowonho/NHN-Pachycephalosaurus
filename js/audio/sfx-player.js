/*
 * C2(사운드) 전용 — 이벤트를 구독해 효과음을 재생한다.
 *
 * 기능 코드는 이 파일의 존재를 모른다. 재생할 파일이 아직 없으면 조용히 무시하므로
 * 오디오 에셋을 하나씩 채워 넣는 동안에도 게임은 정상 동작한다.
 */

const SFX_THROTTLE_MS = 60;

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

    // 명령을 인식한 직후에는 BGM을 잠깐 낮춰 다음 발화가 잘 들리게 한다.
    events.on(GAME_EVENTS.COMMAND_RECOGNIZED, () => this.bus.duck());
  }

  play(key, config = {}) {
    if (!this.bus.isReady(key)) return null;

    // 같은 효과음이 한 프레임에 여러 번 겹쳐 터지는 것을 막는다.
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) || 0) < SFX_THROTTLE_MS) return null;
    this.lastPlayed.set(key, now);

    this.bus.resume();
    return this.bus.scene.sound.play(key, {
      volume: this.bus.channelVolume("sfx"),
      ...config,
    });
  }
}

const sfxPlayer = new SfxPlayer(gameEvents, audioBus, SFX_EVENT_MAP);
