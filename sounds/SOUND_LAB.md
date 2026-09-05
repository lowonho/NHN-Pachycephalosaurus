# SOUND LAB 사용법

게임별 BGM은 `js/audio/audio-tuning.js` 한 파일에서 경로, 트랙별 게인, 루프 시작·끝,
크로스페이드 시간을 관리합니다. 기본 배정은 메인과 E1~E8·E10에 연결되어 있습니다.
삭제된 E9의 남은 BGM 파일은 재생·밸런스·누락 검사 대상에서 제외했습니다.
게임 설명 브리핑은 의도적으로 무음이며, 실제 게임 시작 입력 뒤 해당 게임 BGM부터 재생합니다.
나중에 성공·실패 SFX나 브리핑 전용 음악을 추가해도 메인 테마와 겹치지 않습니다.

## 플레이하면서 바로 조정하기

`index.html?audioLab=1`로 게임을 열면 오른쪽 위에 개발용 패널이 나타납니다.

- BGM: 트랙 선택, 처음부터 재생, 일시정지, 트랙별 게인, 크로스페이드, 루프 구간
- 합성 SFX: 기존 `click`, `action`, `warning`, `hit`, `success`, `failure`의 첫 음을
  주파수·길이·게인·피치 이동·파형으로 조정하고 즉시 미리듣기
- 파일 SFX: 연결된 31개 효과음의 게인과 기본 재생 속도를 조정하고 즉시 미리듣기
- 후보 파일 A/B: 아직 프로젝트에 넣지 않은 WAV/MP3를 골라 현재 게임 위에서 미리듣기
- 설정 JSON 저장: 현재 브라우저의 조정값을 `archive-audio-tuning.json`으로 내려받기

패널의 값은 브라우저 로컬 저장소에 자동 저장됩니다. 확정한 값은 내려받은 JSON을 보고
`js/audio/audio-tuning.js`의 기본값에 옮기면 모든 브라우저에 적용됩니다. 일반 URL에서는
패널 코드가 아무 UI도 만들지 않습니다.

## 새 SFX 파일 붙이기

1. 원본은 `sounds/sfx/`에 MP3·OGG·WAV 중 하나로 넣습니다.
2. `js/assets/audio-manifest.js`의 `AUDIO_KEYS`와 `AUDIO_MANIFEST`에 키와 경로를 등록합니다.
3. 같은 파일의 `SFX_EVENT_MAP`에서 게임 이벤트에 키를 연결합니다.
4. `js/audio/audio-tuning.js`의 `sfx.files`에 같은 키의 `gain`, `rate`, `throttleMs`를 넣으면 파일별 밸런스를 한곳에서 조정할 수 있습니다.
5. 파일형 SFX는 `file://` 직접 실행에서도 동작하도록 네이티브 오디오 풀에서 재생됩니다.
6. `powershell -ExecutionPolicy Bypass -File scripts/check-audio-assets.ps1`로 누락 및 미배정 파일을 확인합니다.

반복 효과음은 정지·실패·일시정지·스테이지 전환에서 반드시 끄고, 같은 충돌이 한 프레임에
겹칠 때는 `sfx-player.js`의 스로틀을 거쳐 한 번만 재생합니다. 결과음이 나올 때 BGM은 잠깐
낮아지도록 이미 연결되어 있습니다.
