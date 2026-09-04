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
    body: "속도, 중력, 탄성, 반동, 마찰, 빛, 회전. 일곱 개의 물리 채널을 최소한의 개입으로 복구하라.",
  },
];

export const STAGES = [
  {
    id: "maze",
    recordSymbol: "↗",
    number: "01",
    code: "VELOCITY_INDEX",
    title: "가속 미로",
    objective: "공을 RESTORE 구역에서 저속으로 안정시키세요.",
    anomaly: "방향을 누를수록 속도와 관성이 증가합니다.",
    controls: "WASD / 방향키 · 반대 방향으로 제동",
    actionLabel: "방향 입력",
    logTitle: "속도 채널 복구",
    log: "첫 기록은 빨라지는 것보다 멈추는 법을 기억하고 있었다. 복구율 14%.",
  },
  {
    id: "gravity",
    recordSymbol: "↓",
    number: "02",
    code: "GRAVITY_STACK",
    title: "중력 타워",
    objective: "네 개의 발판을 올라 상단 비콘에 접촉하세요.",
    anomaly: "점프할 때마다 중력이 강해져 다음 점프가 낮아집니다.",
    controls: "A/D 또는 ←/→ 이동 · Space 점프",
    actionLabel: "점프",
    logTitle: "중력 채널 복구",
    log: "기록은 위로 향할수록 무거워졌다. 필요한 점프만 남기자 길이 열렸다. 복구율 28%.",
  },
  {
    id: "bounce",
    recordSymbol: "◉",
    number: "03",
    code: "RESTITUTION_LOOP",
    title: "탄성 우회",
    objective: "공을 발사해 차단벽 너머의 코어에 넣으세요.",
    anomaly: "충돌할 때마다 탄성이 증가해 더 빠르게 튕깁니다.",
    controls: "마우스 클릭 / 터치로 발사 방향 지정",
    actionLabel: "충돌",
    logTitle: "탄성 채널 복구",
    log: "충격은 사라지지 않고 다음 충격을 키웠다. 한 번의 정확한 반사가 기록을 고정했다. 복구율 42%.",
  },
  {
    id: "recoil",
    recordSymbol: "⌖",
    number: "04",
    code: "RECOIL_ARRAY",
    title: "반동 사격장",
    objective: "이동하는 세 개의 기록 노드를 모두 맞히세요.",
    anomaly: "발사할 때마다 포대가 밀리고 조준 오차가 커집니다.",
    controls: "마우스 / 터치로 조준 · 클릭하여 발사",
    actionLabel: "발사",
    logTitle: "반동 채널 복구",
    log: "모든 발사는 기록 관리자를 뒤로 밀어냈다. 적은 탄환이 가장 정확한 답이었다. 복구율 57%.",
  },
  {
    id: "friction",
    recordSymbol: "≈",
    number: "05",
    code: "FRICTION_DROP",
    title: "무마찰 배송",
    objective: "화물을 장애물 사이로 운반해 적재 구역에 정지시키세요.",
    anomaly: "이동 입력이 쌓일수록 마찰력이 감소합니다.",
    controls: "WASD / 방향키 · 반대 방향으로 제동",
    actionLabel: "이동 입력",
    logTitle: "마찰 채널 복구",
    log: "미끄러지는 기록은 목적지를 지나치고도 멈추지 않았다. 움직임보다 제동이 중요했다. 복구율 71%.",
  },
  {
    id: "darkness",
    recordSymbol: "☼",
    number: "06",
    code: "LIGHT_DECAY",
    title: "소실 회랑",
    objective: "시야가 사라지기 전에 출구 비콘에 도착하세요.",
    anomaly: "방향을 새로 누를 때마다 조명 반경이 줄어듭니다.",
    controls: "WASD / 방향키",
    actionLabel: "방향 입력",
    logTitle: "광원 채널 복구",
    log: "기록은 볼 수 없는 곳에서도 존재했다. 경로를 먼저 읽은 뒤 움직이자 빛이 돌아왔다. 복구율 85%.",
  },
  {
    id: "rotation",
    recordSymbol: "↻",
    number: "07",
    code: "ANGULAR_LOCK",
    title: "각속도 잠금",
    objective: "회전 바를 목표 각도에 맞추고 정지시키세요.",
    anomaly: "회전 입력마다 각속도와 토크가 증가합니다.",
    controls: "A/D 또는 ←/→ 회전 · 반대 방향으로 제동",
    actionLabel: "회전 입력",
    logTitle: "최종 채널 복구",
    log: "마지막 기록은 계속 돌고 있었다. 더 돌리는 대신 정확한 순간에 힘을 거두자 정지했다. 복구율 100%.",
  },
];

export const ENDING = {
  code: "ARCHIVE // STABLE",
  title: "2026년의 기록이 다시 재생된다.",
  body: "오류의 원인은 외부 침입이 아니었다. 기록을 완벽하게 고치려는 수많은 개입이 물리 인덱스를 뒤틀고 있었다. 당신은 최소한의 행동으로 시스템을 안정시켰다. 이제 보존된 장면들은 다음 기록 관리자를 기다린다.",
};

export const STORAGE_KEY = "archive-2026-progress-v1";
export const SETTINGS_KEY = "archive-2026-settings-v1";


