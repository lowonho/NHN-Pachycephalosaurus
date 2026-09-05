/*
 * 기능(B) — 책상 위 양손.
 *
 * 조작하는 동안에만 타자를 치듯 움직이고, 손을 떼면 그 자리에 선다.
 * 어떤 키든 상관없이 양손이 함께 움직인다 — 키 위치를 손에 대응시키지 않는다.
 *
 * 움직임 자체는 CSS가 맡는다(css/protocol-select.css의 .scene-hand[data-typing]).
 * 좌우 주기와 시작 지점을 어긋나게 둬서 두 손이 붙어 움직이지 않는다.
 * 이 파일은 "지금 조작 중인가"만 판단해 data-typing을 붙였다 뗀다.
 *
 * 누르고 있는 키를 세는 방식이다. keydown 한 번만 보고 움직이면
 * 방향키를 꾹 누르고 이동하는 동안 손이 멈춰 버린다.
 *
 * 타자 말고 두 가지 연출 자세가 더 있다 — 죽으면 주먹으로 키보드를 샷건 치고,
 * 클리어하면 따봉을 든다. 다시 소환되든 목숨을 잃고 판이 끝나든 죽는 건
 * 매한가지라 둘 다 샷건이다. 이건 스테이지 흐름
 * 이벤트를 구독해서 띄운다(playPose). 책상·키보드·손은 미니게임을 하는 동안에도
 * 모니터 밖에 그대로 서 있으므로(protocol-select-flow.js의 showScreen)
 * 두 연출 모두 플레이 중에 보인다.
 */

/* 짧게 톡 눌렀다 뗐을 때도 한 박자는 보이도록 조금 늦게 세운다. */
const HAND_SETTLE_MS = 130;
/* 클릭은 누르고 있는 상태가 없으므로 이만큼만 움직이고 만다. */
const HAND_CLICK_MS = 220;
/* 연출 자세가 떠 있는 시간. css의 애니메이션 길이와 같아야 한다. */
const HAND_POSE_MS = 900;

class DeskHandsView {
  constructor(dom, events) {
    this.hands = [dom.deskHandLeft, dom.deskHandRight].filter(Boolean);
    if (this.hands.length === 0) return;

    /*
     * 연출 자세. 주먹은 죽었을 때다 — 제한시간 안에서 죽고 다시 소환될 때
     * (STAGE_RESPAWN, 신호는 엔진의 MINI.summon에서 시작해 게임 브리지를 거쳐 온다)와
     * 그대로 판이 끝나 목숨을 잃을 때(STAGE_FAIL) 둘 다다. 스테이지를 새로 시작할
     * 때가 아니다(그건 STAGE_START이고, 여기서는 쓰지 않는다).
     *
     * 판이 끝나도 결과 모달은 모니터 안에만 뜨므로(css/protocol-select.css의
     * .screen-overlays) 책상 위 손은 가려지지 않는다 — 따봉과 같은 자리다.
     */
    this.poses = [dom.deskPoseFists, dom.deskPoseThumbs].filter(Boolean);
    this.poseHandle = 0;
    events?.on(GAME_EVENTS.STAGE_RESPAWN, () => this.playPose(dom.deskPoseFists));
    events?.on(GAME_EVENTS.STAGE_FAIL, () => this.playPose(dom.deskPoseFists));
    events?.on(GAME_EVENTS.STAGE_CLEAR, () => this.playPose(dom.deskPoseThumbs));

    // 누르고 있는 키. keyup을 놓쳐도 blur에서 한 번에 턴다.
    this.pressed = new Set();
    this.settleHandle = 0;

    window.addEventListener("keydown", (event) => {
      // 꾹 누르고 있을 때 오는 자동 반복은 셀 필요가 없다(이미 눌린 키다).
      if (event.repeat) return;
      this.pressed.add(event.code);
      this.setTyping(true);
    });

    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
      if (this.pressed.size === 0) this.settle(HAND_SETTLE_MS);
    });

    window.addEventListener("pointerdown", () => {
      this.setTyping(true);
      this.settle(HAND_CLICK_MS);
    });

    // 창을 벗어나면 keyup이 오지 않는다. 손이 움직이는 채로 굳지 않게 턴다.
    window.addEventListener("blur", () => this.release());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.release();
    });
  }

  settle(delay) {
    window.clearTimeout(this.settleHandle);
    this.settleHandle = window.setTimeout(() => {
      if (this.pressed.size === 0) this.setTyping(false);
    }, delay);
  }

  release() {
    this.pressed.clear();
    window.clearTimeout(this.settleHandle);
    this.setTyping(false);
  }

  setTyping(typing) {
    this.hands.forEach((hand) => {
      if (typing) {
        // 다시 치기 시작하면 내려앉는 중이던 자세는 버리고 애니메이션에 넘긴다.
        hand.style.transition = "";
        hand.style.transform = "";
        hand.dataset.typing = "";
      } else if (hand.dataset.typing !== undefined) {
        this.settleToRest(hand);
      }
    });
  }

  /*
   * 멈출 때 제자리로 내려앉힌다.
   *
   * data-typing만 지우면 손이 마지막 자세에서 제자리로 툭 튄다 — 위아래로
   * 28px까지 벌어져 있어서 눈에 띈다. css의 transition만으로는 못 잡는다:
   * 애니메이션이 도는 내내 transform의 계산값은 none이라, 애니메이션이 빠져도
   * 계산값이 바뀌지 않아 전환이 시작되지 않는다.
   *
   * 그래서 지금 자세를 인라인으로 붙잡아 두고(전환은 잠시 꺼 둔다) 애니메이션을
   * 뗀 다음, 프레임을 넘겨 인라인을 지운다. 이때 비로소 계산값이 바뀌면서
   * css의 transition이 걸린다.
   */
  settleToRest(hand) {
    const pose = window.getComputedStyle(hand).transform;
    delete hand.dataset.typing;
    if (pose === "none") return;

    hand.style.transition = "none";
    hand.style.transform = pose;
    window.requestAnimationFrame(() => {
      hand.style.transition = "";
      window.requestAnimationFrame(() => {
        hand.style.transform = "";
      });
    });
  }

  /*
   * 연출 자세 한 번. 뜨는 동안 타자 손은 숨는다 — 안 그러면 손이 두 쌍 보인다.
   *
   * data-playing으로 애니메이션을 건다. hidden만 벗겨도 애니메이션은 처음부터
   * 도는데(display가 돌아오면 다시 시작한다), 연달아 두 번 부를 때 —
   * 예를 들어 클리어하자마자 재시도 — 앞의 것이 돌던 자리에서 이어져 버린다.
   * 속성을 뗐다 붙이면서 사이에 강제로 한 번 재보면 확실히 처음부터 돈다.
   */
  playPose(pose) {
    if (!pose) return;

    window.clearTimeout(this.poseHandle);
    this.poses.forEach((other) => {
      other.hidden = true;
      delete other.dataset.playing;
    });

    pose.hidden = false;
    void pose.offsetWidth;
    pose.dataset.playing = "";
    this.hands.forEach((hand) => {
      hand.hidden = true;
    });

    this.poseHandle = window.setTimeout(() => {
      pose.hidden = true;
      delete pose.dataset.playing;
      this.hands.forEach((hand) => {
        hand.hidden = false;
      });
    }, HAND_POSE_MS);
  }
}

const deskHandsView = new DeskHandsView(UI, gameEvents);
