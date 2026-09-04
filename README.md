# 20.26 — 2026 물리 액션 게임

30시간 해커톤 프로젝트. Phaser 3 기반 정적 웹게임입니다.

- 공통 주제: **2026**
- 소재 주제: **물리법칙**
- 기능 주제: **제한** (20.26초 제한 시간)

- 게임 내부 기준 해상도: **1920 × 1080 (16:9)**
- 브라우저 화면이 작을 때는 16:9 비율을 유지한 채 자동 축소됩니다.

## 현재 상태 — 게임 내용 재설계 중

음성 조작 프로토타입(거제 야호 · 두쫀쿠)을 전부 걷어내고 메인 화면과 설정 UI만 남긴 상태입니다.

**지금 동작하는 것**

- 메인 화면 → 스테이지 선택 → 메인 화면 (화면 전환)
- 설정(마스터 볼륨 · BGM · 효과음 · 전체 화면), 값 저장과 되돌리기
- 일시정지 화면, 결과 화면(띄울 스테이지가 아직 없어 열리지 않음)
- 1920×1080 설계 좌표계 기준 UI 배율 고정

**아직 없는 것**

- 스테이지. 카드 3장은 모두 "준비 중"이고 진입 경로는 막혀 있습니다.
- 조작 방식. 정해지면 `js/core/game-events.js`에 입력 이벤트를 추가하는 것부터 시작합니다.
- 실제로 로드되는 이미지·오디오 에셋. 매니페스트는 비어 있습니다.

### 스테이지를 다시 여는 순서

1. `index.html`의 스테이지 카드에서 `disabled`와 `stage-select-card--soon`을 뗀다.
2. `js/ui/main-menu-flow.js`에 카드 선택 배선을 넣고 `startStage(stageId)`를 호출한다.
3. `js/scene/placeholder-scene.js`를 실제 씬으로 바꾸거나 새 씬을 만들어 `js/game.js`의 `scene` 배열에 추가한다.
4. 새 씬이 `STAGE_START` / `TIMER_TICK` / `STAGE_CLEAR` / `STAGE_FAIL`을 발행하면 결과 화면과 사운드가 자동으로 붙는다.

## 로컬 실행

VS Code의 Live Server 확장 프로그램으로 `index.html`을 열거나, 폴더에서 간단한 정적 서버를 실행하세요.

```bash
python -m http.server 8080
```

그다음 Chrome에서 `http://localhost:8080`을 엽니다.

## GitHub Pages 배포

1. 이 폴더 안의 모든 파일을 GitHub 저장소 루트에 업로드합니다.
2. 저장소의 `Settings` → `Pages`로 이동합니다.
3. `Build and deployment`의 Source를 `Deploy from a branch`로 선택합니다.
4. Branch를 `main`, 폴더를 `/ (root)`로 선택하고 저장합니다.
5. 생성된 `https://계정명.github.io/저장소명/` 주소를 Chrome에서 엽니다.

## 파일 구조와 담당 트랙

병렬 작업 중 같은 파일을 두 사람이 여는 일이 없도록 트랙별로 분리되어 있습니다.

| 경로 | 트랙 | 내용 |
|---|---|---|
| `js/core/game-events.js` | 🔒 동결 | 이벤트 계약. 전원 합의 후에만 변경 |
| `js/config/stage-geometry.js` | 🔒 동결 | 캔버스 규격(1920×1080). UI 배율의 기준이라 함부로 바꾸지 않는다 |
| `js/config/balance.js` | B 기능 | 제한 시간·중력 등 밸런스 값 |
| `js/content/strings.ko.js` | 카피 | JS가 주입하는 모든 한국어 문구 |
| `js/art/**` | A 비주얼 | 색·폰트·배치·모션·화면 배율 |
| `js/assets/image-manifest.js`, `js/art/sprite-animations.js` | C1 이미지 | 이미지 키↔경로, 스프라이트 애니메이션 |
| `js/assets/audio-manifest.js`, `js/audio/**` | C2 사운드 | 오디오 키↔경로, 볼륨·효과음·BGM |
| `js/scene/`, `js/ui/`, `js/game.js` | B 기능 | 물리·상태머신·타이머·화면 흐름 |
| `css/**` | A 비주얼 | 토큰 + 컴포넌트별 분리 |

### 트랙을 잇는 규칙

기능 코드는 **`gameEvents.emit()`만** 호출합니다. 연출·효과음을 직접 부르지 않습니다.
아트·사운드 코드는 **`gameEvents.on()`으로 구독만** 합니다. 물리 값을 바꾸지 않습니다.
이벤트 목록은 `js/core/game-events.js` 하나에 있습니다.

### 화면 배율 규칙

모든 DOM UI는 1920×1080 설계 화면 위에 **px로만** 그리고, `--ui-scale` 하나로 통째로 균일 축소됩니다
(`css/base.css`의 "UI 배율 규칙", `js/art/viewport-fit.js`).
`vw`·`vh`·`clamp()`나 화면 폭 기준 미디어 쿼리를 넣으면 창 비율이 바뀔 때 UI가 늘어나거나 눌립니다.

### 에셋을 추가하는 법

이미지는 `assets/images/` 에 파일을 넣고 `js/assets/image-manifest.js` 에 한 줄 추가합니다.
사운드는 `assets/audio/` 에 넣고 `js/assets/audio-manifest.js` 의 주석을 해제합니다.

에셋이 아직 없어도 게임은 프리미티브(사각형·이모지)로 폴백해 정상 동작하므로,
파일을 하나씩 채워 넣는 동안에도 다른 작업이 멈추지 않습니다.

> `sounds/bgm/*.mp3` 파일이 저장소에 있지만 아직 어디에도 연결되어 있지 않습니다.
> 쓸 곳이 정해지면 `assets/audio/bgm/`으로 옮기고 매니페스트에 등록하세요.

### 새 파일을 추가할 때

`index.html` 아래쪽 `<script>` 블록에서 **자기 트랙 주석 구획 안에** 추가합니다.
로드 순서는 위에서 아래로 의존합니다(공통 계약 → 에셋 → DOM → 아트 → 사운드 → 기능).
