import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = new URL('./', import.meta.url);
const sourceCsv = new URL('../../sounds/01_sfx_priority.csv', import.meta.url);
const outputXlsx = new URL('2026_archive_sfx_inventory.xlsx', outputDir);
const outputCsv = new URL('2026_archive_sfx_inventory.csv', outputDir);
const outputXlsxPath = fileURLToPath(outputXlsx);

const headers = [
  '전체순서', '중요도', '게임', '컨셉', '효과음 확정명', '납품 파일명', '재생 시점', '원하는 느낌',
  '권장 길이(초)', '반복', '영문 검색어', '한글 검색어', '제작 및 재생 지침', '현재 상태',
  '진행 상태(수정)', '선택한 음원 URL(수정)', '제작자 및 이용조건(수정)', '내 우선순위(수정)', '메모(수정)',
];

const makeRow = (priority, game, concept, name, stem, trigger, feel, seconds, loop, english, korean, guide, current) => [
  0, priority, game, concept, name, `sfx_${stem}.wav`, trigger, feel, seconds, loop, english, korean,
  guide, current, '미착수', '', '', priority, '',
];

const additions = [
  makeRow('P0', '공통', '전체 게임 공통', '스테이지 재소환', 'common_respawn',
    '제한시간 안에서 추락·충돌 후 플레이를 이어 가는 재소환 순간', '짧은 역재생 슝 + 데이터 복원 톡', 0.35, '아니오',
    'short game respawn rewind digital pop', '스테이지 재소환 효과음 짧은 역재생 슝 데이터 복원 톡',
    '스테이지 실패음과 구분; 입력 잠금이 풀리기 직전에 1회', '재소환 기능 존재; 현재는 공통 hit 합성음 사용'),
  makeRow('P0', '공통', '전체 게임 공통', '기억 손실', 'common_memory_lost',
    '스테이지 실패 후 기억이 1개 차감되는 순간', '낮은 유리 금 + 데이터 조각이 꺼지는 소리', 0.55, '아니오',
    'memory lost digital glass crack short', '기억 손실 효과음 낮은 유리 금 데이터 꺼짐',
    '공통 실패음 직후 120~180ms 뒤에 작게 겹침; 목숨 차감당 1회', '기억 차감 기능 존재; 전용 사운드 이벤트 분리 필요'),
  makeRow('P0', '공통', '전체 게임 공통', '기록 등록', 'common_record_registered',
    '클리어한 스테이지 기록이 자동 등록되는 순간', '보안 도장 탁 + 밝은 확인음', 0.65, '아니오',
    'secure record saved confirmation stamp chime', '기록 등록 효과음 보안 도장 확인음',
    '공통 성공음 뒤에 150ms 간격; 기록 수 증가와 정확히 동기화', '기록 등록 기능 존재; 전용 사운드 이벤트 분리 필요'),
  makeRow('P1', '공통', '전체 게임 공통', '시작 카운트', 'common_countdown_tick',
    '3·2·1 카운트 숫자가 바뀔 때', '짧고 마른 전자 틱', 0.08, '아니오',
    'minimal electronic countdown tick', '게임 시작 카운트다운 짧은 전자 틱',
    '3·2·1은 같은 파일; 시작 문구에는 스테이지 시작음을 사용', '카운트다운에서 현재 click 합성음 사용'),
  makeRow('P1', '공통', '전체 게임 공통', '일시정지 전환', 'common_pause_toggle',
    '일시정지 진입과 복귀 확정', '짧게 닫히는 필터음; 복귀는 피치 상승 변형', 0.22, '아니오',
    'game pause resume toggle short', '게임 일시정지 복귀 전환 효과음',
    '한 파일을 정방향/피치 변형으로 재사용 가능; 메뉴 버튼음보다 낮게', '일시정지·복귀 기능 존재; 전용 사운드 없음'),
  makeRow('P1', '공통', '스토리 및 진행', '막 전환', 'common_act_transition',
    'ACT 1→2, ACT 2→3 전환 타이틀 확정', '묵직한 데이터 셔터 + 저역 상승', 0.8, '아니오',
    'chapter transition digital shutter rise', '막 전환 효과음 데이터 셔터 저역 상승',
    '컷신 음악을 가리지 않도록 짧게; 막당 1회', '막 전환 연출 존재; 전용 사운드 이벤트 필요'),
  makeRow('P1', '공통', '스토리 및 진행', '아카이브 스캔', 'common_archive_scan',
    '기록·명령 서명·목표 카드가 스캔되며 드러날 때', '얇은 스캔 스윕 + 작은 디지털 입자', 0.7, '아니오',
    'sci fi archive scan reveal short', '아카이브 스캔 기록 공개 효과음',
    '텍스트 한 줄마다 반복하지 말고 패널 단위 1회; 대사 아래로 덕킹', '관련 화면 연출 존재; 전용 사운드 이벤트 필요'),
  makeRow('P1', '공통', '스토리 및 진행', '공공망 전송', 'common_network_transmit',
    '최종 기록 전송이 시작되어 여러 노드로 퍼지는 동안', '부드러운 데이터 펄스와 확장되는 노이즈', 2, '예',
    'data network upload pulse seamless loop', '공공망 기록 전송 루프 효과음',
    '전송 구간에서만 루프; 검증 완료 순간 즉시 페이드하고 엔딩 확인음 연결', '최종 전송 연출 존재; 전용 루프·이벤트 필요'),
  makeRow('P2', '공통', '전체 게임 공통', '메뉴 포커스', 'common_ui_focus',
    '키보드·패드로 선택 항목이 이동하거나 주요 버튼 호버', '아주 작은 고음 틱', 0.05, '아니오',
    'subtle ui focus hover tick', '메뉴 포커스 호버 아주 작은 틱',
    '마우스가 흔들릴 때 연타되지 않도록 80ms 제한; 접근성 설정에서 함께 음소거', '포커스 UI 존재; 현재는 의도적으로 생략'),
  makeRow('P2', '공통', '스토리 및 진행', '증언 기록 열기', 'common_record_open',
    '클리어 후 증언 기록 상세 패널을 열 때', '종이 넘김보다 디지털 카드가 펼쳐지는 소리', 0.35, '아니오',
    'digital archive card open short', '증언 기록 카드 열기 효과음',
    '같은 기록 안에서 탭 이동은 메뉴 선택음 재사용', '기록 열람 화면 기획 존재; 전용 사운드 이벤트 필요'),
  makeRow('P2', '공통', '스토리 및 진행', '기억 교란 글리치', 'common_memory_glitch',
    '3막 가짜 표식·화면 교란이 강해지는 핵심 연출', '짧은 디지털 찢김과 불안정한 잡음', 0.45, '아니오',
    'digital memory glitch tear short', '기억 교란 글리치 효과음 짧은 디지털 찢김',
    '지속 노이즈 대신 주요 변화에만 사용; 대사 중 반복 금지', '화면 교란 연출 존재; 전용 사운드 이벤트 필요'),
  makeRow('P2', '공통', '스토리 및 진행', '최종 검증 완료', 'common_ending_verified',
    'RECORDS VERIFIED 18/18 및 결말 확정', '넓고 맑은 코드 + 아주 짧은 저역 충격', 1.2, '아니오',
    'final verification cinematic chime short', '최종 기록 검증 완료 효과음',
    '음악성은 낮게 유지해 BGM과 충돌 방지; 게임 전체에서 1회', '최종 엔딩 연출 존재; 전용 사운드 이벤트 필요'),

  makeRow('P0', 'E3', '사람 쌓기', '사람 떨어뜨리기', 'e3_person_drop',
    '회전 각도를 확정하고 사람을 레일에서 놓는 순간', '짧은 공기 툭 + 가벼운 옷자락', 0.18, '아니오',
    'body drop release cloth whoosh short', '사람 쌓기 낙하 시작 옷자락 효과음',
    '낙하 횟수가 늘어도 피치를 과도하게 올리지 않음; 입력당 1회', '낙하 기능 존재; 현재 action 합성음 사용'),
  makeRow('P0', 'E3', '사람 쌓기', '사람 충돌', 'e3_body_impact',
    '낙하한 사람과 단상·다른 사람이 유효 속도로 충돌', '무겁지 않은 퍽 + 천 재질', 0.22, '아니오',
    'soft body impact cloth thump short', '사람 쌓기 충돌 효과음 퍽 천 재질',
    '충격 세기로 볼륨 변화; 여러 접점은 100ms 안에서 한 번으로 묶음', '충돌 판정과 100ms 제한 존재; 현재 hit 합성음 사용'),
  makeRow('P0', 'E3', '사람 쌓기', '단상 밖 추락', 'e3_person_fall',
    '사람이 단상을 놓치고 화면 아래로 완전히 이탈', '짧게 멀어지는 우웅 + 작은 툭', 0.45, '아니오',
    'cartoon fall away short muted', '사람 쌓기 단상 밖 추락 효과음',
    '화면 밖 제거 확정 때 1회; 공통 스테이지 실패음은 재생하지 않음', '화면 밖 제거 기능 존재; 사운드 없음'),
  makeRow('P0', 'E3', '사람 쌓기', '목표 높이 진입', 'e3_target_height',
    '탑이 목표 높이에 처음 닿아 3초 버티기가 시작될 때', '맑은 단음 + 짧은 유지 펄스', 0.3, '아니오',
    'target height reached hold start chime', '사람 쌓기 목표 높이 도달 버티기 시작음',
    '높이 아래로 내려가면 재무장; 다시 진입할 때만 재생', '3초 버티기 판정 존재; 전용 진입 이벤트 필요'),
  makeRow('P1', 'E3', '사람 쌓기', '대기 자세 회전', 'e3_rotate_step',
    'A/D 또는 방향키로 다음 사람 각도를 바꿀 때', '작은 기계식 톡', 0.06, '아니오',
    'small rotate step mechanical tick', '사람 쌓기 회전 입력 작은 톡',
    '길게 누를 때는 90ms 이상 간격; 낙하음보다 훨씬 작게', '회전 기능 존재; 사운드 없음'),
  makeRow('P2', 'E3', '사람 쌓기', '탑 흔들림', 'e3_stack_creak',
    '목표 높이 부근에서 탑의 각속도·속도가 커질 때', '낮은 옷 마찰과 작은 삐걱', 0.8, '예',
    'soft stack wobble creak cloth loop', '사람 탑 흔들림 작은 삐걱 루프',
    '위험도에 따라 볼륨만 상승; 안정되면 150ms 페이드', '물리 안정도 값 존재; 사운드 연동 없음'),

  makeRow('P0', 'E4', '왕사남 호랑이 추격', '호랑이 추격 시작', 'e4_tiger_chase_start',
    '3초 대기 후 호랑이가 실제 추격을 시작할 때', '짧은 북성 충격 + 낮은 으르렁', 0.55, '아니오',
    'tiger chase start growl impact short', '호랑이 추격 시작 낮은 으르렁 효과음',
    '플레이어에게 위험 전환을 알리는 선행 신호; BGM보다 앞에', '추격 지연·시작 상태 존재; 사운드 없음'),
  makeRow('P0', 'E4', '왕사남 호랑이 추격', '호랑이 포획', 'e4_tiger_catch',
    '호랑이와 플레이어가 충돌해 즉시 실패가 확정될 때', '짧은 덮침 + 굵은 타격', 0.4, '아니오',
    'animal pounce heavy hit short', '호랑이 포획 덮침 타격 효과음',
    '공통 실패음보다 먼저 재생; 과한 실제 동물 비명은 피함', '포획 실패 판정 존재; 현재 공통 failure만 사용'),
  makeRow('P1', 'E4', '왕사남 호랑이 추격', '호랑이 발소리', 'e4_tiger_steps',
    '호랑이가 걷거나 달리며 플레이어와 거리가 가까워질 때', '마른 흙 위 짧은 네발 발소리', 0.7, '예',
    'tiger running footsteps dirt loop', '호랑이 추격 네발 발소리 루프',
    '거리와 보행 상태로 볼륨·재생률 변화; 포획 순간 종료', '걷기·달리기 상태와 거리 값 존재; 사운드 없음'),

  makeRow('P0', 'E6', '중력 비행', '상승 점화', 'e6_lift_ignite',
    'Space를 눌러 상승이 시작되는 순간', '짧은 불꽃 팟 + 가벼운 상승 슝', 0.2, '아니오',
    'small fire ignition lift whoosh', '중력 비행 상승 점화 불꽃 슝 효과음',
    '키 다운 순간 1회; 누르고 있는 동안은 루프에 연결', '상승 입력 기능 존재; 현재 action 합성음 사용'),
  makeRow('P0', 'E6', '중력 비행', '장애물 충돌과 후퇴', 'e6_gate_collision',
    '글자 기둥·통로 벽에 닿아 뒤로 밀려날 때', '단단한 탁 + 낮은 역방향 슝', 0.35, '아니오',
    'arcade obstacle collision knockback short', '중력 비행 장애물 충돌 후퇴 효과음',
    '무적 시간 동안 반복 금지; 공통 재소환음과 겹치면 이 소리를 우선', '충돌·후퇴·0.85초 무적 기능 존재; 현재 hit 합성음 사용'),
  makeRow('P1', 'E6', '중력 비행', '상승 화염', 'e6_lift_flame',
    'Space를 누르고 상승하는 동안', '가볍고 얇은 불꽃 분사', 1.5, '예',
    'small flame jet seamless loop', '중력 비행 상승 화염 분사 루프',
    '열기 수치로 필터와 볼륨 변화; 키를 놓으면 100ms 페이드', '열기·누름 상태 값 존재; 사운드 없음'),
  makeRow('P1', 'E6', '중력 비행', '게이트 통과', 'e6_gate_pass',
    '장애물 사이 안전 간격의 중앙을 지나 다음 구간으로 넘어갈 때', '얇은 공기 스침 + 작은 확인 틱', 0.18, '아니오',
    'safe gate pass air tick short', '중력 비행 게이트 통과 공기 스침 효과음',
    '게이트당 1회; 충돌 직후에는 생략해 판정 혼동 방지', '게이트 위치·통과 진행 값 존재; 전용 통과 이벤트 필요'),
  makeRow('P2', 'E6', '중력 비행', '장애물 돌출', 'e6_gate_emerge',
    '화면 앞쪽의 글자 기둥이 통로 안으로 드러나기 시작할 때', '낮은 기계 슬라이드', 0.35, '아니오',
    'mechanical obstacle emerge slide short', '중력 비행 장애물 돌출 기계 슬라이드 효과음',
    '한 화면에서 여러 기둥이 겹치면 가장 가까운 것만 재생', '장애물 돌출 연출 존재; 사운드 없음'),

  makeRow('P0', 'E9', '얼음 컬링', '컬링 스톤 투구', 'e9_stone_release',
    '드래그를 놓아 스톤의 이동이 시작될 때', '묵직한 밀기 + 짧은 얼음 긁힘', 0.28, '아니오',
    'curling stone release push ice scrape', '컬링 스톤 투구 얼음 긁힘 효과음',
    '당긴 거리에 따라 볼륨 변화; 최소 드래그 미달에는 재생하지 않음', '투구 기능 존재; 현재 action 합성음 사용'),
  makeRow('P0', 'E9', '얼음 컬링', '스톤 활주', 'e9_stone_slide',
    '스톤이 얼음 위에서 이동하는 동안', '낮고 고운 얼음 마찰', 1.8, '예',
    'curling stone sliding on ice seamless loop', '컬링 스톤 얼음 활주 마찰 루프',
    '속도와 마찰 감소 횟수로 볼륨·고역 변화; 정지 80ms 전에 페이드', '속도·마찰 값 존재; 사운드 없음'),
  makeRow('P0', 'E9', '얼음 컬링', '스톤 정지', 'e9_stone_stop',
    '속도가 0이 되어 성공·실패 위치가 확정될 때', '낮은 사각 + 작은 톡', 0.2, '아니오',
    'curling stone settle stop ice short', '컬링 스톤 정지 안착 효과음',
    '판정 직전 1회; 성공이면 밝게, 실패면 낮게 피치 변형 가능', '정지 판정 존재; 전용 사운드 없음'),
  makeRow('P0', 'E9', '얼음 컬링', '과녁 빗나감과 재투구', 'e9_retry',
    '과녁 밖에서 멈추거나 링크 밖으로 나가 새 스톤이 준비될 때', '짧은 낮은 슬립 + 리셋 톡', 0.38, '아니오',
    'curling miss retry short slide reset', '컬링 과녁 빗나감 재투구 효과음',
    '스테이지 실패음과 구분; 실패 횟수 증가당 1회', '재투구 기능 존재; 현재 failure 합성음 사용'),
  makeRow('P1', 'E9', '얼음 컬링', '스톤 조준 당김', 'e9_stone_aim',
    '스톤을 잡아 당기며 투구 방향과 힘을 정할 때', '미세한 얼음 압력음과 고무 마찰', 1, '예',
    'curling stone aim pull tension loop', '컬링 스톤 조준 당김 효과음',
    '당김 거리로 볼륨 변화; 취소·투구에서 즉시 종료', '드래그 거리 값 존재; 사운드 없음'),
  makeRow('P1', 'E9', '얼음 컬링', '과녁 안착', 'e9_house_land',
    '성공 인정 범위 안에서 스톤이 멈춰 클리어가 확정될 때', '맑은 얼음 딩 + 낮은 안착 톡', 0.35, '아니오',
    'curling house success ice chime short', '컬링 과녁 안착 성공 효과음',
    '공통 성공음 바로 전에 재생; 가장자리 성공도 동일', '성공 반경 판정 존재; 현재 공통 success만 사용'),
  makeRow('P2', 'E9', '얼음 컬링', '링크 경계 이탈', 'e9_boundary_out',
    '스톤이 링크 바깥으로 나가 재투구가 확정될 때', '옆으로 빠지는 얼음 스침', 0.25, '아니오',
    'curling stone out of bounds ice swipe', '컬링 스톤 링크 경계 이탈 효과음',
    '재투구음보다 먼저 짧게; 별도 구분이 불필요하면 빗나감음으로 통합', '경계 이탈 판정 존재; 별도 사운드 없음'),

  makeRow('P1', 'E8', '거미줄 질주', '추락 재연결', 'e8_fall_recover',
    '화면 아래 추락 후 체크포인트 앵커로 되돌아갈 때', '빠르게 내려가는 바람 + 줄이 다시 당겨지는 탁', 0.5, '아니오',
    'web swing fall recover rewind short', '거미줄 질주 추락 재연결 효과음',
    '공통 재소환음 대신 게임 전용으로 사용 가능; 추락당 1회', '추락·체크포인트 복귀 기능 존재; 현재 hit 합성음 사용'),
  makeRow('P2', 'E8', '거미줄 질주', '거미줄 장력', 'e8_rope_tension',
    '스윙 최저점 부근에서 줄 장력과 속도가 커질 때', '얇게 팽팽해지는 섬유 마찰', 0.8, '예',
    'web rope tension strain seamless loop', '거미줄 장력 섬유 마찰 루프',
    '장력에 따라 볼륨 변화; 해제 즉시 80ms 페이드', '장력 계산 가능; 사운드 연동 없음'),

  makeRow('P2', 'E5', '두쫀쿠 새총', '다음 두쫀쿠 준비', 'e5_next_cookie',
    '발사체가 사라지고 다음 발사가 가능해질 때', '작은 접시 톡 + 말랑한 팝', 0.18, '아니오',
    'next projectile ready soft pop short', '두쫀쿠 새총 다음 발사 준비 효과음',
    '준비 문구와 동기화; 빠른 연속 파괴음 뒤에서는 생략 가능', '다음 발사 준비 상태 존재; 사운드 없음'),
  makeRow('P2', 'E5', '두쫀쿠 새총', '관통과 연속 파괴', 'e5_pierce_combo',
    '강한 발사로 표적을 관통하거나 2개 이상 연속 파괴', '바삭한 연속 팝 + 짧은 상승 악센트', 0.45, '아니오',
    'crunchy combo pierce rising accent short', '두쫀쿠 관통 연속 파괴 콤보 효과음',
    '기본 표적 파괴음 위에 작은 레이어; 콤보 수만큼 반복하지 않음', '관통·콤보 상태 존재; 현재 hit 합성음 사용'),

  makeRow('P2', 'E7', '월드컵 조추첨', '약한 스와이프 무효', 'e7_weak_swipe',
    '최소 이동·속도에 못 미쳐 룰렛이 돌지 않을 때', '힘 빠지는 작은 툭', 0.16, '아니오',
    'weak swipe invalid soft tick short', '룰렛 약한 스와이프 무효 효과음',
    '실패음과 구분; 안내 문구가 바뀔 때만 1회', '최소 스와이프 검증 존재; 사운드 없음'),

  makeRow('P1', 'E10', '피겨 암호', '링크 벽 반사', 'e10_rink_wall_bounce',
    '빙판 좌우 끝에 닿아 속도가 반대로 튕길 때', '짧은 얼음 긁힘 + 둔한 톡', 0.2, '아니오',
    'ice rink wall bounce scrape short', '피겨 암호 링크 벽 반사 얼음 긁힘 효과음',
    '공통 시간 손실 충돌음과 구분; 벽 반사당 1회', '좌우 경계 반사 기능 존재; 현재 hit 합성음 사용'),
  makeRow('P2', 'E10', '피겨 암호', '스케이트 밀기', 'e10_skate_push',
    '새 방향 입력으로 빙판을 밀며 가속할 때', '짧은 챡 + 눈가루 스침', 0.14, '아니오',
    'ice skate push stroke short', '피겨 암호 스케이트 밀기 효과음',
    '길게 누르는 동안 반복 금지; 방향이 새로 눌릴 때만', '방향 입력 횟수·가속 기능 존재; 사운드 없음'),
];

const sourceText = (await fs.readFile(sourceCsv, 'utf8')).replace(/^\uFEFF/, '');
const sourceBook = await Workbook.fromCSV(sourceText, { sheetName: '기존' });
const sourceSheet = sourceBook.worksheets.getItemAt(0);
const existingMatrix = sourceSheet.getUsedRange(true).values;
if (JSON.stringify(existingMatrix[0]) !== JSON.stringify(headers)) throw new Error('기존 CSV 열 구성이 예상과 다릅니다.');

const existingRows = existingMatrix.slice(1).map(row => {
  const normalized = [...row];
  normalized[8] = Number(normalized[8]);
  return normalized;
});
const allRows = [...existingRows, ...additions];
const filenames = allRows.map(row => row[5]);
if (new Set(filenames).size !== filenames.length) throw new Error('납품 파일명이 중복되었습니다.');

const priorityRank = { P0: 0, P1: 1, P2: 2 };
const gameRank = { '공통': 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5, E6: 6, E7: 7, E8: 8, E9: 9, E10: 10 };
allRows.sort((a, b) => priorityRank[a[1]] - priorityRank[b[1]] || gameRank[a[2]] - gameRank[b[2]] || String(a[4]).localeCompare(String(b[4]), 'ko'));
allRows.forEach((row, index) => { row[0] = index + 1; row[17] ||= row[1]; });

const workbook = Workbook.create();
const summary = workbook.worksheets.add('우선순위 요약');
const detail = workbook.worksheets.add('효과음 전체');
const fontFamily = 'Arial';
const dataStartRow = 5;
const dataEndRow = dataStartRow + allRows.length - 1;

summary.showGridLines = false;
summary.getRange('A1:H22').format.font = { name: fontFamily, size: 11, color: '#17212B' };
summary.getRange('A1').values = [['2026 ARCHIVE 효과음 우선순위']];
summary.getRange('A1').format.font = { name: fontFamily, size: 18, bold: true, color: '#17212B' };
summary.getRange('A2').values = [[`공통 흐름과 E1~E10의 실제 판정·조작·연출을 기준으로 정리한 ${allRows.length}개 효과음 목록`]];
summary.getRange('A2').format.font = { name: fontFamily, size: 10, italic: true, color: '#5B6573' };
summary.getRange('A3:H3').format.borders = { bottom: { style: 'thin', color: '#9AA6B2' } };

summary.getRange('A5:C5').values = [['중요도', '판단 기준', '수량']];
summary.getRange('A6:B8').values = [
  ['P0', '판정·위험·성공/실패를 소리만으로도 구분해야 하는 필수 항목'],
  ['P1', '조작 감각·이동 상태·주요 진행 연출을 명확히 하는 항목'],
  ['P2', '분위기·재질·세부 변주를 보강하며 일정에 따라 보류 가능한 항목'],
];
summary.getRange('C6').formulas = [[`=COUNTIF('효과음 전체'!$B$${dataStartRow}:$B$${dataEndRow},A6)`]];
summary.getRange('C6:C8').fillDown();
summary.getRange('A5:C8').format.borders = { preset: 'outside', style: 'thin', color: '#AEB8C2' };
summary.getRange('A5:C5').format = { fill: '#243B53', font: { name: fontFamily, size: 11, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
summary.getRange('A6:A8').format.font = { name: fontFamily, size: 11, bold: true };
summary.getRange('A6').format.fill = '#F8D7DA';
summary.getRange('A7').format.fill = '#FFF3CD';
summary.getRange('A8').format.fill = '#DDEBF7';
summary.getRange('C6:C8').format.numberFormat = '0';

const games = ['공통', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'];
summary.getRange('E5:G5').values = [['게임', '전체', 'P0']];
summary.getRange(`E6:E${5 + games.length}`).values = games.map(game => [game]);
for (let row = 6; row <= 5 + games.length; row++) {
  summary.getRange(`F${row}`).formulas = [[`=COUNTIF('효과음 전체'!$C$${dataStartRow}:$C$${dataEndRow},E${row})`]];
  summary.getRange(`G${row}`).formulas = [[`=COUNTIFS('효과음 전체'!$C$${dataStartRow}:$C$${dataEndRow},E${row},'효과음 전체'!$B$${dataStartRow}:$B$${dataEndRow},"P0")`]];
}
summary.getRange(`E5:G${5 + games.length}`).format.borders = { preset: 'outside', style: 'thin', color: '#AEB8C2' };
summary.getRange('E5:G5').format = { fill: '#243B53', font: { name: fontFamily, size: 11, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
summary.getRange(`F6:G${5 + games.length}`).format.numberFormat = '0';

summary.getRange('A11:C11').values = [['권장 작업 순서', '', '']];
summary.getRange('A11:C11').format = { fill: '#DCE6F1', font: { name: fontFamily, size: 11, bold: true, color: '#17212B' } };
summary.getRange('A12:C15').values = [
  ['1', 'P0 공통', '성공·실패·시간 경고·재소환·기억 손실·기록 등록부터 확정'],
  ['2', 'P0 게임별', '각 게임의 핵심 입력과 위험 판정음을 붙여 규칙 전달 확인'],
  ['3', 'P1', '이동 루프·재질·진행 연출을 추가하고 BGM과 음량 경쟁 점검'],
  ['4', 'P2', '실제 플레이에서 비어 보이는 구간만 선택 제작'],
];
summary.getRange('A12:A15').format.font = { name: fontFamily, size: 11, bold: true, color: '#1F4E78' };
summary.getRange('A17:C17').values = [['납품 기준', '', '']];
summary.getRange('A17:C17').format = { fill: '#DCE6F1', font: { name: fontFamily, size: 11, bold: true, color: '#17212B' } };
summary.getRange('A18:C21').values = [
  ['파일', 'WAV', '48 kHz · 16 또는 24 bit'],
  ['단발', '앞 무음 제거', '입력 반응이 늦게 들리지 않도록 정리'],
  ['루프', '무클릭 연결', '시작·끝 경계와 페이드 확인'],
  ['테스트', 'BGM 동시 재생', 'P0 판정음이 음악보다 먼저 들리는지 확인'],
];
summary.getRange('A5:G21').format.wrapText = true;
summary.getRange('A5:G21').format.verticalAlignment = 'center';
summary.getRange('1:1').format.rowHeight = 30;
summary.getRange('2:2').format.rowHeight = 22;
summary.getRange('5:5').format.rowHeight = 28;
summary.getRange('6:8').format.rowHeight = 46;
summary.getRange('9:10').format.rowHeight = 24;
summary.getRange('11:11').format.rowHeight = 28;
summary.getRange('12:15').format.rowHeight = 42;
summary.getRange('16:16').format.rowHeight = 24;
summary.getRange('17:17').format.rowHeight = 28;
summary.getRange('18:21').format.rowHeight = 34;
summary.getRange('A:A').format.columnWidth = 14;
summary.getRange('B:B').format.columnWidth = 46;
summary.getRange('C:C').format.columnWidth = 40;
summary.getRange('D:D').format.columnWidth = 4;
summary.getRange('E:E').format.columnWidth = 12;
summary.getRange('F:G').format.columnWidth = 10;
summary.freezePanes.freezeRows(3);

detail.showGridLines = false;
detail.getRange('A1').values = [['효과음 전체 목록']];
detail.getRange('A1').format.font = { name: fontFamily, size: 18, bold: true, color: '#17212B' };
detail.getRange('A2').values = [['P0 → P1 → P2, 공통 → E1~E10 순서. 진행 상태와 출처 정보는 O~S열에서 수정하세요.']];
detail.getRange('A2').format.font = { name: fontFamily, size: 10, italic: true, color: '#5B6573' };
detail.getRange('A3:S3').format.borders = { bottom: { style: 'thin', color: '#9AA6B2' } };
detail.getRangeByIndexes(3, 0, allRows.length + 1, headers.length).values = [headers, ...allRows];
const table = detail.tables.add(`A4:S${dataEndRow}`, true, 'SfxInventoryTable');
table.style = 'TableStyleMedium2';
table.showFilterButton = true;
table.showBandedColumns = false;
detail.getRange(`A4:S${dataEndRow}`).format.font = { name: fontFamily, size: 10, color: '#17212B' };
detail.getRange('A4:S4').format = { fill: '#243B53', font: { name: fontFamily, size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
detail.getRange(`A5:S${dataEndRow}`).format.verticalAlignment = 'top';
detail.getRange(`D5:H${dataEndRow}`).format.wrapText = true;
detail.getRange(`K5:S${dataEndRow}`).format.wrapText = true;
detail.getRange(`A5:C${dataEndRow}`).format.horizontalAlignment = 'center';
detail.getRange(`I5:J${dataEndRow}`).format.horizontalAlignment = 'center';
detail.getRange(`O5:O${dataEndRow}`).dataValidation = { rule: { type: 'list', values: ['미착수', '후보 확보', '편집 중', '게임 테스트', '확정', '보류'] } };
detail.getRange(`R5:R${dataEndRow}`).dataValidation = { rule: { type: 'list', values: ['P0', 'P1', 'P2', '보류'] } };
detail.getRange(`B5:B${dataEndRow}`).conditionalFormats.add('Custom', { formula: '=B5="P0"', format: { fill: '#F8D7DA', font: { bold: true, color: '#8A1C1C' } } });
detail.getRange(`B5:B${dataEndRow}`).conditionalFormats.add('Custom', { formula: '=B5="P1"', format: { fill: '#FFF3CD', font: { bold: true, color: '#7A5500' } } });
detail.getRange(`B5:B${dataEndRow}`).conditionalFormats.add('Custom', { formula: '=B5="P2"', format: { fill: '#DDEBF7', font: { bold: true, color: '#1F4E78' } } });
detail.getRange(`O5:O${dataEndRow}`).conditionalFormats.add('containsText', { text: '확정', format: { fill: '#D9EAD3', font: { bold: true, color: '#246B2A' } } });
detail.getRange(`O5:O${dataEndRow}`).conditionalFormats.add('containsText', { text: '보류', format: { fill: '#E5E7EB', font: { color: '#5F6368' } } });
detail.getRange(`I5:I${dataEndRow}`).format.numberFormat = '0.00';
detail.getRange('A:A').format.columnWidth = 9;
detail.getRange('B:B').format.columnWidth = 9;
detail.getRange('C:C').format.columnWidth = 9;
detail.getRange('D:D').format.columnWidth = 25;
detail.getRange('E:E').format.columnWidth = 25;
detail.getRange('F:F').format.columnWidth = 34;
detail.getRange('G:G').format.columnWidth = 36;
detail.getRange('H:H').format.columnWidth = 34;
detail.getRange('I:I').format.columnWidth = 13;
detail.getRange('J:J').format.columnWidth = 9;
detail.getRange('K:K').format.columnWidth = 38;
detail.getRange('L:L').format.columnWidth = 42;
detail.getRange('M:M').format.columnWidth = 52;
detail.getRange('N:N').format.columnWidth = 44;
detail.getRange('O:O').format.columnWidth = 16;
detail.getRange('P:P').format.columnWidth = 34;
detail.getRange('Q:Q').format.columnWidth = 34;
detail.getRange('R:R').format.columnWidth = 17;
detail.getRange('S:S').format.columnWidth = 38;
detail.getRange('4:4').format.rowHeight = 42;
detail.getRange(`5:${dataEndRow}`).format.rowHeight = 58;
detail.freezePanes.freezeRows(4);
detail.freezePanes.freezeColumns(3);

const csvEscape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = '\uFEFF' + [headers, ...allRows].map(row => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
await fs.writeFile(outputCsv, csv, 'utf8');

const summaryCheck = await workbook.inspect({ kind: 'table', range: '우선순위 요약!A1:G21', include: 'values,formulas', tableMaxRows: 24, tableMaxCols: 8 });
const detailCheck = await workbook.inspect({ kind: 'table', range: `효과음 전체!A1:S${Math.min(dataEndRow, 14)}`, include: 'values,formulas', tableMaxRows: 16, tableMaxCols: 19 });
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 300 }, summary: 'final formula error scan' });
console.log(summaryCheck.ndjson);
console.log(detailCheck.ndjson);
console.log(errors.ndjson);

const summaryPreview = await workbook.render({ sheetName: '우선순위 요약', range: 'A1:G21', scale: 1.4, format: 'png' });
const detailTopPreview = await workbook.render({ sheetName: '효과음 전체', range: 'A1:S15', scale: 1, format: 'png' });
const detailBottomPreview = await workbook.render({ sheetName: '효과음 전체', range: `A${Math.max(4, dataEndRow - 9)}:S${dataEndRow}`, scale: 1, format: 'png' });
await fs.writeFile(new URL('preview_summary.png', outputDir), new Uint8Array(await summaryPreview.arrayBuffer()));
await fs.writeFile(new URL('preview_detail_top.png', outputDir), new Uint8Array(await detailTopPreview.arrayBuffer()));
await fs.writeFile(new URL('preview_detail_bottom.png', outputDir), new Uint8Array(await detailBottomPreview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputXlsxPath);

const counts = Object.fromEntries(['P0', 'P1', 'P2'].map(priority => [priority, allRows.filter(row => row[1] === priority).length]));
console.log(JSON.stringify({ output: outputXlsxPath, csv: fileURLToPath(outputCsv), rows: allRows.length, counts, dataEndRow }));
