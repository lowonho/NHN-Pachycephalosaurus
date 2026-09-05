/* 새 게임의 ID, 순서, 안내 문구. e번호는 파일 이름과 일치합니다. */
(function (global) {
  /*
   * 거미줄 질주 아이콘은 다른 게임처럼 문자 하나로는 그물 느낌이 살지 않아 SVG로 그린다.
   * 여덟 갈래 실 + 그 사이를 잇는 동심 팔각 고리 넷 — 실제 거미줄의 짜임을 본뜬 것이다.
   * stroke는 currentColor, 크기는 1em이라 다른 문자 기호가 놓이는 자리에 그대로 끼워 넣을 수 있다.
   * recordSymbol이 '<'로 시작하면 마크업으로 보고 innerHTML로 꽂는다(각 화면의 렌더 코드가 분기).
   */
  const E8_WEB_ICON = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12,12 L23.2,12 M12,12 L19.92,19.92 M12,12 L12,23.2 M12,12 L4.08,19.92 M12,12 L0.8,12 M12,12 L4.08,4.08 M12,12 L12,0.8 M12,12 L19.92,4.08"/><polygon points="14.8,12 13.98,13.98 12,14.8 10.02,13.98 9.2,12 10.02,10.02 12,9.2 13.98,10.02"/><polygon points="17.4,12 15.82,15.82 12,17.4 8.18,15.82 6.6,12 8.18,8.18 12,6.6 15.82,8.18"/><polygon points="20,12 17.66,17.66 12,20 6.34,17.66 4,12 6.34,6.34 12,4 17.66,6.34"/><polygon points="22.6,12 19.5,19.5 12,22.6 4.5,19.5 1.4,12 4.5,4.5 12,1.4 19.5,4.5"/></svg>`;
  /* 메챠 쌓기는 사람을 떨어뜨려 쌓는 게임이라 문자 기호 대신 사람 아이콘을 쓴다 — 위 거미줄과 같은 규약. */
  const E3_PERSON_ICON = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="6.6" r="3.3"/><path d="M5.5 20.2v-1.4a6.5 6.5 0 0 1 13 0v1.4"/></svg>`;
  global.MINIGAME_CATALOG = Object.freeze([
    ['e1', '거제 야호', '⇅', 'Space 중력 반전', '바닥 벽과 천장 벽을 오가며 움직이는 가시와 장애물을 피해 골인하세요.', '가시는 벽에 붙어 있다가 반전할수록 더 많이 떨어짐 · 금색/분홍색은 같은 방향, 보라색은 반대 방향', '반전'],
    ['e2', '바운스볼', '◉', 'A/D 이동 · Space 점프', '승강 발판과 무너지는 발판을 건너 골인하세요.', '후반까지 점프력 감소 · 파손 유지', '점프'],
    ['e3', '메챠 쌓기', E3_PERSON_ICON, 'A/D 또는 ←/→ 회전 · Space / 클릭으로 떨어뜨리기', '떨어뜨릴 사람을 원하는 각도로 돌려 쌓고 목표 높이에서 3초 버티세요.', '낙하마다 좌우 속도 증가 · 단상 밖으로 떨어지면 사라짐', '낙하'],
    ['e4', '왕사남 호랑이 추격', '↗', '방향키 / WASD 이동 · 놓으면 브레이크', '조선 마을 미로에서 호랑이를 피해 기다리는 왕에게 도착하세요.', '입력마다 가속 · 제동 시 밀림 · 벽 충돌 -1초 · 호랑이에게 잡히면 실패', '이동'],
    ['e5', '두쫀쿠 새총', '◎', '두쫀쿠를 마우스로 당겼다 놓기', '과자집 두 채를 무너뜨려 안에 숨은 두딱쿠 4개를 처치하세요.', '발사마다 장력 감소 · 후반엔 높게 띄워 지붕 공략', '발사'],
    ['e6', '회전 고양이', '↟', 'Space 누르기: 상승 · 놓기: 하강', '장애물 사이를 통과해 골인하세요.', '누를수록 하강 약화 · 상승 강화 · 충돌 시 후퇴', '상승'],
    ['e7', '월드컵 조추첨', '◴', '룰렛을 잡고 힘을 조절해 놓기', '화살표에 목표 국가가 멈추면 성공!', '실패할수록 마찰 감소 · 같은 힘에도 더 오래 회전', '추첨'],
    ['e8', '거미줄 질주', E8_WEB_ICON, 'Space / 클릭 꾹: 가장 가까운 곳에 연결 · 놓기: 날아가기', '길어진 도시를 거미줄로 건너 공중 골인 지점을 통과하세요.', '새 연결점마다 35% 가속 · 최대 3배 · 가속할수록 낙하 강화', '거미줄'],
    ['e10', '피겨 암호', '⛸', 'A/D 또는 ←/→ 활주 · Space 회전 점프', '빙판 위에서 점프해 숫자 블록을 맞히고, 얼음과 서리로 가려진 네 자리 암호를 완성하세요.', '방향을 새로 입력할수록 마찰과 가속력 감소', '조작'],
  ].map(([id, title, recordSymbol, controls, objective, anomaly, actionLabel], index) => Object.freeze({
    id, number: String(index + 1).padStart(2, '0'), title, recordSymbol, controls, objective, anomaly, actionLabel,
    intro: `${controls}\n${objective}\n${anomaly}`,
    brief: [{ speaker: `${id.toUpperCase()} // ${title}`, text: `${objective}\n\n${controls}\n${anomaly}`, phase: 'stage-brief', durationMs: 4200 }],
  })));
})(globalThis);
