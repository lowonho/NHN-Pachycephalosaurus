# 스테이지별 게임 코드

게임 화면 구성과 조작, 프레임 업데이트는 아래 파일에서 수정합니다.

| 파일 | 스테이지 | 규칙·물리 계산 |
| --- | --- | --- |
| e1.mjs | 01 미로 | ../physics-core.mjs, ../level-data.mjs |
| e2.mjs | 02 중력 | ../gravity-core.mjs |
| e3.mjs | 03 바운스 | ../bounce-core.mjs |
| e4.mjs | 04 마찰 | ../friction-stop.mjs, e4.mjs 내부 이동·충돌 |
| e5.mjs | 05 쌓기 | ../stack-core.mjs |

각 모듈은 build, update, press, release와 필요한 action/pointer 훅을 내보냅니다.
훅의 this는 공통 Phaser 씬입니다. state에는 현재 스테이지 상태를 저장하고,
drawWalls, drawGoal, finish, checkFragment 같은 공통 씬 기능을 호출할 수 있습니다.
다른 스테이지의 훅을 직접 호출하지 않습니다.

index.mjs는 기존 스테이지 ID와 e1~e5를 연결합니다.
shared.mjs는 화면 크기, 범위 제한, 이벤트 전송을 제공합니다.
../game.mjs는 Phaser 초기화, 타이머, 입력 전달, 결과, 기억 조각을 관리합니다.
스테이지 안내 문구는 ../data.mjs, 기억 조각 위치는 ../fragments.mjs에 있습니다.

수정 후 프로젝트 루트에서 실행용 번들을 갱신합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-archive-classic.ps1
```

index.html은 로컬 파일로도 열 수 있도록 생성된 game-classic.js를 사용합니다.
game-classic.js를 직접 수정하지 말고 원본 모듈을 수정한 후 빌드합니다.

분리 전과 동일한 입력에 대한 실행 상태 및 재시작·일시정지를 확인합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/archive-stage-split-browser.ps1
```

tests/fixtures/stage-split-baseline.json은 분리 전 게임에서 기록한 상태입니다.
게임 규칙을 의도적으로 변경하면 관련 검증 기준도 검토해야 합니다.
