/*
 * A(비주얼) 전용 — 캔버스 안의 스테이지명·목표·타이머 텍스트.
 * 남은 시간은 TIMER_TICK으로만 받는다. 타이머 계산은 씬이 한다.
 */

class HudView {
  constructor(events, geometry, theme) {
    this.events = events;
    this.geo = geometry;
    this.theme = theme;
    this.stageLabel = null;
    this.goalLabel = null;
    this.timerText = null;

    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => this.build(scene));
    this.events.on(GAME_EVENTS.STAGE_START, () => this.reset());
    this.events.on(GAME_EVENTS.TIMER_TICK, (payload) => this.setRemaining(payload.remainingMs));
    this.events.on(GAME_EVENTS.TIMER_WARNING, () => this.showWarning());
  }

  build(scene) {
    const { hud } = this.geo;

    this.stageLabel = scene.add
      .text(hud.stageLabel.x, hud.stageLabel.y, STRINGS.stage.label, this.theme.label(this.theme.text.stageLabel))
      .setScrollFactor(0)
      .setDepth(this.theme.depth.hud);

    this.goalLabel = scene.add
      .text(hud.goalLabel.x, hud.goalLabel.y, STRINGS.stage.goal, this.theme.label(this.theme.text.goalLabel))
      .setScrollFactor(0)
      .setDepth(this.theme.depth.hud);

    this.timerText = scene.add
      .text(hud.timer.x, hud.timer.y, this.format(BALANCE.stage.timeMs), this.theme.label(this.theme.text.timer))
      .setOrigin(hud.timer.originX, hud.timer.originY)
      .setScrollFactor(0)
      .setDepth(this.theme.depth.hud);
  }

  format(remainingMs) {
    return (Math.max(0, remainingMs) / 1000).toFixed(2);
  }

  reset() {
    this.timerText?.setText(this.format(BALANCE.stage.timeMs)).setColor(this.theme.text.timer.color);
  }

  setRemaining(remainingMs) {
    this.timerText?.setText(this.format(remainingMs));
  }

  showWarning() {
    this.timerText?.setColor(this.theme.text.timerWarning.color);
  }
}

const hudView = new HudView(gameEvents, STAGE_GEOMETRY, THEME);
