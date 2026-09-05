import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const temp = await mkdtemp(join(tmpdir(), "archive-recovery-"));
const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg" };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, "." + (new URL(req.url, "http://localhost").pathname === "/" ? "/index.html" : decodeURIComponent(new URL(req.url, "http://localhost").pathname)));
    if (!path.startsWith(root + "/") && !path.startsWith(root + "\\")) throw Error("Outside root");
    res.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream");
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const appUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${temp}`, "--window-size=1440,1000", "about:blank",
], { windowsHide: true, stdio: "ignore" });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(temp, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch { await wait(100); }
  }
  assert.ok(port, "Chrome startup");
  console.log("Chrome ready", port);
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
  socket = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  const pending = new Map();
  const errors = [];
  let id = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(Error(message.error.message)); else request.done(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const requestId = ++id;
    pending.set(requestId, { done, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
    const timer = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 15000);
    timer.unref();
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*", "*cdn.jsdelivr.net*"] });
  console.log("Opening", appUrl);
  await send("Page.navigate", { url: appUrl });
  for (let i = 0; i < 100 && !await evaluate("Boolean(window.archiveGame)"); i++) await wait(100);
  assert.equal(await evaluate("document.querySelectorAll('[data-stage-id]').length"), 7);
  const screen = async (name) => {
    await wait(150);
    const { data } = await send("Page.captureScreenshot");
    const path = join(temp, `${name}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log("SCREENSHOT", path);
  };
  await screen("main");
  /*
   * 메인 화면 → 컷신 → 프로토콜 선택. "게임 시작"은 이제 컷신을 먼저 띄우므로
   * SKIP으로 건너뛰어야 프로토콜 선택 화면에 닿는다.
  */
  await evaluate("document.querySelector('#main-play-button').click()");
  await screen("opening");
  await evaluate("document.querySelector('#cutscene-skip-top-button').click()");
  // 오프닝 뒤 첫 기록 소개가 자동으로 열리며, 이 소개를 끝내야 실제 플레이가 시작된다.
  await screen("stage-intro");
  await evaluate("cutsceneFlow.finish(); gameEvents.emit(GAME_EVENTS.REQUEST_STAGE_SELECT, {})");
  /*
   * 이 스위트는 씬을 실시간이 아니라 update()로 한 걸음씩 몰기 때문에
   * 회수/복구 검증 단계에서는 run-state만 잠시 멈추고 타이머는 별도 항목에서 검사한다.
   */
  await screen("records");
  const start = async (stage) => evaluate(`protocolSelectFlow.launchStage(${JSON.stringify(stage)}); window.archiveRun.setPaused(true); window.testScene = window.archivePhaserGame.scene.getScene('archive-game'); window.archivePhaserGame.loop.sleep();`);
  const continueToRecords = async () => {
    const saved = await evaluate("window.archiveProgress.summary()");
    await evaluate("modalFlow.success ? document.querySelector('#primary-button').click() : document.querySelector('#secondary-button').click(); while (cutsceneFlow.isOpen()) cutsceneFlow.finish()");
    assert.deepEqual(await evaluate(`({
      resultHidden: UI.modal.classList.contains('hidden'),
      recordsVisible: !UI.stageSelectScreen.classList.contains('hidden'),
      gameLocked: UI.appShell.hasAttribute('inert'),
      hudHidden: UI.stageHud.hidden,
      stopped: testScene.mode === 'idle',
      cardFocused: Boolean(document.activeElement?.dataset.stageId),
    })`), { resultHidden: true, recordsVisible: true, gameLocked: true, hudHidden: true, stopped: true, cardFocused: true });
    assert.deepEqual(await evaluate("window.archiveProgress.summary()"), saved);
  };
  const returnToRecords = async () => {
    const saved = await evaluate("window.archiveProgress.summary()");
    await evaluate("gameEvents.emit(GAME_EVENTS.REQUEST_STAGE_SELECT, {})");
    assert.deepEqual(await evaluate(`({
      resultHidden: UI.modal.classList.contains('hidden'),
      recordsVisible: !UI.stageSelectScreen.classList.contains('hidden'),
      gameLocked: UI.appShell.hasAttribute('inert'),
      hudHidden: UI.stageHud.hidden,
      stopped: testScene.mode === 'idle',
      cardFocused: Boolean(document.activeElement?.dataset.stageId),
    })`), { resultHidden: true, recordsVisible: true, gameLocked: true, hudHidden: true, stopped: true, cardFocused: true });
    assert.deepEqual(await evaluate("window.archiveProgress.summary()"), saved);
  };
  await start("maze");
  await evaluate("testScene.pausedByMenu = true; window.archivePhaserGame.loop.wake()");
  await screen("gameplay");
  await evaluate("window.archivePhaserGame.loop.sleep(); testScene.pausedByMenu = false");
  const before = await evaluate("testScene.remaining");
  const totalBeforePause = await evaluate("window.archiveRun.snapshot().totalRemainingMs");
  await evaluate("archiveGameBridge.pause(); testScene.update(0, 1000)");
  assert.equal(await evaluate("testScene.remaining"), before);
  assert.equal(await evaluate("window.archiveRun.snapshot().totalRemainingMs"), totalBeforePause);
  await evaluate("archiveGameBridge.resume(); Object.assign(testScene.state.ball, { x: 900, y: 420, vx: 190, input: 'right' }); testScene.update(0, 25)");
  assert.ok(await evaluate("window.archiveRun.snapshot().totalRemainingMs") < totalBeforePause);
  assert.ok(Math.abs(await evaluate("testScene.remaining") - (before - 1.025)) < 0.0001);
  assert.equal(await evaluate("testScene.timePenalty"), 1);
  assert.equal(await evaluate("testScene.state.ball.collisions"), 1);
  assert.deepEqual(await evaluate(`(() => {
    const button = document.querySelector('[data-direction=right]');
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, bubbles: true }));
    const pressed = testScene.state.ball.input;
    button.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, bubbles: true }));
    return { buttons: UI.touchButtons.length, pressed, released: testScene.state.ball.input };
  })()`), { buttons: 5, pressed: 'right', released: null });
  assert.ok((await evaluate("UI.stageHudPenalty.textContent")).includes('−1.00'));
  await evaluate("for (let i = 0; i < 60; i++) testScene.update(0, 16)");
  assert.equal(await evaluate("testScene.timePenalty"), 1);
  assert.ok(Math.abs(await evaluate("testScene.elapsed") - 0.985) < 0.001);
  await evaluate("testScene.finish(true)");
  assert.equal(await evaluate("UI.modalTitle.textContent"), "PERSONAL TESTIMONY");
  assert.equal(await evaluate("window.archiveProgress.status('maze')"), "PARTIALLY RESTORED");
  await continueToRecords();
  await evaluate("document.querySelector('[data-stage-id=gravity]').click(); cutsceneFlow.finish()");
  assert.equal(await evaluate("testScene.stageId"), "gravity");
  assert.equal(await evaluate("testScene.mode"), "playing");
  await evaluate("testScene.pausedByMenu = true; window.archivePhaserGame.loop.wake()");
  await screen("gravity-course");
  assert.equal(await evaluate("document.querySelector('#stage-hud-fragment').textContent"), '◇ MEMORY 0/1');
  assert.equal(await evaluate("testScene.state.platforms.length"), 12);
  assert.equal(await evaluate("testScene.children.list.some(child => typeof child.text === 'string' && /MEMORY|발판 끝|^0[1-3]$/.test(child.text))"), false);
  await evaluate("window.archivePhaserGame.loop.sleep(); testScene.pausedByMenu = false");
  const totalBeforeFall = await evaluate("window.archiveRun.snapshot().totalRemainingMs");
  await evaluate("Object.assign(testScene.state, { x: 430, y: 565, vy: 180, onGround: false, support: null }); testScene.update(0, 25)");
  assert.equal(await evaluate("UI.modal.classList.contains('hidden')"), true);
  assert.equal(await evaluate("testScene.mode"), "done");
  assert.equal(await evaluate("window.archiveProgress.status('gravity')"), 'DAMAGED');
  const totalDuringRetry = await evaluate("window.archiveRun.snapshot().totalRemainingMs");
  await wait(520);
  assert.equal(await evaluate("testScene.stageId"), "gravity");
  assert.equal(await evaluate("testScene.mode"), "playing");
  assert.equal(await evaluate("testScene.remaining"), 20.26);
  assert.equal(await evaluate("testScene.fragmentCollected"), false);
  assert.equal(await evaluate("window.archiveRun.snapshot().totalRemainingMs"), totalDuringRetry);
  assert.ok(totalDuringRetry < totalBeforeFall);
  await evaluate("gameEvents.emit(GAME_EVENTS.REQUEST_MAIN_MENU, {})");
  assert.equal(await evaluate("UI.mainMenu.classList.contains('hidden')"), false);
  assert.equal(await evaluate("UI.stageSelectScreen.classList.contains('hidden')"), true);
  await start('bounce');
  await evaluate("testScene.pausedByMenu = true; window.archivePhaserGame.loop.wake()");
  await screen('bounce-course');
  await evaluate("window.archivePhaserGame.loop.sleep(); testScene.pausedByMenu = false");
  for (const memory of [false, true]) {
    await start('bounce');
    const route = await evaluate(`(() => {
      for (let i = 0; i < 1216 && testScene.mode === 'playing'; i++) {
        const s = testScene.state;
        let target = { p1: 145, p2: 265, p3: 447, p4: 583, p5: 675, p6: 810 }[s.lastLanding] ?? 211;
        if (${memory} && !testScene.fragmentCollected && s.lastLanding === 'p4') target = 447;
        archiveGame.release('left'); archiveGame.release('right');
        if (Math.abs(target - s.x) >= 2) archiveGame.press(target > s.x ? 'right' : 'left');
        testScene.update(0, 1000 / 60);
      }
      return { mode: testScene.mode, fragment: testScene.fragmentCollected, title: UI.modalTitle.textContent };
    })()`);
    assert.deepEqual(route, { mode: 'done', fragment: memory, title: memory ? 'SHARED TESTIMONY' : 'PERSONAL TESTIMONY' });
  }
  await start('bounce');
  await evaluate("Object.assign(testScene.state, { x: 575, y: 560, vy: 150 }); testScene.update(0, 25)");
  assert.equal(await evaluate("UI.modal.classList.contains('hidden')"), true);
  await wait(520);
  assert.equal(await evaluate("testScene.mode"), "playing");
  assert.equal(await evaluate('testScene.state.bounces'), 0);
  assert.equal(await evaluate('testScene.fragmentCollected'), false);
  for (const stage of ["maze", "gravity", "bounce", "recoil", "friction", "darkness", "rotation"]) {
    await start(stage);
    assert.equal(await evaluate("testScene.timePenalty"), 0, `${stage}: time penalty reset`);
    assert.equal(await evaluate("UI.stageHudPenalty.hidden"), stage !== 'maze');
    assert.equal(await evaluate("testScene.fragmentCollected"), false, `${stage}: retry resets fragment`);
    // Drive each stage's existing update method through the real collection adapter.
    await evaluate(`(() => {
      const s = testScene.state, f = testScene.fragment;
      if (testScene.stageId === 'recoil') {
        s.bullets.push({ x: f.x - 35, y: f.y, vx: 2800, vy: 0, object: testScene.add.circle(0, 0, 5) });
      } else if (testScene.stageId === 'rotation') {
        s.angle = -2.1;
      } else {
        const body = testScene.stageId === 'maze' ? s.ball : s;
        body.x = f.x; body.y = f.y; body.vx = 0; body.vy = 0;
      }
      testScene.update(0, 25);
    })()`);
    assert.equal(await evaluate("testScene.fragmentCollected"), true, `${stage}: physical pickup`);
    assert.ok((await evaluate("document.querySelector('#stage-hud-fragment').textContent")).includes("1/1"));
    await evaluate("testScene.finish(true)");
    assert.equal(await evaluate("UI.modalTitle.textContent"), "SHARED TESTIMONY");
    assert.equal(await evaluate(`window.archiveProgress.status(${JSON.stringify(stage)})`), "FULLY RESTORED");
  }
  assert.equal(await evaluate("window.archiveProgress.summary().recoveryRate"), 100);
  assert.equal(await evaluate("window.archiveProgress.summary().ending"), "complete");
  await screen("result");
  await evaluate("document.querySelector('#primary-button').click(); cutsceneFlow.finish()");
  assert.equal(await evaluate("UI.cutsceneChapter.textContent"), "ENDING // MULTIPLE WITNESSES");
  await evaluate("cutsceneFlow.finish(); protocolSelectFlow.open()");
  await start("maze");
  await evaluate("testScene.state.ball.x = testScene.fragment.x; testScene.state.ball.y = testScene.fragment.y; testScene.update(0, 16); testScene.remaining = 0.001; testScene.update(0, 16)");
  assert.equal(await evaluate("UI.modal.classList.contains('hidden')"), true);
  assert.equal(await evaluate("window.archiveProgress.status('maze')"), "FULLY RESTORED");
  await wait(520);
  assert.equal(await evaluate("testScene.fragmentCollected"), false);
  await returnToRecords();
  await start('maze');
  await evaluate("testScene.remaining = 0.5; Object.assign(testScene.state.ball, { x: 900, y: 420, vx: 190, input: 'right' }); testScene.update(0, 25)");
  assert.equal(await evaluate("UI.modal.classList.contains('hidden')"), true);
  assert.equal(await evaluate("testScene.remaining"), 0);
  assert.equal(await evaluate("testScene.timePenalty"), 1);
  await wait(520);
  assert.equal(await evaluate("testScene.timePenalty"), 0);
  await returnToRecords();
  await screen("restored-records");
  await start("maze");
  await evaluate("window.archiveRun.setPaused(false); window.dispatchEvent(new CustomEvent('archive-play-time', { detail: { deltaMs: 143000 } }))");
  assert.equal(await evaluate("UI.cutsceneChapter.textContent"), "ENDING // ARCHIVE COLLAPSED");
  assert.equal(await evaluate("testScene.mode"), "idle");
  assert.equal(await evaluate("window.archiveRun.snapshot().totalRemainingMs"), 0);
  await evaluate("cutsceneFlow.finish()");
  await send("Page.reload");
  await wait(1200);
  assert.equal(await evaluate("window.archiveProgress.summary().fragmentCount"), 7);
  assert.equal(await evaluate("document.querySelectorAll('[data-recovery=full]').length"), 7);
  // The generated bundle must also boot when the game is opened as a local file.
  await send("Page.navigate", { url: new URL(`file:///${root.replaceAll('\\', '/')}/index.html`).href });
  await wait(1200);
  assert.equal(await evaluate("Boolean(window.archiveGame)"), true);
  assert.equal(await evaluate("document.querySelectorAll('[data-stage-id]').length"), 7);
  assert.deepEqual(errors, []);
  console.log("PASS | browser: collision time deduction, no repeat contact penalty, elapsed time, penalty loss/reset, chapter navigation, 7 pickups, pause, persistence, file:// boot, no runtime errors");
} finally {
  socket?.close();
  browser.kill();
  server.closeAllConnections();
  server.close();
}
