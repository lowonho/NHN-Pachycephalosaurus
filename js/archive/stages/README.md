# 10개 미니게임 개발 안내

실행 중인 게임은 아래 **e번호 + 이름.js** 파일입니다. `e1.mjs`~`e5.mjs`와 기존 물리 코어는 이전 버전 참고 자료이며 새 레지스트리와 실행 번들에는 포함되지 않습니다.

| ID | 파일 | 주요 조정값 (`tuning`) |
| --- | --- | --- |
| e1 | e1_gravityDash.js | speed, distance, jump, obstacleGravity |
| e2 | e2_bounceBall.js | speed, jump, jumpGain, maxJump, gravity |
| e3 | e3_humanStack.js | speed, speedGain, maxSpeed, targetHeight, hold |
| e4 | e4_accelerationDash.js | turns (기본 10), speed, gain, tolerance, minLength/maxLength |
| e5 | e5_slingshot.js | force, decay, minPower, maxPull, targetHP |
| e6 | e6_gravityFlight.js | speed, distance, gravityLoss, minGravity, liftGain, maxLift, gap |
| e7 | e7_roulette.js | minSpeed, maxSpeed, minSpinSeconds |
| e8 | e8_seesaw.js | drops (기본 7), playerMass, moveSpeed, inertia, damping |
| e9 | e9_iceCurling.js | friction, decay, minFriction, force, targetRadius |
| e10 | e10_numberDecode.js | acceleration, maxSpeed, jump, baseFriction, frictionLoss, minFriction, minTraction |

## 공통 흐름

- 메인 → 33초 오프닝 → 3막 진행 → 공유 기억 엔딩 순서입니다.
- 막마다 10개 게임 중 중복 없이 6개를 뽑아 고정 순서로 진행하며, 전체 18개 기록을 자동 등록합니다.
- 각 게임은 정확히 20.26초입니다. 컷신·결과·설정·일시정지 중에는 흐르지 않습니다.
- 한 막의 목숨은 3개입니다. 목숨이 남으면 같은 게임을 재시도하고, 모두 잃으면 현재 막 기록을 지운 뒤 6개를 다시 뽑습니다.
- 1막 네 번째 전체 도전부터 지원 프로토콜이 유지되며, 2막과 3막에는 지원이 없습니다.
- 메인으로 나가도 현재 막, 목숨, 선정 게임과 순서가 저장되어 `이어하기`로 복귀합니다.
- 엔딩 뒤에는 실제 진행에서 선정된 18개 게임과 자동 등록 기록을 `증언 기록`에서 다시 읽을 수 있습니다.
- 최고 기록은 클리어 시간 우선, 같은 시간이면 조작 횟수 우선으로 저장합니다. 시소는 생존 시간이 같으므로 조작 횟수로 비교합니다.
- 게임 내 충돌/사망은 같은 시도입니다. e1 후퇴 시 장애물 상태, e2 사망 시 점프력, e3 붕괴 시 잔해와 속도, e6 충돌 시 중력, e9 실패 시 마찰을 유지합니다.
- 결과의 다시하기는 새 시도이므로 타이머와 페널티를 초기화합니다.

## 게임별 참고

- e1은 자동 전진/Space 점프. 공중 Space도 장애물 중력을 뒤집습니다. 고정된 금색 가시를 함께 배치하여 한 번 뒤집고 끝까지 달리는 것을 방지했습니다. 충돌하면 조금 후퇴합니다.
- e2는 A/D 좌우, W/S 공중 수직 보정, Space 착지 후 점프입니다. 키를 길게 눌러도 점프력이 더해지지 않습니다. 플랫폼에 착지하면 체크포인트를 갱신합니다.
- e3은 Matter 복합 강체로 사람 모양을 쌓습니다. 206 높이를 0.6초 유지하면 성공합니다. 잔해는 실제 받침으로 남습니다.
- e4는 자동 전진, 코너에서 W/D 또는 Space/클릭으로 꺾습니다. 길이는 매번 무작위이고 코너는 정확히 10개입니다. 실패하면 현재 직선 시작으로 후퇴하며 가속은 유지합니다.
- e5는 탄환을 당겼다 놓습니다. 목표물은 6개, 체력이 있으며 궤적 미리보기가 실제 발사 힘을 반영합니다. 탄환 수 제한은 없습니다. 약해져도 끝 목표에 도달하도록 최소 힘을 둡니다.
- e6의 무충돌 골인은 약 16.47초입니다. 새로 누를 때마다 중력 감소/상승 강화가 누적됩니다. 누르고 있는 동안 상승하며, 충돌하면 후퇴하고 중력은 유지합니다.
- e7은 금색이 당첨입니다. 드래그의 각속도를 최솟값/최댓값 사이로 제한한 후 실제로 감속합니다. 최종 추가 회전량을 한 바퀴 안에서 균일하게 정하여 영역 비율이 실제 확률이 됩니다. 별도 당첨 결과로 화면을 덮어쓰지 않습니다. 실패마다 1/2, 1/4, 1/6, 1/8…로 좁아집니다.
- e8은 오른쪽에 랜덤 추가 떨어집니다. 왼쪽 캐릭터를 A/D로 옮기며 오른쪽 끝이 바닥에 닿지 않도록 20.26초 생존하면 성공합니다. 우리 쪽 바닥 접촉은 실패가 아닙니다.
- e9는 돌을 당겼다 놓습니다. 돌 전체가 금색이 아닌 분홍 과녁 안에 멈추어야 성공하며, 실패한 돌은 지우고 같은 시도에서 더 미끄러운 얼음에 새 돌을 놓습니다.
- e10은 A/D 또는 좌우 방향키로 이동하고 Space로 점프하여 0~9 블록의 아랫면을 터치합니다. 낙서가 겹쳐 AI가 읽기 어려운 네 자리 목표를 순서대로 입력하면 성공합니다. 방향을 새로 누를 때마다 바닥 마찰과 가속력이 함께 크게 감소하며, 네 자리를 모두 입력한 뒤에만 정답 여부를 확인해 틀리면 입력값을 전부 비웁니다.

## 코드 분리

`index.mjs`는 ID 등록만, `minigame-kit.js`는 도형/에셋 표시 도구만 담당합니다. 게임별 상태는 새 `scene.state`와 게임이 생성한 씬 필드에 있습니다. 게임 파일끼리 서로를 참조하지 않습니다.

공통 `../game.mjs`가 입력, 120Hz 물리 시간, 20.26초 타이머, 결과 이벤트를 담당합니다. 게임의 `build/update/render` 및 선택적인 `action/press/pointerDown/pointerMove/pointerUp/cancelInput/timeout/dispose` 훅을 호출합니다. Phaser의 기존 속성과 겹치지 않도록 효과음은 `this.sfx()`를 사용합니다.

전환 시 입력/드래그/타이머/트윈/표시 객체를 정리합니다. 사람 쌓기의 Matter 월드는 `dispose`에서 파기합니다. 일시정지, 창 포커스 이탈, 드래그 취소는 발사하지 않고 입력을 해제합니다.

이름과 조작 설명은 `../../content/minigame-catalog.js`, 랜덤 선택은 `../run-state.mjs`, 최고 기록은 `../records.mjs`에서 관리합니다.

## 밈 에셋 연결

`assets/minigames/manifest.js`의 역할별 `null`을 이미지 경로로 교체합니다. 예:

```js
e3: { person: 'assets/minigames/e3/person.webp' }
```

`player`, `obstacle`, `person`, `target`, `projectile`, `prize`, `weight`, `stone` 역할은 manifest를 참고하세요. 투명 배경에 여백이 적은 이미지를 권장합니다. 이미지가 없거나 로딩되지 않으면 기본 캐릭터 도형을 사용합니다. 이미지 교체는 표시만 바꾸며 물리 판정을 변경하지 않습니다.

## 실행과 검증

원본을 수정한 뒤 실행 번들을 갱신합니다. `game-classic.js`는 직접 수정하지 않습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-archive-classic.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/minigame-browser.ps1
```

`index.html`을 직접 열어 플레이할 수 있습니다. 검증은 설치된 Chrome의 headless 모드에서 실제 Phaser 씬을 사용합니다. 브라우저 경로는 테스트 스크립트의 `$chrome`에서 변경합니다.

검증 범위: 10개 로딩, 막별 6개 중복 방지, 목숨과 막 재선정, 20.26초 종료, 성공 경로, 막별 억제 배율, 정지/전환 정리, 룰렛 당첨/꽝 판정, 숫자 블록 충돌·오답·낙서 표시·마찰 및 가속력 감소, 최고 기록, 실제 키보드와 축소된 모니터의 마우스 드래그. 화면 캡처는 `tests/.artifacts/`에 저장됩니다. 자동 입력 성공 경로는 플레이 난이도를 인간 대상으로 검증한 결과를 의미하지 않으며 세부 밸런스는 플레이테스트 후 조정합니다.

기존 `archive-*-check`와 `stage-split-baseline.json`은 이전 5개 게임용 회귀 자료입니다. 새 게임 검증에는 위 `minigame-browser.ps1`을 사용합니다.
