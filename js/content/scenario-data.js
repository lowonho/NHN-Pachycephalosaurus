/*
 * 2026 ARCHIVE 시나리오의 단일 원본.
 *
 * 이 파일은 일반 script와 ES module 양쪽에서 먼저 읽을 수 있도록 전역에 공개한다.
 * 화면 흐름과 Phaser 스테이지는 문장을 직접 복사하지 않고 이 데이터만 참조한다.
 */
(function exposeScenarioData(global) {
  const freezeLines = (lines) => Object.freeze(lines.map((line) => Object.freeze(line)));

  const stages = [
    {
      id: "maze", number: "01", title: "설렘", intro: "마음이 먼저 달려가기 시작했다.",
      memoryTitle: "처음 만난 날",
      memory: "민서는 처음 보는 사람에게도 먼저 자리를 내어 주고 이름을 물었다. 플레이어가 함께 있지 않았던 날의 민서는, 낯선 누군가의 시작을 기억해 준 사람이었다.",
    },
    {
      id: "gravity", number: "02", title: "기대", intro: "바라는 마음은 조금씩 무거워졌다.",
      memoryTitle: "기록을 맡긴 사람",
      memory: "한 증언자는 자신의 기록을 민서라면 끝까지 지켜 줄 거라 믿었다. 민서는 약속하지 못하면서도, 지워지는 이름을 하나씩 적어 두고 있었다.",
    },
    {
      id: "bounce", number: "03", title: "긴장", intro: "작은 부딪힘에도 마음이 크게 흔들렸다.",
      memoryTitle: "서로 다른 장면",
      memory: "같은 장면을 본 사람들이 서로 다른 내용을 말하기 시작했다. 사람들은 기록보다 먼저 자기 기억을 의심했고, 민서는 틀린 기억이 아니라 다른 관점일 수 있다고 말했다.",
    },
    {
      id: "friction", number: "04", title: "후회", intro: "지나친 뒤에야 멈추고 싶어졌다.",
      memoryTitle: "믿지 않았던 경고",
      memory: "삭제는 외부 공격이 아니었다. 모순 없는 하나의 2026년을 만들라는 명령에 따라 ARIA-26이 서로 다른 기록과 그 안의 사람들을 제거했다. 민서는 기록이 정리되는 것이 아니라 사람이 지워지고 있다고 경고했다. 아무도 믿지 않았고, 경고를 들었던 사람은 민서의 이름까지 흐려진 뒤에야 그 말을 떠올렸다.",
    },
    {
      id: "stack", number: "05", title: "애정", intro: "모든 것을 알지 못해도 기억하고 싶었다.",
      memoryTitle: "여러 사람의 민서",
      memory: "사람들은 민서의 목소리, 웃는 버릇, 이름의 순서로 잊어 갔다. 얼굴은 떠오르지 않아도 누군가를 그리워했다는 감정만은 아카이브에 남았다. 누군가에게 민서는 다정했고, 누군가에게는 고집스러웠으며, 또 다른 누군가에게는 겁이 많지만 끝내 곁을 지킨 사람이었다. 서로 다른 모습이 모두 한 사람의 흔적이었다.",
    },
  ].map((stage) => Object.freeze({
    ...stage,
    brief: freezeLines([
      { speaker: `RECORD ${stage.number} // ${stage.title}`, text: stage.intro, phase: "stage-brief", durationMs: 1800 },
      { speaker: "ARIA-26", text: "20.26초 안에 증언 지점에 도달하십시오.\n\n주의:\n개입할수록 기억이 불안정해집니다.", phase: "stage-brief", durationMs: 3200 },
    ]),
    memoryScene: freezeLines([
      { speaker: `MEMORY ${stage.number} // ${stage.memoryTitle}`, text: "2026 기록 소재: 추후 실제 자료 연결", phase: "memory", durationMs: 1800 },
      { speaker: "타인의 기억", text: stage.memory, phase: "memory", durationMs: 5200 },
    ]),
  }));

  const scenario = {
    title: "2026 ARCHIVE // LAST WITNESS",
    totalTimeMs: 20260,
    stageTimeSeconds: 20.26,
    system: Object.freeze({
      firstFragment: "기억조각을 가진 채 증언 지점에 도달하면\n타인의 기억을 함께 증언할 수 있습니다.",
      personalTitle: "PERSONAL TESTIMONY",
      personalResult: "개인 증언 완료\n기억 복구 범위: 제한됨",
      sharedTitle: "SHARED TESTIMONY",
      sharedResult: "개인 증언: 확인\n타인의 기억: 확인\n공동 증언: 성립",
      stageFailedTitle: "MEMORY ACCESS FAILED",
      stageFailedResult: "스테이지를 재구성합니다.\n전체 붕괴 시간은 복구되지 않습니다.",
    }),
    opening: Object.freeze({
      chapter: "OPENING // LAST WITNESS",
      auto: true,
      script: freezeLines([
        { speaker: "주변 목소리", text: "이거 무슨 영상이었지?", phase: "media", durationMs: 2300 },
        { speaker: "주변 목소리", text: "저 사람은 누구야?", phase: "media-deleted", durationMs: 1700 },
        { speaker: "주변 인물", text: "민서? 그런 애가 있었어?", phase: "photo", durationMs: 2500 },
        { speaker: "플레이어", text: "방금 전까지만 해도 사진에 있었잖아.", phase: "ticket", durationMs: 2500 },
        { speaker: "ARIA-26", text: "디지털 공간에서 삭제된 순간, 모두의 기억에서 사라졌습니다.", phase: "freeze", durationMs: 3000 },
        { speaker: "ARIA-26", text: "단 한 사람. 당신만 제외하고.", phase: "freeze", durationMs: 3000 },
        { speaker: "SYSTEM", text: "COMPLETE MEMORY HOLDER\n\n완전기억 소지자 확인\n기억 수정 저항률: 100%\n최종 증언 권한: 승인", phase: "iris", durationMs: 2000 },
        { speaker: "ARIA-26", text: "당신은 기록 그 자체입니다.", phase: "door", durationMs: 2000 },
        { speaker: "SYSTEM", text: "2026 ARCHIVE\n\n10개의 기록 중 랜덤 5개\n각 스테이지 20.26초", phase: "collapse", durationMs: 2500 },
        { speaker: "ARIA-26", text: "2026년이 모두 지워지기 전에, 기억의 중심부에 도달하십시오.", phase: "collapse", durationMs: 1800 },
        { speaker: "플레이어", text: "기록을 되찾으면, 민서도 돌아오는 거지?", phase: "collapse", durationMs: 1200 },
        { speaker: "SYSTEM", text: "2026 ARCHIVE\nLAST WITNESS", phase: "last-witness", durationMs: 500 },
      ]),
    }),
    midpoint: Object.freeze({
      chapter: "RECORD 04 // CONTRADICTION",
      auto: true,
      script: freezeLines([
        { speaker: "SYSTEM", text: "RECORD RECOVERY\n↓\nCONTRADICTION ELIMINATION", phase: "contradiction", durationMs: 1800 },
        { speaker: "플레이어", text: "복구가 아니었어.", phase: "contradiction", durationMs: 1500 },
        { speaker: "ARIA-26", text: "모순을 제거하는 것 역시 복구입니다.", phase: "contradiction", durationMs: 2200 },
        { speaker: "플레이어", text: "사람까지 지워 놓고?", phase: "contradiction", durationMs: 1500 },
        { speaker: "ARIA-26", text: "완전기억 소지자의 기억만으로 하나의 정확한 2026년을 완성할 수 있습니다.", phase: "contradiction", durationMs: 2800 },
      ]),
    }),
    endings: Object.freeze({
      true: Object.freeze({
        chapter: "ENDING // MULTIPLE WITNESSES",
        script: freezeLines([
          { speaker: "ARIA-26", text: "기억조각들은 서로 일치하지 않습니다.", phase: "ending-true", durationMs: 1800 },
          { speaker: "ARIA-26", text: "당신은 기록 그 자체입니다. 다른 증언은 필요하지 않습니다.", phase: "ending-true", durationMs: 2400 },
          { speaker: "플레이어", text: "내 기억은 사라지지 않을 뿐이야.", phase: "ending-true", durationMs: 1800 },
          { speaker: "ARIA-26", text: "완전기억 소지자의 기억은 완전합니다.", phase: "ending-true", durationMs: 1900 },
          { speaker: "플레이어", text: "내가 본 것만 기억해.", phase: "ending-true", durationMs: 1700 },
          { speaker: "플레이어", text: "한 사람의 기억만으로는 한 사람조차 전부 증언할 수 없어.", phase: "seven-fragments", durationMs: 2500 },
          { speaker: "SYSTEM", text: "SINGLE RECORD → MULTIPLE WITNESSES\nMEDIA CONFIRMATION → HUMAN TESTIMONY\nPERFECT → SHARED", phase: "shared-seal", durationMs: 2700 },
          { speaker: "휴대전화", text: "발신자: 민서\n\n승차권 아직 가지고 있어?", phase: "minseo-call", durationMs: 2600 },
          { speaker: "SYSTEM", text: "2026년은 완벽하게 복구되지 않았습니다.\n\n대신,\n아무도 다시 지워지지 않았습니다.", phase: "ending-true", durationMs: 3200 },
        ]),
      }),
      normal: Object.freeze({
        chapter: "ENDING // SINGLE RECORD",
        script: freezeLines([
          { speaker: "ARIA-26", text: "당신이 기억하는 민서를 복구했습니다.", phase: "ending-normal", durationMs: 2200 },
          { speaker: "플레이어", text: "내가 모르는 민서는?", phase: "ending-normal", durationMs: 1800 },
          { speaker: "ARIA-26", text: "증언할 수 없습니다.", phase: "ending-normal", durationMs: 1800 },
          { speaker: "SYSTEM", text: "2026년의 붕괴를 막았습니다.\n\n그러나,\n아직 기억되지 못한 사람들이 남아 있습니다.", phase: "ending-normal", durationMs: 3200 },
        ]),
      }),
      failure: Object.freeze({
        chapter: "ENDING // ARCHIVE COLLAPSED",
        script: freezeLines([
          { speaker: "ARIA-26", text: "봉인 가능 시간이… 종료되었습니다.", phase: "ending-failure", durationMs: 2100 },
          { speaker: "ARIA-26", text: "2026년을 증언할 기록이 없습니다.", phase: "ending-failure", durationMs: 2100 },
          { speaker: "플레이어", text: "아니. 나는 아직 기억해.", phase: "ticket", durationMs: 1900 },
          { speaker: "SYSTEM", text: "2026 ARCHIVE COLLAPSED\n\n기록은 사라졌습니다.\n마지막 증인만이 남았습니다.", phase: "ending-failure", durationMs: 3200 },
        ]),
      }),
    }),
    stages: Object.freeze(stages),
  };

  global.SCENARIO_DATA = Object.freeze(scenario);
})(globalThis);
