/*
 * C2(사운드) 전용 — 배경음악 재생과 전환.
 * BGM_EVENT_MAP에 적힌 이벤트가 오면 해당 트랙으로 크로스페이드한다.
 */

const BGM_FADE_MS = 400;

class BgmPlayer {
  constructor(events, bus, eventMap) {
    this.bus = bus;
    this.current = null;
    this.currentKey = null;

    eventMap.forEach(({ event, key, loop }) => {
      events.on(event, () => this.play(key, loop));
    });

    events.on(GAME_EVENTS.SCENE_SHUTDOWN, () => this.stop());

    // 설정에서 볼륨을 움직이면 재생 중인 트랙에도 바로 반영한다.
    events.on(GAME_EVENTS.AUDIO_VOLUME_CHANGED, () => this.applyVolume());
  }

  applyVolume() {
    this.current?.setVolume(this.bus.channelVolume("bgm"));
  }

  play(key, loop = true) {
    if (!this.bus.isReady(key) || this.currentKey === key) return;

    this.stop();
    this.bus.resume();

    this.currentKey = key;
    this.current = this.bus.scene.sound.add(key, { loop, volume: 0 });
    this.current.play();

    this.bus.scene.tweens.add({
      targets: this.current,
      volume: this.bus.channelVolume("bgm"),
      duration: BGM_FADE_MS,
    });
  }

  stop() {
    if (!this.current) return;
    const finished = this.current;

    this.bus.scene?.tweens?.add({
      targets: finished,
      volume: 0,
      duration: BGM_FADE_MS,
      onComplete: () => finished.destroy(),
    });

    this.current = null;
    this.currentKey = null;
  }
}

const bgmPlayer = new BgmPlayer(gameEvents, audioBus, BGM_EVENT_MAP);
