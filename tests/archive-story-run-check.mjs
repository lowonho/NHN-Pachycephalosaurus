import assert from "node:assert/strict";
import "../js/content/scenario-data.js";
import { STAGES } from "../js/archive/data.mjs";
import { MEMORY_FRAGMENTS } from "../js/archive/fragments.mjs";
import { createArchiveRunState, TOTAL_TIME_MS } from "../js/archive/run-state.mjs";
import { PHYSICS } from "../js/archive/level-data.mjs";

const story = globalThis.SCENARIO_DATA;
const ids = STAGES.map((stage) => stage.id);
const expectedNames = ["설렘", "기대", "긴장", "분노", "후회", "그리움", "애정"];

assert.equal(TOTAL_TIME_MS, 143000);
assert.equal(story.totalTimeMs, 143000);
assert.equal(PHYSICS.timeLimit, 20.26);
assert.equal(STAGES.length, 7);
assert.deepEqual(STAGES.map((stage) => stage.title), expectedNames);
assert.deepEqual(story.stages.map((stage) => stage.title), expectedNames);
assert.equal(story.opening.script.reduce((sum, cue) => sum + cue.durationMs, 0), 25000);
assert.ok(!story.stages.flatMap((stage) => stage.brief).some((cue) => cue.text.includes("물리법칙")));
assert.ok(ids.every((id) => MEMORY_FRAGMENTS[id]));
assert.ok(story.stages.every((stage) => stage.memoryScene.length > 0));

const run = createArchiveRunState(ids);
assert.equal(run.snapshot().totalRemainingMs, 143000);
run.consume(5000);
assert.equal(run.snapshot().totalRemainingMs, 143000, "소개/메뉴에서는 시간이 흐르지 않아야 한다");
run.beginAttempt("maze");
run.consume(10260);
assert.equal(run.snapshot().totalRemainingMs, 132740);
run.setPaused(true);
run.consume(30000);
assert.equal(run.snapshot().totalRemainingMs, 132740, "일시정지에서는 시간이 흐르지 않아야 한다");
run.setPaused(false);
run.markAttemptFragment();
run.completeAttempt(false, true);
assert.equal(run.snapshot().memoryCount, 0, "실패한 시도의 조각은 초기화해야 한다");
run.beginAttempt("maze");
run.consume(1000);
run.markAttemptFragment();
run.completeAttempt(true, true);
assert.equal(run.snapshot().memoryCount, 1);
assert.equal(run.snapshot().clearedCount, 1);
assert.equal(run.snapshot().totalRemainingMs, 131740, "재도전도 누적 시간에 포함해야 한다");

const normal = createArchiveRunState(ids);
ids.forEach((id) => {
  normal.beginAttempt(id);
  normal.consume(1000);
  normal.completeAttempt(true, false);
});
assert.equal(normal.resolveEnding(), "normal");
assert.equal(normal.snapshot().memoryCount, 0);

const trueEnding = createArchiveRunState(ids);
ids.forEach((id) => {
  trueEnding.beginAttempt(id);
  trueEnding.consume(1000);
  trueEnding.markAttemptFragment();
  trueEnding.completeAttempt(true, true);
});
assert.equal(trueEnding.resolveEnding(), "true");
assert.equal(trueEnding.snapshot().memoryCount, 7);

const failed = createArchiveRunState(ids);
failed.beginAttempt("maze");
failed.consume(143000);
assert.equal(failed.resolveEnding(), "failure");
assert.equal(failed.snapshot().totalRemainingMs, 0);

console.log("PASS | 25초 오프닝, 감정 스테이지 7개, 20.26/143초 타이머, 조각 초기화·누적, 엔딩 판정");
