# E1 밈 공격 에셋

실제 파일은 `assets/images/minigame/geomatric dash/memes`에 있습니다.

- `jena.png`: 왕관 뒤에 서 있는 제나
- `jena-crown.png`: 제나 앞에서 날아오는 사선 왕관
- `liv.png`: 발 공격 뒤에 서 있는 리브
- `liv-foot.png`: 리브 앞에서 찍히는 발가락 따봉
- `woni-fire-up1…5.png`: 위쪽으로 뿜는 원이 불꽃
- `woni-fire-down1…5.png`: 아래쪽으로 뿜는 원이 불꽃
- `woni-fire-diagonal1…5.png`: 후반 난이도 확장용 사선 불꽃
- `yaho.png`: 원이가 달릴 때만 등장하는 거대 미나미

한 판에는 기본 장애물 7개와 밈 공격 3개가 등장합니다. 밈 공격은 느낌표 경고 뒤에 시작하며, 제나와 리브는 공격 뒤쪽에 함께 표시됩니다. 원이 불꽃은 캐릭터가 포함된 프레임을 그대로 사용하고, 거대 미나미는 다리 사이가 실제 안전 통로입니다.

원본을 다시 가져올 때는 `scripts/import-e1-meme-assets.ps1`에 여덟 입력 경로를 넘깁니다. 이미지는 표시용이고 충돌 판정은 `e1_gravityDash.js`에서 별도로 관리합니다.
