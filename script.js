// ============================================================
// 스터디룸 예약서 — script.js
// 기능: 실시간 금액 계산 / 인원 제한 / 폼 검증 / 예약 확인 메시지
//       Supabase 연동으로 예약 데이터 저장
// ============================================================


// ──────────────────────────────────────────────────────────
// 0. Supabase 설정
//
//    Supabase 프로젝트 대시보드 → Settings → API 에서
//    Project URL과 anon/public Key를 복사해서 아래에 붙여넣으세요.
//
//    ⚠️  실제 서비스라면 이 키를 외부에 공개하지 마세요.
//        학습·수업용이므로 여기에 직접 넣는 방식을 사용합니다.
// ──────────────────────────────────────────────────────────

/** Supabase 프로젝트 URL — 직접 입력하세요 */
const SUPABASE_URL = 'https://njlvrgezrkmknejlajlf.supabase.co';

/** Supabase anon(공개) API 키 — 직접 입력하세요 */
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbHZyZ2V6cmtta25lamxhamxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjQzMzIsImV4cCI6MjEwNzAwMDMzMn0.bdeLjw80uiJM4sRb5axslgNVNivz5NWAi6CZH2i-hB0';

// CDN으로 로드된 supabase 전역 객체에서 createClient 함수를 꺼냄
// (index.html에서 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"> 로 먼저 로드)
const { createClient } = supabase;

/** Supabase 클라이언트 — 데이터베이스 읽기/쓰기에 사용 */
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);


// ──────────────────────────────────────────────────────────
// 1. DOM 요소 가져오기
//    document.getElementById() 등으로 HTML 요소를 변수에 저장.
//    여러 곳에서 같은 요소를 쓸 때 매번 찾으면 느려지므로
//    페이지가 시작될 때 딱 한 번만 가져와 변수에 보관한다.
// ──────────────────────────────────────────────────────────

/** 스터디룸 선택 드롭다운 */
const roomSelect = document.getElementById('room-select');

/**
 * 이용 시간 라디오 버튼 전체 목록 (NodeList)
 * querySelectorAll은 조건에 맞는 모든 요소를 한꺼번에 가져온다.
 */
const timeRadios = document.querySelectorAll('input[name="useTime"]');

/** 대여 장비 체크박스 전체 목록 (NodeList) */
const equipCheckboxes = document.querySelectorAll('input[name="equipment"]');

/** 인원수 입력칸 */
const peopleCountInput = document.getElementById('people-count');

/** 인원 초과 오류 메시지를 표시할 문단 요소 */
const peopleErrorEl = document.getElementById('people-error');

/** 예상 금액을 표시할 문단 요소 */
const estimatedPriceEl = document.getElementById('estimated-price');

/** 예약 폼 전체 */
const reservationForm = document.getElementById('reservation-form');

/** 예약 완료 확인 메시지를 담을 섹션 */
const reservationConfirmation = document.getElementById('reservation-confirmation');

/** 이름 입력칸 */
const customerNameInput = document.getElementById('customer-name');


// ──────────────────────────────────────────────────────────
// 2. 핵심 함수: calculateTotal()
//
//    [역할]
//      모든 선택 항목을 읽어 예상 금액을 계산하고
//      화면의 #estimated-price 에 표시한다.
//
//    [계산 규칙]
//      예상 금액 = (스터디룸 시간당 가격 × 이용 시간) + 장비 합계
//      장비 금액은 시간과 상관없이 예약 1건당 한 번만 더한다.
//
//    [반환값]
//      계산된 총 금액(숫자). 예약 확인 메시지에서 재사용한다.
// ──────────────────────────────────────────────────────────
function calculateTotal() {

  // ── 2-1. 현재 선택된 스터디룸 option 요소 가져오기 ──
  // selectedIndex: 드롭다운에서 몇 번째 항목이 선택됐는지 나타내는 숫자
  const selectedOption = roomSelect.options[roomSelect.selectedIndex];

  // data-price 속성 값을 숫자(정수)로 변환.
  // dataset.price 는 HTML data-price="8000" 의 값을 문자열로 가져오므로
  // parseInt() 로 정수로 바꾼다. 변환 실패 시 || 0 으로 0을 기본값으로 쓴다.
  const roomPricePerHour = parseInt(selectedOption.dataset.price) || 0;

  // ── 2-2. 방을 선택하지 않은 경우 → 0원 표시 후 함수 종료 ──
  // roomSelect.value 가 빈 문자열('')이면 기본 안내 항목이 선택된 것
  if (!roomSelect.value) {
    estimatedPriceEl.textContent = '예상 금액: 0원';
    return 0; // return: 이 줄 이후 코드는 실행하지 않고 함수를 끝냄
  }

  // ── 2-3. 선택된 이용 시간(시간 수) 읽기 ──
  let hours = 1; // 기본값: 1시간

  // forEach: NodeList의 각 라디오 버튼을 하나씩 꺼내 확인
  timeRadios.forEach(function(radio) {
    if (radio.checked) { // checked: 이 라디오가 현재 선택돼 있는가?
      // data-hours 속성에서 시간 수를 가져옴 (예: "2" → 2)
      hours = parseInt(radio.dataset.hours);
    }
  });

  // ── 2-4. 스터디룸 이용료 계산 ──
  // 예) 개인실 8,000원 × 3시간 = 24,000원
  const roomTotal = roomPricePerHour * hours;

  // ── 2-5. 선택한 대여 장비 금액 합산 ──
  // 장비 요금은 시간이 아닌 예약 건당 1회만 부과
  let equipTotal = 0;
  equipCheckboxes.forEach(function(checkbox) {
    if (checkbox.checked) { // 체크된 장비만 더함
      // data-price 값을 숫자로 변환해서 합산
      equipTotal += parseInt(checkbox.dataset.price) || 0;
    }
  });

  // ── 2-6. 최종 금액 = 이용료 + 장비 합계 ──
  const total = roomTotal + equipTotal;

  // ── 2-7. 화면에 예상 금액 표시 ──
  // toLocaleString(): 숫자에 천 단위 콤마 자동 적용
  // 예) 21000 → "21,000"
  estimatedPriceEl.textContent = '예상 금액: ' + total.toLocaleString() + '원';

  // 이 함수를 호출한 곳(예약 확인 메시지 생성 등)에서
  // 계산 결과를 쓸 수 있도록 총 금액을 반환
  return total;
}


// ──────────────────────────────────────────────────────────
// 3. 인원 제한 검사 함수: checkPeopleLimit()
//
//    [역할]
//      스터디룸이 바뀔 때마다 인원수 입력칸의 max 속성을
//      해당 방의 최대 인원으로 업데이트하고,
//      현재 입력된 인원이 한도를 넘으면 자동으로 줄이고
//      안내 메시지를 표시한다.
// ──────────────────────────────────────────────────────────
function checkPeopleLimit() {

  // 현재 선택된 방의 option 정보 가져오기
  const selectedOption = roomSelect.options[roomSelect.selectedIndex];
  const maxPeople     = parseInt(selectedOption.dataset.max) || 0; // 최대 인원
  const currentPeople = parseInt(peopleCountInput.value)    || 1; // 현재 입력 인원

  // 방 이름에서 가격 부분을 제거해 순수 이름만 추출
  // 예) "대형 세미나실 18,000원" → "대형 세미나실"
  // 정규식 /\s*[\d,]+원$/ : 문자열 끝(＄)의 '숫자+콤마+원' 패턴 삭제
  const roomName = selectedOption.text.replace(/\s*[\d,]+원$/, '').trim();

  // ── 3-1. 방을 선택하지 않은 경우 → max를 12로 초기화, 오류 메시지 숨김 ──
  if (!roomSelect.value) {
    peopleCountInput.max      = 12;
    peopleErrorEl.hidden      = true;
    peopleErrorEl.textContent = '';
    return;
  }

  // ── 3-2. 인원수 입력칸의 max 속성을 방의 최대 인원으로 변경 ──
  // max 속성이 바뀌면 브라우저 스핀 버튼(▲▼)도 한도를 자동으로 따름
  peopleCountInput.max = maxPeople;

  // ── 3-3. 현재 인원이 새 방의 최대 인원을 초과하면 자동 조정 ──
  if (currentPeople > maxPeople) {
    // 입력값을 최대 인원으로 덮어씀
    peopleCountInput.value = maxPeople;

    // 안내 문구 구성 후 표시
    // 예) "2인실은(는) 최대 2명까지 이용 가능합니다."
    peopleErrorEl.textContent =
      roomName + '은(는) 최대 ' + maxPeople + '명까지 이용 가능합니다.';
    // hidden 속성 제거 → CSS에서 [hidden]{ display:none } 이 해제되어 보임
    peopleErrorEl.hidden = false;

  } else {
    // 정상 범위: 오류 메시지 다시 숨기기
    peopleErrorEl.hidden      = true;
    peopleErrorEl.textContent = '';
  }
}


// ──────────────────────────────────────────────────────────
// 4. 이벤트 리스너 연결
//    사용자가 어떤 값을 바꿀 때마다 위에서 만든 함수가
//    자동으로 실행되도록 '구독'(등록)한다.
// ──────────────────────────────────────────────────────────

// ── 4-1. 스터디룸 드롭다운 변경 시 ──
// 방이 바뀌면 → 인원 한도 갱신 → 금액 재계산 순서로 실행
roomSelect.addEventListener('change', function() {
  checkPeopleLimit(); // 먼저 인원 제한 처리
  calculateTotal();   // 그다음 금액 계산
});

// ── 4-2. 이용 시간 라디오 버튼 변경 시 ──
// 라디오 버튼이 여러 개이므로 forEach로 각각에 이벤트 연결
timeRadios.forEach(function(radio) {
  radio.addEventListener('change', calculateTotal);
  // 'change' 이벤트: 라디오 버튼의 선택이 바뀔 때 발생
  // calculateTotal 뒤에 () 없이 넘기면 함수 자체를 전달 (즉시 실행 X)
});

// ── 4-3. 대여 장비 체크박스 변경 시 ──
equipCheckboxes.forEach(function(checkbox) {
  checkbox.addEventListener('change', calculateTotal);
});

// ── 4-4. 인원수 입력값 변경 시 ──
// 'input' 이벤트: 키를 누를 때마다 즉시 반응
// ('change'는 포커스를 잃을 때만 반응하므로 'input'이 더 즉각적)
peopleCountInput.addEventListener('input', function() {
  checkPeopleLimit(); // 한도 초과 여부 실시간 확인
  calculateTotal();   // 금액 표시 갱신 (인원은 금액에 영향 없지만 일관성 유지)
});


// ──────────────────────────────────────────────────────────
// 5. 예약하기 버튼 — 폼 검증 및 예약 확인 메시지 표시
//
//    'submit' 이벤트: <form> 안의 button[type="submit"]을 클릭하거나
//    Enter 키를 눌렀을 때 발생한다.
//    검사 순서: ① 이름 → ② 방 선택 → ③ 인원 초과
//    하나라도 실패하면 alert 후 return으로 중단
//
//    async: Supabase 저장(await)을 기다려야 하므로 비동기 함수로 선언
// ──────────────────────────────────────────────────────────
reservationForm.addEventListener('submit', async function(event) {

  // 브라우저 기본 동작(페이지 새로고침 + 데이터 전송)을 막음
  event.preventDefault();

  // ── 5-1. 이름 검사 ──
  // trim(): 앞뒤 공백만 입력한 경우도 빈 것으로 처리
  const name = customerNameInput.value.trim();
  if (name === '') {
    alert('이름을 입력해주세요.');
    customerNameInput.focus(); // 해당 입력칸으로 커서 자동 이동
    return; // 이후 코드 실행 중단
  }

  // ── 5-2. 스터디룸 선택 검사 ──
  if (!roomSelect.value) {
    alert('스터디룸을 선택해주세요.');
    roomSelect.focus();
    return;
  }

  // ── 5-3. 인원 초과 검사 ──
  const selectedOption  = roomSelect.options[roomSelect.selectedIndex];
  const maxPeople       = parseInt(selectedOption.dataset.max) || 0;
  const currentPeople   = parseInt(peopleCountInput.value)    || 1;
  const roomName        = selectedOption.text.replace(/\s*[\d,]+원$/, '').trim();

  if (currentPeople > maxPeople) {
    alert(roomName + '은(는) 최대 ' + maxPeople + '명까지 이용 가능합니다.');
    return;
  }

  // ── 5-4. 모든 검사 통과 → 예약 확인 메시지 조립 ──

  // 선택한 이용 시간
  let hours = 1;
  timeRadios.forEach(function(radio) {
    if (radio.checked) {
      hours = parseInt(radio.dataset.hours);
    }
  });
  const hoursText = hours + '시간'; // 예) "2시간"

  // 선택한 장비 이름 목록 만들기
  const selectedEquipNames = [];
  equipCheckboxes.forEach(function(checkbox) {
    if (checkbox.checked) {
      // 해당 체크박스에 연결된 label 요소를 찾아서 텍스트 추출
      // 'label[for="equip-projector"]' 처럼 for 속성으로 특정 label을 찾음
      const label = document.querySelector('label[for="' + checkbox.id + '"]');

      // label 텍스트 예) "빔 프로젝터  +1,000원"
      // 정규식으로 끝부분 " +1,000원" 형태를 제거해 이름만 남김
      const labelText = label.textContent
        .trim()
        .replace(/\s*\+[\d,]+원$/, '')
        .trim();

      selectedEquipNames.push(labelText); // 배열에 추가
    }
  });

  // calculateTotal()을 재사용해 총 금액을 가져옴 (화면 표시도 다시 됨)
  const total = calculateTotal();

  // 장비 텍스트 조합
  // 선택한 장비가 있으면: " (빔 프로젝터, 충전기)"
  // 없으면: "" (빈 문자열 → 메시지에서 괄호 부분 자동 생략)
  let equipText = '';
  if (selectedEquipNames.length > 0) {
    equipText = ' (' + selectedEquipNames.join(', ') + ')';
  }

  // 최종 확인 메시지 조합
  // 장비 있을 때: "홍길동님, 2인실 2시간 (빔 프로젝터) 2명, 총 21,000원 예약이 접수되었습니다!"
  // 장비 없을 때: "홍길동님, 2인실 2시간 2명, 총 20,000원 예약이 접수되었습니다!"
  const confirmMessage =
    name + '님, ' +
    roomName + ' ' +
    hoursText +
    equipText + ' ' +
    currentPeople + '명, ' +
    '총 ' + total.toLocaleString() + '원 예약이 접수되었습니다!';

  // ── 5-5. Supabase에 예약 데이터 저장 ──

  // 저장할 데이터 객체 만들기
  // 각 키 이름은 Supabase 테이블의 열(column) 이름과 일치해야 함
  const reservationData = {
    customer_name : name,                                    // 이름 (문자열)
    phone         : document.getElementById('customer-tel').value.trim(), // 전화번호 (문자열)
    studyroom     : roomName,                                // 방 이름 (문자열, 예: "2인실")
    room_price    : parseInt(selectedOption.dataset.price),  // 방 시간당 가격 (숫자)
    time          : hours,                                   // 이용 시간 (숫자, 예: 2)
    options       : selectedEquipNames,                      // 대여 장비 배열 (예: ["빔 프로젝터"])
    people        : currentPeople,                           // 인원수 (숫자)
    request       : document.getElementById('request').value.trim(), // 요청사항 (문자열)
    total_price   : total                                    // 총 금액 (숫자)
  };

  // 두 번 클릭 방지: 예약하기 버튼을 비활성화하고 텍스트 변경
  const reserveBtn = document.getElementById('btn-reserve');
  reserveBtn.disabled    = true;      // 버튼 비활성화 → 클릭 불가
  reserveBtn.textContent = '저장 중...'; // 사용자에게 진행 중임을 표시

  // Supabase insert 실행
  // await: 데이터 저장이 완료될 때까지 기다림 (완료 전에 다음 줄로 넘어가지 않음)
  // .from('cafe_menu03') : 데이터를 저장할 테이블 이름
  // .insert([reservationData]) : 한 행(row) 삽입 (배열로 감싸야 함)
  const { error } = await supabaseClient
    .from('cafe_menu03')
    .insert([reservationData]);

  // 저장 후 버튼 원래 상태로 복원
  reserveBtn.disabled    = false;
  reserveBtn.textContent = '예약하기';

  // ── 5-6. 저장 결과에 따라 분기 ──

  if (error) {
    // 저장 실패: 사용자에게 알림 + 개발자 콘솔에 자세한 에러 출력
    // console.error()는 브라우저 개발자도구(F12) → Console 탭에서 확인 가능
    console.error('Supabase 저장 오류:', error);
    alert('예약 저장에 실패했어요. 잠시 후 다시 시도해주세요.\n(오류: ' + error.message + ')');
    return; // 이하 코드(확인 메시지 표시) 실행 안 함
  }

  // 저장 성공: 예약 확인 섹션에 메시지를 넣고 화면에 보이게 하기
  reservationConfirmation.textContent = confirmMessage;
  reservationConfirmation.hidden = false; // hidden 제거 → 섹션이 나타남

  // 확인 메시지 위치로 부드럽게 스크롤
  reservationConfirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
});


// ──────────────────────────────────────────────────────────
// 6. 다시 작성 버튼 — 전체 초기화
//
//    button[type="reset"]을 클릭하면 브라우저가 폼 요소를
//    HTML에 적힌 기본값으로 자동 되돌리고 'reset' 이벤트를 발생시킨다.
//    우리는 이 이벤트를 받아 JS가 관리하는 추가 항목들을
//    (예상 금액 표시, 오류 메시지, 확인 메시지 등) 수동으로 초기화한다.
// ──────────────────────────────────────────────────────────
reservationForm.addEventListener('reset', function() {

  // type="reset" 이 폼 요소를 초기화하는 작업은
  // 이 이벤트 핸들러가 끝난 '직후'에 실행된다.
  // 따라서 setTimeout(함수, 0)으로 아주 짧게 뒤로 미뤄야
  // 브라우저 초기화가 완료된 상태에서 우리 코드가 돌아간다.
  setTimeout(function() {

    // 이용 시간: 1시간 라디오 버튼을 다시 선택 상태로 만들기
    // (HTML에 checked가 있어서 reset이 자동 복원하지만 명시적으로 처리)
    document.getElementById('time-1').checked = true;

    // 인원수 입력칸의 max를 12로 초기화
    // (방 선택이 초기화되므로 어떤 방도 선택되지 않은 상태의 max = 12)
    peopleCountInput.max = 12;

    // 인원 오류 메시지 숨기기 + 내용 비우기
    peopleErrorEl.hidden      = true;
    peopleErrorEl.textContent = '';

    // 예상 금액을 0원으로 초기화
    estimatedPriceEl.textContent = '예상 금액: 0원';

    // 예약 확인 메시지 숨기기 + 내용 비우기
    reservationConfirmation.hidden      = true;
    reservationConfirmation.textContent = '';

  }, 0); // 0 밀리초: 현재 실행 흐름이 끝나자마자 바로 실행
});


// ──────────────────────────────────────────────────────────
// 7. 페이지 최초 로드 시 초기 실행
//    방을 아직 선택하지 않았으므로 "예상 금액: 0원"이 표시된다.
// ──────────────────────────────────────────────────────────
calculateTotal();

