export const GAME_TITLE = "2026 ARCHIVE";

export const PROLOGUE = [
  {
    code: "SYSTEM // 00:00:01",
    title: "2026년의 마지막 백업이 열렸다.",
    body: "한 해의 장면을 보관하던 2026 ARCHIVE. 새벽 0시, 보존 서버의 물리 인덱스가 동시에 붕괴했다.",
  },
  {
    code: "EMERGENCY // RECORD DECAY",
    title: "손상된 기록은 20.26초만 유지된다.",
    body: "기록이 재생되는 동안 직접 개입해 마지막 장면을 완성해야 한다. 그러나 입력이 많아질수록 오류는 더 강해진다.",
  },
  {
    code: "OPERATOR // ASSIGNED",
    title: "당신은 마지막 기록 관리자다.",
    body: "속도, 중력, 탄성, 마찰, 무게중심. 다섯 개의 물리 채널을 최소한의 개입으로 복구하라.",
  },
];

export const STAGES = [
  {
    id: "maze",
    recordSymbol: "↗",
    number: "01",
    code: "VELOCITY_INDEX",
    title: "가속 코스",
    objective: "공을 RESTORE 구역에서 저속으로 안정시키세요.",
    anomaly: "방향 입력마다 가속 · 강한 벽 충돌 −1초",
    controls: "WASD / 방향키 · 반대 방향으로 제동",
    actionLabel: "방향 입력",
    logTitle: "속도 채널 복구",
    log: "첫 기록은 빨라지는 것보다 멈추는 법을 기억하고 있었다.",
  },
  {
    id: "gravity",
    recordSymbol: "↓",
    number: "02",
    code: "GRAVITY_STACK",
    title: "중력 타워",
    objective: "좁은 발판을 연결해 상단 비콘에 도착하세요. 추락하면 복구 실패입니다.",
    anomaly: "점프할 때마다 중력이 강해져 다음 점프가 낮아집니다.",
    controls: "A/D 또는 ←/→ 이동 · Space 점프",
    actionLabel: "점프",
    logTitle: "중력 채널 복구",
    log: "기록은 위로 향할수록 무거워졌다. 필요한 점프만 남기자 길이 열렸다.",
  },
  {
    id: "bounce",
    recordSymbol: "◉",
    number: "03",
    code: "RESTITUTION_LOOP",
    title: "탄성 과잉",
    objective: "자동으로 튀는 공을 조절해 턱과 틈을 넘어 코어에 도착하세요.",
    anomaly: "착지할 때마다 더 높이 튑니다. 천장과 추락에 주의하세요.",
    controls: "A/D 또는 ←/→ 이동 · 자동 바운스",
    actionLabel: "착지",
    logTitle: "탄성 채널 복구",
    log: "착지할수록 기록은 더 높이 튀었다. 다음 착지 위치를 고르자 길이 이어졌다.",
  },
  {
    id: "friction", recordSymbol: "≈", number: "04", code: "FRICTION_DROP",
    title: "미끄럼 배송", objective: "관성을 제어해 화물을 DOCK 안에서 멈추세요.",
    anomaly: "이동 입력이 쌓일수록 마찰이 줄어 제동이 어려워집니다.",
    controls: "WASD / 방향키 · 반대 방향으로 제동", actionLabel: "이동 입력",
    logTitle: "마찰 채널 복구", log: "미끄러지는 기록은 제동을 기억하고 있었다.",
  },
  {
    id: "stack", recordSymbol: "▤", number: "05", code: "CENTER_OF_MASS",
    title: "무게중심 쌓기", objective: "블록 6개를 쌓고 무게중심을 지켜 0.7초간 안정시키세요.",
    anomaly: "블록이 점점 무겁고 좁아지며, 좌우 이동도 빨라집니다.",
    controls: "자동 좌우 이동 · A/D 또는 ←/→ 보정 · Space / 클릭 낙하", actionLabel: "낙하",
    logTitle: "무게중심 채널 복구", log: "쌓인 기록의 무게를 받치는 중심을 찾았다.",
  },
];

export const ENDING = {
  code: "ARCHIVE // STABLE",
  title: "2026년의 기록이 다시 재생된다.",
  body: "오류의 원인은 외부 침입이 아니었다. 기록을 완벽하게 고치려는 수많은 개입이 물리 인덱스를 뒤틀고 있었다. 당신은 최소한의 행동으로 시스템을 안정시켰다. 이제 보존된 장면들은 다음 기록 관리자를 기다린다.",
};

export const STORAGE_KEY = "archive-2026-progress-v1";
export const SETTINGS_KEY = "archive-2026-settings-v1";

