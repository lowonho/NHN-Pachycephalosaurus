import fs from 'node:fs/promises';
import { Workbook } from '@oai/artifact-tool';

const dir = new URL('./', import.meta.url);
// priority | game | name | stable filename stem | trigger | sound brief | seconds | loop | search | production / playback
const source = `P0|공통|시간 손실 충돌|common_penalty_hit|벽 충돌 등 시간 차감 판정 순간|짧고 둔한 퍽 + 낮은 디지털 하강음|0.25|아니오|arcade impact damage short|충돌과 시간 손실을 한 소리로; 연속 접촉에는 판정당 1회
P0|공통|스테이지 성공|common_stage_clear|클리어 확정|밝은 3음 상승 징글|0.8|아니오|arcade success jingle short|직접 합성 가능; 게임별 성공음은 이 소리를 재사용
P0|공통|스테이지 실패|common_stage_fail|실패 확정|낮아지는 2음 + 짧은 끊김|0.7|아니오|arcade fail game over short|단순 충돌과 구분; 목숨 손실마다 1회
P0|공통|시간 부족 경고|common_timer_warning|남은 시간 경고 진입|날카롭지 않은 짧은 삑|0.12|아니오|soft countdown warning beep|직접 합성; 마지막 5초 초당 1회 제안; 중복 경고 금지
P0|E4|누적 가속 탭|e4_accel_tap|방향키를 새로 누를 때|짧은 슝 + 상승 신스|0.18|아니오|arcade boost short synth whoosh|누적 속도에 따라 피치 상승; 길게 누르기는 반복 재생하지 않음
P0|E4|밀리는 브레이크|e4_brake_slide|키를 놓고 관성으로 감속|가벼운 끼익 + 마찰|0.6|아니오|short tire skid cartoon brake|차량 엔진보다 얇게; 속도가 낮으면 생략; 정지하면 페이드
P0|E8|거미줄 발사와 부착|e8_web_attach|앵커 연결 성공|쐭 + 쫀득한 탁|0.3|아니오|elastic whip sticky snap whoosh|고무줄 튕김과 접착 소리 합성; 부착 실패 때는 재생하지 않음
P0|E8|거미줄 해제|e8_web_release|줄을 놓고 날아갈 때|짧은 휙|0.2|아니오|fast whip release short|부착음보다 가볍게; 실제 줄 해제에만 1회
P0|E5|새총 발사|e5_slingshot_release|두쫀쿠 발사|팡 + 고무줄 튕김|0.3|아니오|slingshot rubber band release|직접 고무줄 녹음 가능; 당긴 세기에 따라 볼륨 변화
P0|E5|두딱쿠 명중|e5_target_pop|표적 제거 확정|초콜릿 바삭 + 낮은 뽁|0.3|아니오|chocolate crack soft pop impact|과자 부수기와 팝 합성; 나무 타격보다 명확하게
P0|E7|룰렛 칸 통과|e7_roulette_tick|회전 중 국가 칸 경계 통과|건조한 딸깍|0.05|아니오|wheel fortune tick ratchet single|단발 파일; 회전 속도로 간격 결정; 과밀하면 40ms 간격 제한 제안
P0|E7|추첨 정지|e7_draw_stop|룰렛이 완전히 멈춤|묵직한 탁|0.2|아니오|mechanical wheel stop clunk|정지 순간 1회 후 공통 성공/오답 소리; 결과가 들리도록 시간차
P0|E2|왁뿌볼 점프|e2_wax_jump|점프 성립|말랑한 뿅|0.18|아니오|soft rubber ball boing short|직접 합성; 착지와 다른 음높이
P0|E2|왁스 껍질 균열|e2_wax_crack|점프로 껍질이 깎일 때|얇게 빠각 부스러지는 소리|0.25|아니오|thin wax shell crack crinkle|얇은 과자/왁스 녹음; 점프 위에 작게 겹쳐 점프력 감소 전달
P0|E1|중력 반전|e1_gravity_flip|중력 전환 입력 성립|상하로 꺾이는 디지털 슝|0.18|아니오|8 bit gravity flip laser sweep|직접 신스 합성; 반전 방향별 피치 변형으로 같은 파일 활용
P0|E10|회전 점프|e10_spin_jump|점프 성립|빙판 긁기 + 가벼운 휘익|0.3|아니오|ice skate jump spin whoosh|빙판 이륙과 회전 합성; 착지 소리는 별도
P0|E10|정답 숫자 입력|e10_digit_correct|올바른 숫자 블록 입력|맑은 딩 + 작은 얼음 톡|0.25|아니오|ice chime correct answer short|숫자 진행별 피치 소폭 상승; 최종 4자리 완성은 공통 성공음
P0|E10|오답 숫자 입력|e10_digit_wrong|잘못된 숫자 블록 입력|짧고 낮은 둣|0.2|아니오|soft wrong answer error blip|스테이지 실패보다 짧게; 오답과 게임 종료 구분
P1|공통|메뉴 선택|common_ui_click|버튼 선택 성립|작은 디지털 톡|0.08|아니오|minimal game ui click|직접 합성; 모든 메뉴 재사용; 이동 호버음은 생략
P1|공통|스테이지 시작|common_stage_start|조작 가능 상태 진입|짧은 시작 신호|0.4|아니오|arcade ready start cue short|시작 문구마다 반복하지 말고 실제 시작에 1회
P1|E4|속도 바람|e4_speed_wind|이동 속도가 높아질 때|얇은 바람과 신스 질주감|2|예|sci fi racing wind loop seamless|속도로 볼륨/필터 변화; 정지와 메뉴에서 종료; 브레이크를 가리지 않게
P1|E8|스윙 바람|e8_swing_wind|빠르게 스윙하거나 비행|넓게 흐르는 바람|2|예|fast air movement wind loop|실제 속도로 볼륨 변화; 화면 최저점 통과에서 자연스럽게 커짐
P1|E8|새 앵커 가속|e8_anchor_boost|새 앵커 연결로 가속 보상|밝은 짧은 상승음|0.25|아니오|power up boost sparkle short|일반 연결과 구분; 이미 쓴 앵커는 생략; 부착음 위에 작은 레이어
P1|E5|새총 당김|e5_slingshot_stretch|조준 드래그 시작과 당김|고무줄이 늘어나는 뿌득|1|예|rubber stretch creak loop|당김 거리로 피치/볼륨; 발사와 취소에서 종료
P1|E5|목재 충돌|e5_wood_hit|목재에 충돌|가벼운 나무 툭|0.2|아니오|wood block impact dry short|충돌 세기별 볼륨; 약한 접촉 생략; 표적 제거음 우선
P1|E5|목재 파괴|e5_wood_break|나무 파손 판정|우두둑 + 작은 조각 낙하|0.6|아니오|small wooden crate break debris|파편 전부에서 울리지 않게 100ms 묶음 처리 제안
P1|E7|당겨서 돌리기|e7_spin_release|조작을 놓아 룰렛 회전 시작|탄력 있는 휙|0.25|아니오|wheel spin release whoosh short|룰렛 딸깍과 겹쳐도 짧게; 시작 입력 때 1회
P1|E7|목표 국가 빗나감|e7_draw_miss|목표 국가가 아닌 곳에 정지|짧은 코믹 하강음|0.4|아니오|comedy disappointment short muted trombone|스테이지 종료 실패음과 구분; 다음 추첨 방해하지 않게 짧게
P1|E2|말랑 착지|e2_wax_land|공중에서 발판 착지|낮고 부드러운 뭉|0.15|아니오|soft ball landing rubber thud|강한 착지에만; 점프/균열보다 작게
P1|E2|발판 붕괴|e2_platform_crumble|밟은 발판이 무너짐|짧은 바스락 우수수|0.5|아니오|small platform crumble debris|실제 붕괴 시점 1회; 왁스 균열보다 넓은 질감
P1|E1|천장 바닥 착지|e1_surface_land|반전 후 면에 도착|단단한 디지털 탁|0.12|아니오|8 bit landing tap short|반전음보다 낮게; 접촉 유지 중 반복 금지
P1|E1|가시 낙하|e1_spike_drop|새 가시가 낙하 시작|짧은 날카로운 휙|0.25|아니오|small sharp object falling whoosh|실제 위험 등장에 동기화; 여러 가시는 묶어서 1회
P1|E10|빙판 활주|e10_skate_glide|빙판 위에서 이동|사각사각 얇은 스케이트 마찰|2|예|ice skating blade glide loop|속도로 볼륨 변화; 공중에서는 중지; 방향 입력마다 새 파일 시작 금지
P1|E10|빙판 착지|e10_skate_land|점프 후 착지|짧게 챡|0.2|아니오|ice skate landing scrape short|활주보다 선명하게; 착지 판정 1회
P2|E4|최고속 도달|e4_max_speed|최고 속도에 처음 도달|짧은 고음 파워업|0.25|아니오|arcade max power notification|최고속 유지 중 반복 금지; 속도감이 충분하면 생략 가능
P2|E5|두쫀쿠 튕김|e5_cookie_bounce|발사체가 바닥에서 반동|둔탁한 과자 톡|0.2|아니오|cookie biscuit impact bounce|나무/표적 효과음과 우선순위 충돌 시 생략
P2|E7|관중 기대감|e7_crowd_murmur|룰렛 감속으로 결과가 가까워짐|작은 웅성거림|2|예|small crowd anticipation murmur loop|보컬 없는 군중 질감; 정지와 동시에 종료; 딸깍이 항상 앞에
P2|E7|추첨 성공 환호|e7_crowd_cheer|목표 국가 당첨|짧은 와아|1|아니오|small crowd cheer short no music|직접 여러 목소리 녹음 가능; 공통 성공음 뒤에 작게
P2|E8|공중 회전 스침|e8_air_pass|빠른 장애물/지점 스침 연출|작은 슉|0.2|아니오|fast air pass by short|별도 연출 조건 추가가 필요; 스윙 바람으로 충분하면 보류
P2|E10|서리 덮임|e10_frost_cover|암호가 서리에 가려지는 연출|차가운 사르르|0.5|아니오|frost freezing ice shimmer short|보이는 서리 변화에만; 시작부터 고정으로 가려져 있으면 생략`;
const gameNames = {공통:'전체 게임 공통',E1:'중력 대쉬',E2:'왁뿌볼 / 바운스볼',E4:'가속 대쉬',E5:'두쫀쿠 새총',E7:'월드컵 조추첨',E8:'거미줄 질주',E10:'피겨 암호'};
const headers=['전체순서','중요도','게임','컨셉','효과음 확정명','납품 파일명','재생 시점','원하는 느낌','권장 길이(초)','반복','영문 검색어','한글 검색어','제작 및 재생 지침','현재 상태','진행 상태(수정)','선택한 음원 URL(수정)','제작자 및 이용조건(수정)','내 우선순위(수정)','메모(수정)'];
const rows=source.split('\n').map((l,i)=>{const [p,g,n,id,t,b,d,loop,q,how]=l.split('|');return [i+1,p,g,gameNames[g],n,`sfx_${id}.wav`,t,b,Number(d),loop,q,`${n} 효과음 ${b}`,how,'전용 파일 미등록; 현재 일부 이벤트는 공통 합성음 사용','미착수','','',p,''];});

const bgmHeaders=['순서','중요도','구분','게임 또는 용도','파일명(기존 유지/신규 고정)','현재 확인 사실','다음 행동','제안 음악 방향','제안 BPM','권장 루프 길이(초)','영문 검색어 또는 제작 브리프','진행 상태(수정)','배정/선택 URL(수정)','제작자 및 이용조건(수정)','메모(수정)'];
const existing=['main_theme','intro','yaho','tiger','redred','dubai'].map((n,i)=>[i+1,'P0','기존 점검',n==='main_theme'?'공통 메인':'미배정',`bgm_${n}.mp3`,n==='main_theme'?'파일 존재; js/archive/audio.mjs 재생 참조 확인':'파일 존재; js에서 직접 재생 참조 미확인','청취 후 분위기/루프/사용 구간 기록','청취 전이라 미판정','','','신규 검색 전에 기존 파일 먼저 청취','청취 대기','','','파일명만으로 밈/게임 매칭하지 않음']);
const plans=[
 ['P1','E4','accel_maze','질주하는 전자 비트; 조작음이 들리는 단순한 리듬',145,32,'instrumental arcade racing synth loop 145 bpm'],
 ['P1','E8','web_swing','가벼운 영웅적 질주; 바람 소리를 위한 여백',135,32,'playful heroic action instrumental loop 135 bpm'],
 ['P1','E7','world_draw','우스꽝스러운 추첨 긴장감; 딸깍 리듬과 충돌하지 않게',105,32,'quirky suspense game show instrumental loop 105 bpm'],
 ['P2','E2','wax_ball','말랑하고 통통 튀는 장난감 퍼커션',115,32,'bouncy quirky toy percussion instrumental loop 115 bpm'],
 ['P2','E5','cookie_sling','묵직하고 장난스러운 리듬; 과자 파괴 소리 공간 확보',100,32,'playful cartoon percussion instrumental loop 100 bpm'],
 ['P2','E1','gravity_dash','규칙적인 전자 리듬; 반전음이 드러나는 짧은 패턴',140,32,'chiptune arcade platformer instrumental loop 140 bpm'],
 ['P2','E10','figure_code','빙판의 우아함과 암호 풀이의 긴장감을 같이',110,32,'playful icy waltz puzzle instrumental loop 110 bpm'],
].map(([p,g,id,brief,bpm,d,q],i)=>[i+7,p,'부족할 때 제작',g,`bgm_${g.toLowerCase()}_${id}.mp3`,'전용 파일 없음; 기존 6곡으로 충당 가능한지는 청취 필요','기존곡 재사용 검토 → 빈 용도만 검색/제작',brief,bpm,d,`${q}; no vocals; seamless loop; no long intro; original melody`,'기존곡 검토 대기','','','기존곡을 쓰면 원래 파일명 유지; 제안 길이/BPM은 측정값 아님']);

async function saveCSV(name,head,data){
 const wb=Workbook.create(); const sh=wb.worksheets.add('목록');
 sh.getRangeByIndexes(0,0,data.length+1,head.length).values=[head,...data];
 const matrix=sh.getRangeByIndexes(0,0,data.length+1,head.length).values;
 if(matrix.length!==data.length+1 || matrix.some(r=>r.length!==head.length)) throw Error('row shape');
 const csv='\uFEFF'+matrix.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
 await fs.writeFile(new URL(name,dir),csv,'utf8');
 const reread=await Workbook.fromCSV(csv.replace(/^\uFEFF/,''),{sheetName:'검수'});
 const check=reread.worksheets.getItemAt(0).getRangeByIndexes(0,0,data.length+1,head.length).values;
 if(JSON.stringify(check.map(r=>r.map(String)))!==JSON.stringify(matrix.map(r=>r.map(v=>String(v??''))))) throw Error('CSV roundtrip mismatch');
 console.log(name, data.length,'rows', (await reread.inspect({kind:'region',sheetId:'검수',range:'A1:F3',maxChars:1200,tableMaxCols:6})).ndjson);
}
if(new Set(rows.map(r=>r[5])).size!==rows.length) throw Error('duplicate filename');
if(rows.some(r=>['E3','E6','E9'].includes(r[2]))) throw Error('excluded game');
await saveCSV('01_sfx_priority.csv',headers,rows);
await saveCSV('02_bgm_inventory_plan.csv',bgmHeaders,[...existing,...plans]);
console.log('Verified games:', [...new Set(rows.map(r=>r[2]))].join(', '));
