/*
 * 기능(B) — 화면 전환 암전.
 *
 * 큰 화면이 바뀌는 순간(게임 시작, 컷신 시작/종료, 브리핑↔플레이) 잠깐 검게
 * 덮었다 걷는다. 무엇을 무엇으로 바꾸는지는 모른다 — swap 콜백 하나만 받아
 * 그 앞뒤를 감싼다. 언제 감쌀지는 부르는 쪽(cutscene-flow · protocol-select-flow ·
 * main-menu-flow)이 정한다.
 */

class SceneFade {
  /* #scene-fade의 opacity transition 시간과 맞춘다(css/base.css). */
  static HOLD_MS = 260;

  constructor(dom) {
    this.el = dom.sceneFade;
    // 컷신이 끝나며 곧바로 다음 컷신을 잇는 경우, 앞선 cut()이 화면을 걷지 못하게 막는다.
    this.token = 0;
  }

  /* 화면이 검게 덮인 순간 swap()을 실행하고, 다시 걷어낸다. */
  cut(swap) {
    /*
     * 자동화 테스트는 화면 흐름 메서드를 실제 사람 입력 없이 연달아 부르고
     * 그 결과를 곧바로 확인한다 — 지연이 조금이라도 끼면 다음 줄에서 아직
     * 안 끝난 상태를 보게 된다. 그래서 이 플래그가 서 있으면 완전히 동기로 뛴다.
     */
    if (!this.el || globalThis.ARCHIVE_DISABLE_TRANSITIONS) {
      swap?.();
      return Promise.resolve();
    }

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 0 : SceneFade.HOLD_MS;

    this.token += 1;
    const myToken = this.token;
    this.el.classList.add("is-active");

    return SceneFade.wait(hold).then(() => {
      swap?.();
      // 다음 프레임에 걷어야 방금 그린 새 화면이 걷히는 순간부터 보인다.
      requestAnimationFrame(() => {
        if (this.token === myToken) this.el.classList.remove("is-active");
      });
    });
  }

  static wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

const sceneFade = new SceneFade(UI);
