# 2026 ARCHIVE 공통 복구 시스템

기존 7개 물리 프로토타입에 기억 조각과 복구 진행도를 연결한다. 물리 수치, 장애물, 기본 목표는 유지한다. 밈 아트와 개별 위험 루트의 최종 난이도는 다음 작업이다.

## 판정과 저장

- 실패: `RECORD LOST`. 이번 시도의 조각은 저장하지 않는다.
- 조각 없이 목표 달성: `PARTIALLY RESTORED`.
- 조각 획득 후 목표 달성: `FULLY RESTORED`.
- 기록 목록의 초기 상태는 `DAMAGED`. 시도 결과와 저장된 최고 상태는 별개이며, 재도전으로 기존 복구 상태가 낮아지지 않는다.
- 재시작할 때 시도 내 조각 수집 상태는 초기화한다. 완전 복구했던 스테이지도 이번 시도에서 다시 수집해야 완전 복구 결과가 나온다.
- 저장 키: `archive-2026-recovery-v1`. 지원되는 브라우저에서는 localStorage로 새로고침 후에도 유지한다. 저장소 접근 실패 시 현재 세션의 메모리 상태를 유지한다.
- 제한시간은 20.26초. 시간이 소진된 프레임에서는 목표/수집 판정보다 실패 판정이 먼저다. 일시정지 중에는 진행하지 않는다.

## 복구율과 엔딩용 데이터

`js/archive/progress.mjs`의 `RECOVERY_RULES`에서 기준을 관리한다.

`복구율 = (완전 복구 수 + 부분 복구 수 × 0.5) / 전체 기록 수 × 100`

표시는 반올림한 정수다. 모든 스테이지를 부분 복구하면 50%, 전부 완전 복구하면 100%다. 중복 클리어/수집은 추가로 누적하지 않는다.

`window.archiveProgress.summary()`는 `totalRecords`, `clearedCount`, `fragmentCount`, `recoveryRate`, `allCleared`, `ending`을 제공한다. 엔딩 값은 아직 전체 클리어 전이면 `null`, 전체 클리어 후에는 조각 절반 미만 `incomplete`, 절반 이상 `normal`, 전체 수집 `complete`다. 7개 기준으로 일반 복구는 4개부터다. 현재 기록 목록에는 이 값에 따른 짧은 완료 메시지만 표시한다. 별도의 엔딩 연출은 후속 작업에서 연결한다.

## 스테이지별 조각 연결

`js/archive/fragments.mjs`의 `MEMORY_FRAGMENTS`에 스테이지 ID별 `x`, `y`, `radius`, `hint`를 둔다. 좌표는 기존 960×540 게임 공간 기준이다.

| 스테이지 | 수집 주체 | 임시 배치 |
| --- | --- | --- |
| 가속 미로 | 공 | 기본 해답 경로 밖의 미로 셀 |
| 중력 타워 | 플레이어 | 첫 발판 왼쪽 |
| 탄성 우회 | 공 | 차단벽 사이 아래 공간 |
| 반동 사격장 | 탄환 | 기본 노드와 떨어진 왼쪽 공간 |
| 무마찰 배송 | 화물 | 두 번째 통로 위쪽 |
| 소실 회랑 | 플레이어 | 회랑 안쪽 |
| 각속도 잠금 | 밝게 표시한 바의 끝점 | 목표와 반대쪽 회전각 |

조각 자체는 충돌 장애물이거나 물리 능력치 보상이 아니다. 획득을 위한 이동·사격·회전이 기존 오류 증가 규칙을 그대로 사용한다. 빠른 탄환/공의 수집 누락을 줄이기 위해 이전 위치부터 현재 위치까지의 구간도 검사한다.

완전 복구 카드의 임시 문양은 `js/archive/data.mjs`의 `recordSymbol`이다. 추후 실제 2026년 소재의 아이콘과 공개 제목을 연결한다.

## 빌드와 검증

모듈 원본 변경 후 `powershell -ExecutionPolicy Bypass -File scripts/build-archive-classic.ps1`을 실행한다. 생성된 `game-classic.js`는 `file://` 직접 실행을 지원한다.

```text
node tests/archive-clearability.mjs
node tests/archive-full-game-check.mjs
node tests/archive-recovery-check.mjs
node tests/archive-recovery-browser.mjs
```

마지막 검사는 임시 브라우저 프로필과 로컬 서버를 사용한다. 기본 Chrome 경로는 Windows 기준이며 `CHROME_PATH`로 변경할 수 있다. 브라우저 테스트는 실제 수집 어댑터·결과 화면·저장 연결을 확인하기 위해 게임 상태를 배치한다. 조각을 포함한 전체 위험 루트의 클리어 가능성과 재미를 자동으로 입증하는 테스트는 아니다.
