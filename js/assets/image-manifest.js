/*
 * C1(이미지) 전용 — 이미지 에셋 키↔경로 매핑.
 *
 * 키 추가는 자유. 키 삭제·개명은 아트(A)가 참조하므로 합의 후 진행한다.
 * 파일을 넣고 아래 ACTIVE 배열에 한 줄 추가하면 그 순간부터 화면에 반영된다.
 * (뷰는 텍스처가 없으면 프리미티브로 폴백하므로, 에셋이 없어도 게임은 계속 동작한다.)
 *
 * 옛 스테이지 전용 키(장애물·포토존·말풍선·마이크 아이콘)는 게임을 새로 정하면서 걷어냈다.
 * assets/images/backgrounds/geoje-sea.png 파일 자체는 남겨 두었지만 더는 로드하지 않는다.
 */

// 뷰가 참조하는 예약 키. 파일이 아직 없어도 이름은 먼저 고정한다.
const TEXTURE_KEYS = Object.freeze({
  background: "stageBackground",
  ground: "groundTile",
});

// 실제로 로드할 파일 목록. 새 스테이지가 정해지면 여기부터 채운다.
const IMAGE_MANIFEST = Object.freeze([
  // { key: TEXTURE_KEYS.background, path: "assets/images/backgrounds/…" },
  // { key: TEXTURE_KEYS.ground,     path: "assets/images/props/ground-tile.png" },
]);

// 스프라이트시트는 프레임 크기가 필요하므로 별도 목록으로 관리한다.
const SPRITESHEET_MANIFEST = Object.freeze([
  // { key: "playerRun", path: "assets/images/characters/player-run.png",
  //   frameConfig: { frameWidth: 81, frameHeight: 123 } },
]);
