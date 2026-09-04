/*
 * A(비주얼) 전용 — 피치 조정 모달 가운데 파형.
 *
 * 예전에는 .listening이 붙는 동안 CSS 애니메이션이 혼자 돌았다. 마이크가 아무것도
 * 못 듣고 있어도 막대가 똑같이 춤춰서 "수음이 되고 있나?"를 화면으로 확인할 수 없었다.
 * 이제는 VOICE_INPUT이 실어오는 실제 마이크 버퍼만 보고 막대 높이를 정한다.
 *
 * 음성 데이터는 이 프레임에서 높이로만 쓰고 남기지 않는다.
 */

class CalibrationMeterView {
  constructor(events, dom, config) {
    this.root = dom.calibrationVisual;
    this.bars = this.root ? [...this.root.querySelectorAll("span")] : [];

    // 게이트(무음 판정선)에서 바닥, 게임이 "큰 소리"로 보는 세기에서 천장.
    this.rmsGate = config.rmsGate;
    this.rmsSpan = Math.max(0.001, config.movementVolumeMaxRms - config.rmsGate);

    // 막대별 현재 표시 높이(0~1). 올라갈 때는 빠르게, 내려올 때는 천천히 따라간다.
    this.levels = new Array(this.bars.length).fill(0);
    this.written = new Array(this.bars.length).fill(-1);
    this.settled = true;
    this.pickingUp = false;

    if (this.bars.length) {
      this.readBarRange();
      // 막대 높이 범위는 CSS(반응형 분기 포함)가 정한다. 폭이 바뀌면 다시 읽는다.
      window.addEventListener("resize", () => this.readBarRange());
      events.on(GAME_EVENTS.VOICE_INPUT, (payload) => this.update(payload));
    }
  }

  readBarRange() {
    const styles = getComputedStyle(this.root);
    this.minHeight = parseFloat(styles.getPropertyValue("--bar-min")) || 8;
    this.maxHeight = parseFloat(styles.getPropertyValue("--bar-max")) || 76;
    this.written.fill(-1);
  }

  /*
   * 버퍼를 막대 수만큼 잘라 구간별 RMS를 낸다. 가운데가 높게 보이도록 완만한
   * 봉투(envelope)를 곱하지만, 소리가 없으면 봉투와 무관하게 전부 바닥이다.
   */
  update({ samples, rms = 0 }) {
    if (!samples?.length) return;

    const listening = this.root.classList.contains("listening");
    const heard = listening && rms >= this.rmsGate;

    // 듣지 않는 동안 이미 다 내려가 있으면 매 프레임 손댈 필요가 없다.
    if (!heard && this.settled) return;

    const count = this.bars.length;
    const chunk = Math.floor(samples.length / count) || 1;
    let quiet = true;

    for (let i = 0; i < count; i += 1) {
      let target = 0;

      if (heard) {
        const start = i * chunk;
        const end = Math.min(samples.length, start + chunk);
        let sum = 0;
        for (let s = start; s < end; s += 1) sum += samples[s] * samples[s];

        const segmentRms = Math.sqrt(sum / Math.max(1, end - start));
        // 조용한 말소리도 눈에 보이게 sqrt로 한 번 들어올린다(귀에 들리는 크기에 가깝다).
        const norm = Math.min(1, Math.max(0, (segmentRms - this.rmsGate) / this.rmsSpan));
        const loudness = Math.sqrt(norm);
        const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / count);
        target = Math.min(1, loudness * envelope);
      }

      const previous = this.levels[i];
      const follow = target > previous ? 0.55 : 0.12;
      const level = previous + (target - previous) * follow;
      this.levels[i] = level < 0.004 ? 0 : level;
      if (this.levels[i] > 0) quiet = false;

      const height = Math.round(this.minHeight + (this.maxHeight - this.minHeight) * level);
      if (height !== this.written[i]) {
        this.bars[i].style.height = `${height}px`;
        this.written[i] = height;
      }
    }

    this.settled = !heard && quiet;
    this.setPickingUp(heard);
  }

  setPickingUp(picking) {
    if (picking === this.pickingUp) return;
    this.pickingUp = picking;
    this.root.classList.toggle("picking-up", picking);
  }
}

const calibrationMeterView = new CalibrationMeterView(gameEvents, UI, BALANCE.voice);
