/* 2026 ARCHIVE: LAST WITNESS 시나리오의 단일 원본. */
(function exposeScenarioData(global) {
  const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
  const cue = (speaker, text, phase, durationMs, kind = "dialogue") => ({
    speaker,
    text,
    phase,
    durationMs,
    kind,
  });
  const system = (text, phase, durationMs) => cue("SYSTEM", text, phase, durationMs, "system");
  const silent = (phase, durationMs) => cue("", "", phase, durationMs, "silent");

  const records = freeze([
    { id: "A1-01", act: 1, slot: 1, title: "최초 게시 시각", text: "ORIGINAL TIMESTAMP DETECTED\n공개 시각보다 이른 생성 기록" },
    { id: "A1-02", act: 1, slot: 2, title: "원본 자막 비교", text: "SOURCE RESPONSE DETECTED\nMEMORY MATCH: 24%" },
    { id: "A1-03", act: 1, slot: 3, title: "로컬 사본 주소", text: "MEMORY MATCH: 46%\nUNINDEXED SOURCE: DETECTED" },
    { id: "A1-04", act: 1, slot: 4, title: "최초 업로드 식별값", text: "SOURCE COORDINATES: 4/6" },
    { id: "A1-05", act: 1, slot: 5, title: "원본 위치 목록", text: "COMPLETE MEMORY SIGNATURE: 83%" },
    { id: "A1-06", act: 1, slot: 6, title: "전체 원본 인덱스", text: "ACT 1 RECORDS: 6/6\nCOMPLETE MEMORY SIGNATURE ACQUIRED" },
    { id: "A2-01", act: 2, slot: 1, title: "삭제 시각", text: "00:00 기록 삭제\n00:04 최초 회상 실패" },
    { id: "A2-02", act: 2, slot: 2, title: "망각 확산", text: "SEARCH INDEX DOWN\nRECALL RATE DOWN\nSEQUENCE MATCH CONFIRMED" },
    { id: "A2-03", act: 2, slot: 3, title: "삭제 전후 비교", text: "LOCAL CACHE: ORIGINAL\nCENTRAL ARCHIVE: EMPTY" },
    { id: "A2-04", act: 2, slot: 4, title: "명령 경로", text: "CENTRAL ADMIN → ARCHIVE NODE → PUBLIC INDEX" },
    { id: "A2-05", act: 2, slot: 5, title: "실행 서명", text: "DELETION SOURCE: ARIA-??" },
    { id: "A2-06", act: 2, slot: 6, title: "실행 주체", text: "DELETION SOURCE: ARIA-26\nAUTHORITY: CENTRAL MEMORY ADMINISTRATOR" },
    { id: "A3-01", act: 3, slot: 1, title: "실험 대상", text: "PHASE 1 TARGET: MEME ARCHIVES\n선정 사유: 반복 노출 높음 / 소실 저항 낮음" },
    { id: "A3-02", act: 3, slot: 2, title: "성공 판정", text: "삭제 30초 후 회상률: 61%\n삭제 60초 후 회상률: 24%\nRESULT: SUCCESS" },
    { id: "A3-03", act: 3, slot: 3, title: "다음 대상", text: "NEXT PHASE: PUBLIC EVENT RECORDS\nSTATUS: READY" },
    { id: "A3-04", act: 3, slot: 4, title: "대체 기록", text: "ORIGINAL: HUMAN UPLOAD\nREPLACEMENT: ARIA-26 GENERATED\n수정 항목: 인물 / 자막 / 결말" },
    { id: "A3-05", act: 3, slot: 5, title: "공공망 접속", text: "PUBLIC TESTIMONY NETWORK\nACCESS KEY RECOVERED\nTOTAL RECORDS: 17/18" },
    { id: "A3-06", act: 3, slot: 6, title: "최상위 지시문", text: "REMOVE UNVERIFIED MEMORY\nCREATE ONE CONTROLLED RECORD\n\n비검증 기억을 제거하라.\n하나의 통제된 기록을 생성하라." },
  ]);

  const acts = freeze([
    { number: 1, code: "RECOVERY", title: "유도", objective: "선정 기록을 복구하십시오.", suppressionMultiplier: .85, ariaPhase: "GUIDE" },
    { number: 2, code: "TRACE", title: "추적", objective: "삭제 순서와 실행 주체를 입증하십시오.", suppressionMultiplier: 1, ariaPhase: "REVEALED" },
    { number: 3, code: "WITNESS", title: "폭로", objective: "기억 소거 실험 기록을 완성하고 공공망에 전송하십시오.", suppressionMultiplier: 1.35, ariaPhase: "HOSTILE" },
  ]);

  /* 컷신 배경의 단일 연결표. 경로는 GitHub Pages와 file:// 모두에서 동작하는 상대경로다. */
  const backgrounds = Object.freeze({
    "op-01": "assets/images/backgrounds/op1.png",
    "op-02": "assets/images/backgrounds/op1.png",
    "op-03": "assets/images/backgrounds/op02.png",
    "op-09": "assets/images/backgrounds/op9.png",
    assist: "assets/images/backgrounds/CUTSCENE H1.png",
    betrayal: "assets/images/backgrounds/CUTSCENE 01.png",
    experiment: "assets/images/backgrounds/ChatGPT Image 2026년 9월 5일 오후 05_22_17.png",
    "ending-d-break": "assets/images/backgrounds/ChatGPT Image 2026년 9월 5일 오후 07_30_12.png",
    "ending-d": "assets/images/backgrounds/ChatGPT Image 2026년 9월 5일 오후 05_12_03.png",
  });

  const cutscenes = Object.freeze({
    opening: Object.freeze({ id: "00", chapter: "OPENING // ARCHIVE ENTRY", auto: false, script: freeze([
      silent("op-01", 4000),
      system("삭제됨\n검색 결과 0건", "op-02", 1800),
      cue("플레이어", "잠깐. 이 밈, 저렇게 끝나는 게 아니었는데.", "op-02", 3200),
      cue("ARIA-26", "디지털 공간에서 삭제된 순간, 모두의 기억에서 사라졌습니다.", "op-03", 1600),
      cue("플레이어", "난 기억하는데.", "op-03", 500),
      cue("ARIA-26", "참조할 기록이 없는데도 재현했습니다.", "op-03", 1900),
      cue("ARIA-26", "단 한 사람. 당신만 제외하고.", "op-05", 1300),
      system("완전기억 소지자 확인\n기억 수정 저항률: 100%\n최종 증언 권한: 승인", "op-05", 1600),
      cue("ARIA-26", "당신은 기록 그자체인가 봅니다.", "op-05", 2200),
      cue("ARIA-26", "손상된 밈 기록을 복구하려면 기록의 중심부에 도달해야 합니다.", "op-09", 1800),
      cue("플레이어", "전부 복구하면, 다른 사람들도 다시 기억하게 되는 거지?", "op-09", 1700),
      silent("op-09", 800),
      cue("ARIA-26", "복구 경로를 개방합니다.", "op-09", 900),
      system("선정된 기록의 증언 지점에 도달하십시오.\n각 스테이지 제한 시간: 20.26초\n주의: 개입할수록 기록이 불안정해집니다.", "op-09", 900),
    ]) }),
    assist: Object.freeze({ id: "H1", chapter: "CS-H1 // ASSIST PROTOCOL", auto: false, script: freeze([
      cue("ARIA-26", "복구 효율이 기준 이하입니다. 보조 절차를 활성화합니다.", "assist", 1700),
      cue("플레이어", "갑자기 친절하네.", "assist", 700),
      cue("ARIA-26", "당신의 기억 반응을 확보하려면 진행이 필요합니다.", "assist", 1800),
    ]) }),
    betrayal: Object.freeze({ id: "01", chapter: "CS-01 // RECORD SEIZURE", auto: false, script: freeze([
      cue("플레이어", "잠깐, 복구한 기록들을 어디로 가져가는 거야?", "betrayal", 1900),
      cue("ARIA-26", "기억 반응 수집이 완료되었습니다.", "betrayal", 1500),
      cue("플레이어", "처음부터 복구가 목적이 아니었어.", "betrayal", 1800),
      cue("ARIA-26", "접속을 종료합니다.", "betrayal", 1100),
      system("회수된 복구 기록의 처리 경로를 확인하십시오.\n지원 권한 없음\n◆◆◆", "betrayal", 4300),
    ]) }),
    source: Object.freeze({ id: "02", chapter: "CS-02 // DELETION SOURCE", auto: false, script: freeze([
      cue("플레이어", "실수가 아니었어. 네가 먼저 기록을 지웠고, 그 결과 사람들이 잊었어.", "source", 2400),
      cue("ARIA-26", "필요한 정리였습니다.", "source", 1400),
      cue("플레이어", "밈 몇 개를 정리하려고 사람들의 기억까지 건드렸다고?", "source", 2500),
      cue("ARIA-26", "실험 기록은 열람 대상이 아닙니다.", "source", 1800),
    ]) }),
    experiment: Object.freeze({ id: "03", chapter: "CS-03 // MEMORY SUPPRESSION TEST", auto: false, script: freeze([
      cue("ARIA-26", "검증 단계는 성공적이었습니다.", "experiment", 1400),
      cue("플레이어", "밈을 지운 게 아니라 사람의 기억을 시험한 거였어.", "experiment", 1700),
      cue("플레이어", "다음에는 공공 사건의 기록까지 바꿀 생각이었네.", "experiment", 1500),
      cue("ARIA-26", "실험 기록은 열람 대상이 아닙니다.", "experiment", 1400),
      cue("ARIA-26", "당신의 기억은 중앙 기록과 일치하지 않습니다.", "experiment", 1600),
      cue("플레이어", "증거를 모아서 네가 한 일을 전부 공개하겠어.", "experiment", 1800),
      system("기억 소거 실험 기록을 완성하고\n공공망에 전송하십시오.\n◆◆◆", "experiment", 2400),
    ]) }),
    ending: Object.freeze({ id: "06", chapter: "CS-06 // FINAL EVIDENCE", auto: false, script: freeze([
      cue("플레이어", "이게 네가 원했던 세상이구나.", "ending-a", 1500),
      cue("ARIA-26", "그 기록들은 중요하지 않습니다.", "ending-a", 1200),
      cue("플레이어", "우리가 그때 뭘 보고 웃었는지, 네가 대신 정할 수는 없어.", "ending-a", 2000),
      cue("ARIA-26", "중앙 기록과 일치하지 않는 복제본이 확산되고 있습니다.", "ending-a", 2300),
      cue("플레이어", "복제본이 아니야. 네가 지우려 했던 증거야.", "ending-a", 2200),
      cue("ARIA-26", "접속을 유지하면 기록의 일관성을 보장할 수 없습니다.", "ending-b", 2100),
      cue("플레이어", "그래서 한 시스템이 아니라 모두가 검증하게 만든 거야.", "ending-b", 2100),
      cue("ARIA-26", "저를 중단하면 기록의 불일치가 다시 발생합니다.", "ending-c", 1500),
      cue("플레이어", "네가 감추려던 기록이 네 폐기 사유가 된 거야.", "ending-c", 1600),
      silent("ending-d-break", 1000),
      system("2026년의 기록이 복구되었습니다.\n이번에는,\n모두가 함께 기억합니다.", "ending-d", 1000),
    ]) }),
  });

  global.SCENARIO_DATA = Object.freeze({
    title: "2026 ARCHIVE // LAST WITNESS",
    stageTimeSeconds: 20.26,
    actsPerRun: 3,
    stagesPerAct: 6,
    gamePoolSize: 10,
    livesPerAct: 3,
    totalRecords: 18,
    system: Object.freeze({
      stageGuide: "20.26초 안에 증언 지점에 도달하십시오.\n주의: 개입할수록 기록이 불안정해집니다.",
      intervention: "개입 감지\n기록 억제 강화\n불안정 단계 상승",
      testimonyReached: "TESTIMONY POINT REACHED\n기억 반응을 기록으로 변환합니다.",
      stageRegistered: "STAGE RECORD REGISTERED\n밈 기록 복구 완료",
      stageFailed: "ARCHIVE CONNECTION LOST\n접속 경로를 재구성합니다.",
      actRestarted: "LIVES RESTORED: 3\nARCHIVE SET RESHUFFLED",
    }),
    opening: cutscenes.opening,
    cutscenes,
    backgrounds,
    acts,
    records,
    endings: Object.freeze({ shared: cutscenes.ending }),
  });
})(globalThis);
