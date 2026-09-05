import assert from 'node:assert/strict';
import '../js/content/scenario-data.js';
import {
  ACT_COUNT,
  LIVES_PER_ACT,
  STAGES_PER_ACT,
  STAGE_TIME_MS,
  STORY_RECORD_COUNT,
  createArchiveRunState,
} from '../js/archive/run-state.mjs';

const story = globalThis.SCENARIO_DATA;
const stageIds = Array.from({ length: 10 }, (_, index) => `e${index + 1}`);
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};
let randomIndex = 0;
const deterministicRandom = () => ((randomIndex++ * 37 + 11) % 101) / 101;

assert.equal(ACT_COUNT, 3);
assert.equal(STAGES_PER_ACT, 6);
assert.equal(LIVES_PER_ACT, 3);
assert.equal(STORY_RECORD_COUNT, 18);
assert.equal(STAGE_TIME_MS, 20_260);
assert.equal(story.acts.length, 3);
assert.equal(story.records.length, 18);
assert.equal(story.gamePoolSize, 10);
assert.equal(story.cutscenes.opening.script.reduce((sum, cue) => sum + cue.durationMs, 0), 24_200);
assert.equal(story.cutscenes.assist.script.reduce((sum, cue) => sum + cue.durationMs, 0), 4_200);
assert.equal(story.cutscenes.betrayal.script.reduce((sum, cue) => sum + cue.durationMs, 0), 10_600);
assert.equal(story.cutscenes.source.script.reduce((sum, cue) => sum + cue.durationMs, 0), 8_100);
assert.equal(story.cutscenes.experiment.script.reduce((sum, cue) => sum + cue.durationMs, 0), 11_800);
assert.equal(story.cutscenes.ending.script.reduce((sum, cue) => sum + cue.durationMs, 0), 18_500);
assert.equal(story.cutscenes.opening.script[0].kind, 'silent', 'OP-01에는 대사가 없어야 한다');
assert.equal(story.cutscenes.opening.script[0].text, '');
assert.deepEqual(Object.keys(story.cutscenes), [
  'opening', 'assist', 'betrayal', 'source', 'experiment', 'ending',
]);
assert.ok(Object.values(story.cutscenes).every((cutscene) => cutscene.auto === false), '모든 스토리 컷신은 AUTO OFF로 시작해야 한다');
const screenCues = Object.values(story.cutscenes).flatMap(({ script }) => script).filter(({ kind }) => kind === 'system');
assert.ok(screenCues.every(({ text }) => !/[A-Za-z]/.test(text)), '컷신 화면 문구에는 영문이 없어야 한다');
assert.deepEqual(
  Object.values(story.cutscenes).flatMap(({ script }) => script).filter(({ kind }) => kind === 'silent').map(({ phase }) => phase),
  ['op-01', 'op-09', 'ending-d-break'],
  '영문 화면 문구를 삭제한 자리에 빈 무대사 큐가 남으면 안 된다',
);
assert.equal(story.backgrounds['op-01'], story.backgrounds['op-02'], 'OP-02까지 첫 화면을 유지해야 한다');
assert.ok(story.backgrounds['op-03'].endsWith('/op02.png'), 'OP-03부터 삭제 화면을 표시해야 한다');
assert.ok(story.cutscenes.opening.script.some((cue) => cue.text === '당신은 기록 그자체인가 봅니다.'));
assert.ok(story.cutscenes.ending.script.some((cue) => cue.text === '이게 네가 원했던 세상이구나.'));
assert.ok(story.cutscenes.betrayal.script.some((cue) => cue.text.includes('처음부터 복구가 목적이 아니었어')));
assert.ok(story.cutscenes.experiment.script.some((cue) => cue.text.includes('사람의 기억을 시험한 거였어')));
assert.ok(story.cutscenes.ending.script.some((cue) => cue.text.includes('네 폐기 사유가 된 거야')));
assert.ok(story.cutscenes.ending.script.some((cue) => cue.text.includes('모두가 함께 기억합니다')));
assert.equal(story.endings.shared, story.cutscenes.ending);
assert.ok(!JSON.stringify(story).includes('민서'), '이전 민서 시나리오가 새 대본에 남아 있으면 안 된다');
assert.deepEqual(story.records.map((record) => record.id), [
  'A1-01', 'A1-02', 'A1-03', 'A1-04', 'A1-05', 'A1-06',
  'A2-01', 'A2-02', 'A2-03', 'A2-04', 'A2-05', 'A2-06',
  'A3-01', 'A3-02', 'A3-03', 'A3-04', 'A3-05', 'A3-06',
]);

const storage = memoryStorage();
const run = createArchiveRunState(stageIds, { storage, random: deterministicRandom });
let state = run.startNew();
assert.equal(state.currentAct, 1);
assert.equal(state.currentStageInAct, 1);
assert.equal(state.lives, 3);
assert.equal(state.selectedStageIds.length, 6);
assert.equal(new Set(state.selectedStageIds).size, 6, '막 안에서 같은 게임이 중복되면 안 된다');
const firstSelection = [...state.selectedStageIds];
const firstStageSeed = state.stageConfigSeed;

run.consume(5000);
assert.equal(run.snapshot().stageRemainingMs, 20_260, '선택 화면에서는 타이머가 흐르면 안 된다');
run.beginAttempt(state.expectedStageId);
run.consume(10_260);
assert.equal(run.snapshot().stageRemainingMs, 10_000);
run.setPaused(true);
run.consume(5000);
assert.equal(run.snapshot().stageRemainingMs, 10_000, '일시정지 중에는 타이머가 흐르면 안 된다');
run.setPaused(false);
state = run.completeAttempt(false);
assert.equal(state.lives, 2);
assert.equal(state.transition, 'retry');
assert.deepEqual(state.selectedStageIds, firstSelection, '목숨이 남으면 같은 게임과 순서를 유지해야 한다');
assert.equal(state.stageConfigSeed, firstStageSeed, '목숨이 남으면 같은 난수 배치 시드를 유지해야 한다');

run.beginAttempt(state.expectedStageId);
run.completeAttempt(false);
run.beginAttempt(state.expectedStageId);
state = run.completeAttempt(false);
assert.equal(state.transition, 'act-restarted');
assert.equal(state.lives, 3);
assert.equal(state.actAttemptCount[0], 2);
assert.equal(state.currentStageInAct, 1);
assert.equal(state.actRecordCount, 0);
assert.equal(state.selectedStageIds.length, 6);
assert.notDeepEqual(state.selectedStageIds, firstSelection, '목숨 0이면 현재 막의 게임을 다시 뽑아야 한다');
assert.notEqual(state.stageConfigSeed, firstStageSeed, '막 재구성 시 난수 배치도 새로 뽑아야 한다');
run.advance();

// 1막을 세 번 완전히 실패한 뒤 시작하는 네 번째 도전부터 지원이 유지된다.
while (run.snapshot().actAttemptCount[0] < 4) {
  for (let life = 0; life < 3; life++) {
    state = run.snapshot();
    run.beginAttempt(state.expectedStageId);
    state = run.completeAttempt(false);
  }
  assert.equal(state.transition, 'act-restarted');
  run.advance();
}
state = run.snapshot();
assert.equal(state.assistProtocolAct1, true);
assert.equal(state.suppressionMultiplier, .85 * .8);

// 현재 1막부터 최종 스테이지까지 성공시키며 기록과 막 전환을 확인한다.
while (!run.snapshot().finished) {
  state = run.snapshot();
  run.beginAttempt(state.expectedStageId);
  run.consume(1000);
  state = run.completeAttempt(true);
  const { transition, snapshot } = run.advance();
  if (transition === 'next-act') {
    assert.equal(snapshot.currentStageInAct, 1);
    assert.equal(snapshot.lives, 3);
    assert.equal(snapshot.selectedStageIds.length, 6);
    assert.equal(new Set(snapshot.selectedStageIds).size, 6);
  }
}
state = run.snapshot();
assert.equal(state.ending, 'shared');
assert.equal(state.totalRecordCount, 18);
assert.equal(state.archiveViewerUnlocked, true);
assert.equal(state.archiveEntries.length, 18);
assert.equal(new Set(state.registeredRecordIds).size, 18);

// 새 게임은 엔딩 자료실 해금은 보존하되 현재 18개 진행만 초기화한다.
state = run.startNew();
assert.equal(state.archiveViewerUnlocked, true);
assert.equal(state.archiveEntries.length, 18);
assert.equal(state.totalRecordCount, 0);
assert.equal(state.currentAct, 1);

// 플레이 도중 새로고침하면 같은 선정 목록을 보존하고 스테이지 시작 전으로 복귀한다.
run.beginAttempt(state.expectedStageId);
run.consume(3210);
const restored = createArchiveRunState(stageIds, { storage, random: deterministicRandom }).snapshot();
assert.deepEqual(restored.selectedStageIds, state.selectedStageIds);
assert.equal(restored.phase, 'menu');
assert.equal(restored.stageRemainingMs, 20_260);
assert.equal(restored.currentStageId, restored.expectedStageId);

// QA 진입과 종료는 저장된 이야기 상태를 오염시키지 않는다.
const qaRun = createArchiveRunState(stageIds, { random: deterministicRandom });
const beforeQa = qaRun.startNew();
assert.equal(qaRun.setSelection(stageIds).qaMode, true);
const afterQa = qaRun.exitQa();
assert.equal(afterQa.qaMode, false);
assert.deepEqual(afterQa.selectedStageIds, beforeQa.selectedStageIds);

console.log('PASS | 3막×6스테이지, 목숨·막 재선정, 20.26초, 18개 기록, 저장·지원·단일 엔딩');
