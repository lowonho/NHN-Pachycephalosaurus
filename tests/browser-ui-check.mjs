const devtoolsHost = process.argv[2] || "http://127.0.0.1:19333";
const appUrl = process.argv[3] || "http://127.0.0.1:18926/";

const pages = await fetch(`${devtoolsHost}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === "page" && entry.url.startsWith(appUrl));
if (!page) throw new Error(`검사할 페이지를 찾지 못했습니다: ${appUrl}`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const browserErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }

  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    const entry = message.params.entry;
    // 격리된 테스트 환경에서 외부 웹폰트만 막힌 경우는 게임 실행 오류가 아니다.
    const optionalFontBlocked = entry.text.includes("Failed to load resource")
      && /(?:cdn\.jsdelivr\.net|projectnoonnu\/noonfonts)/.test(entry.url || "");
    if (!optionalFontBlocked) browserErrors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ""}`);
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    browserErrors.push(message.params.args.map((argument) => argument.value || argument.description).join(" "));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result.value;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed: Boolean(passed), detail });
}

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await wait(1200);

const initial = await evaluate(`({
  gameReady: Boolean(window.archiveGame),
  phaserReady: Boolean(window.archivePhaserGame),
  cards: document.querySelectorAll('.stage-select-card[data-stage-id]').length,
  canvas: document.querySelectorAll('#game-container canvas').length
})`);
check("게임 엔진 로드", initial.gameReady && initial.phaserReady, JSON.stringify(initial));
check("7개 스테이지 카드 생성", initial.cards === 7, `${initial.cards}개`);
check("Phaser 캔버스 생성", initial.canvas === 1, `${initial.canvas}개`);

// "게임 시작" → 컷신 → 프로토콜 선택. 컷신은 SKIP으로 건너뛴다.
await evaluate("document.querySelector('#main-play-button').click()");
await evaluate("document.querySelector('#cutscene-skip-top-button').click()");
await wait(80);
const selectState = await evaluate(`({
  visible: !document.querySelector('#stage-select-screen').classList.contains('hidden'),
  enabledCards: document.querySelectorAll('.stage-select-card[data-stage-id]:not(:disabled)').length
})`);
check("메인에서 스테이지 선택 열기", selectState.visible, JSON.stringify(selectState));
check("스테이지 카드 선택 가능", selectState.enabledCards === 7, `${selectState.enabledCards}개`);

// 새 흐름은 오프닝 뒤 첫 기록 소개를 자동 재생한다. 소개 종료 뒤 설렘 스테이지가 시작된다.
await evaluate("cutsceneFlow.finish()");
await wait(180);
/*
 * 플레이는 모니터 화면 안에서 일어난다 — 모니터(#stage-select-screen)는 그대로 서 있고
 * 스크린 안쪽만 프로토콜 선택(#protocol-desktop) → 플레이(.app-shell)로 바뀐다.
 */
const startState = await evaluate(`({
  mainHidden: document.querySelector('#main-menu').classList.contains('hidden'),
  monitorVisible: !document.querySelector('#stage-select-screen').classList.contains('hidden'),
  screenMode: document.querySelector('#protocol-screen').dataset.mode,
  appVisible: !document.querySelector('.app-shell').hidden,
  appInteractive: !document.querySelector('.app-shell').hasAttribute('inert'),
  pauseVisible: !document.querySelector('#pause-button').hidden,
  hudVisible: !document.querySelector('#stage-hud').hidden,
  title: document.querySelector('#stage-hud-title').textContent,
  timer: Number(document.querySelector('#stage-hud-timer').textContent)
})`);
check(
  "모니터 안에서 스테이지 시작",
  startState.mainHidden && startState.monitorVisible && startState.screenMode === "play"
    && startState.appVisible && startState.appInteractive,
  JSON.stringify(startState)
);
check("게임 HUD 연결", startState.pauseVisible && startState.hudVisible && startState.title.includes("설렘"), startState.title);

/*
 * 모니터 스크린은 16:9(1440×810)여서 Phaser(960×540 · Scale.FIT)가 레터박스 없이 꽉 찬다.
 * 스크린 비율을 건드리면 여기서 먼저 터진다.
 */
const canvasFit = await evaluate(`(() => {
  const screen = document.querySelector('#protocol-screen').getBoundingClientRect();
  const canvas = document.querySelector('#game-container canvas').getBoundingClientRect();
  return {
    gapX: Math.round(Math.abs(screen.width - canvas.width)),
    gapY: Math.round(Math.abs(screen.height - canvas.height))
  };
})()`);
check("캔버스가 모니터 스크린을 꽉 채움", canvasFit.gapX <= 1 && canvasFit.gapY <= 1, JSON.stringify(canvasFit));

await wait(350);
const runningTimer = await evaluate("Number(document.querySelector('#stage-hud-timer').textContent)");
check("20.26초 타이머 진행", runningTimer < startState.timer, `${startState.timer} → ${runningTimer}`);

await evaluate("document.querySelector('#pause-button').click()");
await wait(80);
const pausedAt = await evaluate("Number(document.querySelector('#stage-hud-timer').textContent)");
await wait(350);
const pauseState = await evaluate(`({
  modalVisible: !document.querySelector('#pause-modal').classList.contains('hidden'),
  timer: Number(document.querySelector('#stage-hud-timer').textContent)
})`);
check("기존 일시정지 UI 연결", pauseState.modalVisible, JSON.stringify(pauseState));
check("일시정지 중 타이머 정지", Math.abs(pauseState.timer - pausedAt) <= 0.03, `${pausedAt} → ${pauseState.timer}`);

await evaluate("document.querySelector('#resume-button').click()");
await wait(250);
const resumedTimer = await evaluate("Number(document.querySelector('#stage-hud-timer').textContent)");
check("일시정지 해제", resumedTimer < pauseState.timer, `${pauseState.timer} → ${resumedTimer}`);

await evaluate("window.archivePhaserGame.scene.getScene('archive-game').finish(true, '브라우저 연결 검사')");
await wait(80);
const resultState = await evaluate(`({
  visible: !document.querySelector('#result-modal').classList.contains('hidden'),
  title: document.querySelector('#modal-title').textContent,
  copy: document.querySelector('#modal-copy').textContent,
  result: document.querySelector('#modal-result').textContent
})`);
check("개인 증언 결과 UI 연결", resultState.visible && resultState.title === "PERSONAL TESTIMONY" && resultState.result.includes("설렘"), JSON.stringify(resultState));

await evaluate("document.querySelector('#secondary-button').click()");
await wait(180);
const retryState = await evaluate(`({
  resultHidden: document.querySelector('#result-modal').classList.contains('hidden'),
  timer: Number(document.querySelector('#stage-hud-timer').textContent)
})`);
check("결과 화면 재도전", retryState.resultHidden && retryState.timer > 19.8, JSON.stringify(retryState));

const stageIds = ["maze", "gravity", "bounce", "recoil", "friction", "darkness", "rotation"];
for (const stageId of stageIds) {
  const state = await evaluate(`archiveGameBridge.start(${JSON.stringify(stageId)}); ({
    id: archiveGameBridge.currentStage?.id,
    mode: window.archivePhaserGame.scene.getScene('archive-game').mode,
    childCount: window.archivePhaserGame.scene.getScene('archive-game').children.length
  })`);
  check(`스테이지 로드: ${stageId}`, state.id === stageId && state.mode === "playing" && state.childCount > 0, JSON.stringify(state));
}

await evaluate("gameEvents.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {})");
await wait(80);
const mainState = await evaluate(`({
  mainVisible: !document.querySelector('#main-menu').classList.contains('hidden'),
  monitorHidden: document.querySelector('#stage-select-screen').classList.contains('hidden'),
  appLocked: document.querySelector('.app-shell').hasAttribute('inert'),
  hudHidden: document.querySelector('#stage-hud').hidden
})`);
check(
  "게임에서 메인으로 복귀",
  mainState.mainVisible && mainState.monitorHidden && mainState.appLocked && mainState.hudHidden,
  JSON.stringify(mainState)
);

check("브라우저 치명 오류 없음", browserErrors.length === 0, browserErrors.join(" | "));

for (const result of checks) {
  console.log(`${result.passed ? "PASS" : "FAIL"} | ${result.name}${result.detail ? ` | ${result.detail}` : ""}`);
}

socket.close();
if (checks.some((result) => !result.passed)) process.exitCode = 1;
