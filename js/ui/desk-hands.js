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
 */

/* 짧게 톡 눌렀다 뗐을 때도 한 박자는 보이도록 조금 늦게 세운다. */
const HAND_SETTLE_MS = 130;
/* 클릭은 누르고 있는 상태가 없으므로 이만큼만 움직이고 만다. */
const HAND_CLICK_MS = 220;

class DeskHandsView {
  constructor(dom) {
    this.hands = [dom.deskHandLeft, dom.deskHandRight].filter(Boolean);
    if (this.hands.length === 0) return;

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
}

const deskHandsView = new DeskHandsView(UI);
