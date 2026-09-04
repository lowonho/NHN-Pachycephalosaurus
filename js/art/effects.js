/*
 * A(비주얼) 전용 — 카메라 연출.
 * 씬은 "무슨 일이 일어났는지"만 알리고, 흔들지 번쩍일지는 여기서 정한다.
 */

class CameraEffects {
  constructor(events, theme) {
    this.events = events;
    this.theme = theme;
    this.scene = null;

    this.events.on(GAME_EVENTS.SCENE_CREATE, ({ scene }) => {
      this.scene = scene;
    });
    this.events.on(GAME_EVENTS.PLAYER_HIT_OBSTACLE, () => this.hit());
    this.events.on(GAME_EVENTS.STAGE_CLEAR, () => this.clear());
    this.events.on(GAME_EVENTS.STAGE_FAIL, () => this.fail());
  }

  get camera() {
    return this.scene?.cameras?.main || null;
  }

  hit() {
    const { duration, intensity } = this.theme.motion.hitShake;
    this.camera?.shake(duration, intensity);
  }

  clear() {
    const { duration, r, g, b } = this.theme.motion.clearFlash;
    this.camera?.flash(duration, r, g, b);
  }

  fail() {
    const { duration, intensity } = this.theme.motion.failShake;
    this.camera?.shake(duration, intensity);
  }
}

const cameraEffects = new CameraEffects(gameEvents, THEME);
