/* 새 게임의 ID, 순서, 안내 문구. e번호는 파일 이름과 일치합니다. */
(function (global) {
  global.MINIGAME_CATALOG = Object.freeze([
    ['e1', '중력 대쉬', '⇅', 'Space 중력 반전', '바닥 벽과 천장 벽을 오가며 가시와 장애물을 피해 골인하세요.', '반전하면 벽에 붙어 있던 장애물이 반대쪽으로 낙하 · 떠 있는 장애물은 그대로', '반전'],
    ['e2', '바운스볼', '◉', 'WASD 이동 · Space 점프', '천장 가시를 피해 오른쪽 골인 지점에 도착하세요.', '점프할수록 높이 증가 · 사망해도 유지', '점프'],
    ['e3', '사람 쌓기', '▤', 'Space / 클릭으로 떨어뜨리기', '사람 탑을 목표선까지 쌓고 0.6초 유지하세요.', '낙하마다 좌우 속도 증가 · 잔해 유지', '낙하'],
    ['e4', '가속 대쉬', '↗', '방향키 / WASD 4방향 전환', '한 화면에 펼쳐진 미로를 따라 10개 코너를 꺾어 골인하세요.', '코너를 돌수록 가속 · 랜덤 미로', '회전'],
    ['e5', '새총 파괴', '◎', '탄환을 마우스로 당겼다 놓기', '제한시간 안에 모든 목표물을 부수세요.', '발사마다 고무줄 힘과 파괴력 감소', '발사'],
    ['e6', '중력 비행', '↟', 'Space 누르기: 상승 · 놓기: 하강', '장애물 사이를 통과해 골인하세요.', '누를수록 하강 약화 · 상승 강화 · 충돌 시 후퇴', '상승'],
    ['e7', '경품 룰렛', '◴', '룰렛을 마우스로 휙 돌리기', '고정된 화살표에 당첨 칸이 멈추면 성공!', '꽝마다 당첨 영역 1/2 → 1/4 → 1/6…', '추첨'],
    ['e8', '시소 균형', '⚖', 'A/D로 우리 쪽 캐릭터 이동', '반대편 끝이 바닥에 닿지 않도록 20.26초 버티세요.', '랜덤 추 7개 · 중심에서 멀수록 무거운 효과', '이동'],
    ['e9', '얼음 컬링', '≈', '돌을 마우스로 당겼다 놓기', '돌을 과녁 안에 완전히 멈추세요.', '실패할수록 얼음이 미끄러워짐', '슬라이드'],
  ].map(([id, title, recordSymbol, controls, objective, anomaly, actionLabel], index) => Object.freeze({
    id, number: String(index + 1).padStart(2, '0'), title, recordSymbol, controls, objective, anomaly, actionLabel,
    intro: `${controls}\n${objective}\n${anomaly}`,
    brief: [{ speaker: `${id.toUpperCase()} // ${title}`, text: `${objective}\n\n${controls}\n${anomaly}`, phase: 'stage-brief', durationMs: 4200 }],
  })));
})(globalThis);
