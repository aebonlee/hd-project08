/**
 * test/logic.test.js — 회의록 정리 순수 로직 테스트 (실행: node test/logic.test.js)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const L = require(path.join(__dirname, '..', 'js', 'logic.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ok - ' + name);
}

const BASE = '2026-08-21'; // 금요일

console.log('# 줄 분류 (classifyLine)');
test('결정 키워드: 결정/확정/하기로 함', () => {
  assert.strictEqual(L.classifyLine('9월호부터 신규 템플릿을 전면 적용하기로 결정'), 'decision');
  assert.strictEqual(L.classifyLine('발송 대상은 딜러 포함 전체로 확정'), 'decision');
  assert.strictEqual(L.classifyLine('티저 영상 공개일은 8/28로 하기로 함'), 'decision');
  assert.strictEqual(L.classifyLine('- 예산안은 원안대로 승인'), 'decision');
});
test('액션 마커: TODO / @이름 / 담당:', () => {
  assert.strictEqual(L.classifyLine('TODO: 부스 시안 피드백 취합'), 'action');
  assert.strictEqual(L.classifyLine('전시 리플렛 시안 검토 @이준호'), 'action');
  assert.strictEqual(L.classifyLine('보도자료 배포 담당: 박소연'), 'action');
  assert.strictEqual(L.classifyLine('액션 아이템 - 딜러 리스트 업데이트'), 'action');
});
test('"~가/이 ~까지" 패턴은 액션', () => {
  assert.strictEqual(L.classifyLine('김민서가 8/26까지 프로모션 기획안 제출'), 'action');
  assert.strictEqual(L.classifyLine('최다인 님이 금요일까지 콘티 공유'), 'action');
});
test('기한 + 액션성 동사도 액션', () => {
  assert.strictEqual(L.classifyLine('월말까지 채널 리포트 작성'), 'action');
});
test('명시적 액션 마커는 결정 키워드보다 우선', () => {
  assert.strictEqual(L.classifyLine('TODO: 확정된 일정 공지 등록'), 'action');
  assert.strictEqual(L.classifyLine('담당: 김민서 — 확정안 배포'), 'action');
});
test('나머지는 논의', () => {
  assert.strictEqual(L.classifyLine('지난주 뉴스레터 오픈율 39%로 상승'), 'discussion');
  assert.strictEqual(L.classifyLine('SNS 광고 예산 증액 여부는 데이터 더 보고 재논의'), 'discussion');
});
test('빈 줄은 null', () => {
  assert.strictEqual(L.classifyLine('   '), null);
  assert.strictEqual(L.classifyLine('- '), null);
});

console.log('# 담당자 추출 (extractAssignee)');
test('@이름', () => {
  assert.strictEqual(L.extractAssignee('부스 피드백 취합 @이준호 9/4까지'), '이준호');
});
test('담당: 이름', () => {
  assert.strictEqual(L.extractAssignee('보도자료 배포 담당: 박소연, 다음 주 화요일까지'), '박소연');
  assert.strictEqual(L.extractAssignee('담당자 김민서'), '김민서');
});
test('"이름이/가 ~까지" 패턴', () => {
  assert.strictEqual(L.extractAssignee('김민서가 8/26까지 기획안 제출'), '김민서');
  assert.strictEqual(L.extractAssignee('최다인 님이 금요일까지 콘티 공유'), '최다인');
});
test('"이름:" 접두', () => {
  assert.strictEqual(L.extractAssignee('홍재영: 월간 리포트 초안'), '홍재영');
});
test('없으면 빈 문자열', () => {
  assert.strictEqual(L.extractAssignee('월말까지 채널 리포트 작성'), '');
});

console.log('# 기한 추출 (extractDue, 기준일 ' + BASE + ' 금요일)');
test('M/D 형식', () => {
  assert.strictEqual(L.extractDue('8/26까지 제출', BASE), '2026-08-26');
  assert.strictEqual(L.extractDue('9/4까지', BASE), '2026-09-04');
});
test('N월 N일 형식', () => {
  assert.strictEqual(L.extractDue('9월 4일까지 취합', BASE), '2026-09-04');
});
test('YYYY-MM-DD 형식', () => {
  assert.strictEqual(L.extractDue('2026-09-01 마감', BASE), '2026-09-01');
});
test('퍼센트 숫자를 날짜로 오인하지 않음', () => {
  assert.strictEqual(L.extractDue('오픈율 3/9% 아님 39% 상승', BASE), '');
});
test('요일 표현: 이번 주 금요일(=기준일)', () => {
  assert.strictEqual(L.extractDue('금요일까지 콘티 공유', BASE), '2026-08-21');
});
test('기준일에 시각이 있어도 당일 요일이 다음 주로 밀리지 않음', () => {
  assert.strictEqual(L.extractDue('금요일까지 콘티 공유', new Date(2026, 7, 21, 14, 30)), '2026-08-21');
});
test('요일 표현: 다음 주 화요일', () => {
  assert.strictEqual(L.extractDue('다음 주 화요일까지 배포', BASE), '2026-08-25');
});
test('지난 요일은 다음 주로 해석', () => {
  // 기준일 금요일에 "수요일까지" → 다음 주 수요일
  assert.strictEqual(L.extractDue('수요일까지 회신', BASE), '2026-08-26');
});
test('상대 표현: 내일/모레/오늘', () => {
  assert.strictEqual(L.extractDue('내일까지 공유', BASE), '2026-08-22');
  assert.strictEqual(L.extractDue('모레까지', BASE), '2026-08-23');
  assert.strictEqual(L.extractDue('오늘 중으로', BASE), '2026-08-21');
});
test('다음 주/이번 주(요일 없음) → 해당 주 금요일', () => {
  assert.strictEqual(L.extractDue('다음 주까지 정리', BASE), '2026-08-28');
  assert.strictEqual(L.extractDue('이번 주 안에 확인', BASE), '2026-08-21');
});
test('월말', () => {
  assert.strictEqual(L.extractDue('월말까지 작성', BASE), '2026-08-31');
});
test('없으면 빈 문자열', () => {
  assert.strictEqual(L.extractDue('딜러 리스트 업데이트', BASE), '');
});

console.log('# 액션 본문 정리 (cleanActionText)');
test('마커/@이름/담당 표기 제거', () => {
  assert.strictEqual(L.cleanActionText('TODO: 부스 시안 피드백 취합 @이준호'), '부스 시안 피드백 취합');
  assert.strictEqual(L.cleanActionText('- 보도자료 배포 담당: 박소연'), '보도자료 배포');
});

console.log('# 메모 전체 파싱 (parseMemo)');
const MEMO = [
  '지난주 뉴스레터 오픈율 39%로 상승, 리뉴얼 효과로 보임',
  '9월호부터 신규 뉴스레터 템플릿을 전면 적용하기로 결정',
  '',
  '티저 영상 공개일은 8/28로 하기로 함',
  '김민서가 8/26까지 Develon 가을 프로모션 기획안 제출',
  'TODO: 전시회 부스 시안 2차 피드백 취합 @이준호 9/4까지',
  'SNS 광고 예산 증액 여부는 데이터 더 보고 재논의'
].join('\n');
test('3분류 개수', () => {
  const p = L.parseMemo(MEMO, BASE);
  assert.strictEqual(p.discussions.length, 2);
  assert.strictEqual(p.decisions.length, 2);
  assert.strictEqual(p.actions.length, 2);
});
test('액션에 담당/기한이 채워짐', () => {
  const p = L.parseMemo(MEMO, BASE);
  assert.strictEqual(p.actions[0].assignee, '김민서');
  assert.strictEqual(p.actions[0].due, '2026-08-26');
  assert.strictEqual(p.actions[1].assignee, '이준호');
  assert.strictEqual(p.actions[1].due, '2026-09-04');
});
test('모든 항목에 고유 id 부여', () => {
  const p = L.parseMemo(MEMO, BASE);
  const ids = [].concat(p.discussions, p.decisions, p.actions).map(x => x.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

console.log('# 항목 이동 (moveItem)');
test('논의 → 액션 이동 시 담당/기한 재추출', () => {
  const p = L.parseMemo('박소연이 9/1까지 보도자료 정리', BASE);
  // 강제로 논의로 넣은 뒤 이동 시나리오
  const p2 = { discussions: [{ id: 'x1', text: '박소연이 9/1까지 보도자료 정리' }], decisions: [], actions: [] };
  const moved = L.moveItem(p2, 'x1', 'action');
  assert.strictEqual(moved.discussions.length, 0);
  assert.strictEqual(moved.actions.length, 1);
  assert.strictEqual(moved.actions[0].assignee, '박소연');
  assert.strictEqual(moved.actions[0].due, '2026-09-01');
  assert.ok(p); // parseMemo 결과도 유효
});
test('결정 → 논의 이동', () => {
  const p = { discussions: [], decisions: [{ id: 'd1', text: 'A안으로 확정' }], actions: [] };
  const moved = L.moveItem(p, 'd1', 'discussion');
  assert.strictEqual(moved.decisions.length, 0);
  assert.strictEqual(moved.discussions[0].text, 'A안으로 확정');
});
test('없는 id면 원본 유지', () => {
  const p = { discussions: [{ id: 'a', text: 'x' }], decisions: [], actions: [] };
  assert.strictEqual(L.moveItem(p, 'zzz', 'action'), p);
});

console.log('# 마크다운/프롬프트 생성');
test('toMarkdown: 표준 양식 포함', () => {
  const md = L.toMarkdown(
    { title: '주간회의', datetime: '2026-08-21 10:00', attendees: '홍재영, 김민서', author: '홍재영', nextMeeting: '2026-08-28' },
    L.parseMemo(MEMO, BASE)
  );
  assert.ok(md.includes('# 회의록: 주간회의'));
  assert.ok(md.includes('## 1. 논의 내용'));
  assert.ok(md.includes('## 2. 결정 사항'));
  assert.ok(md.includes('| 항목 | 담당 | 기한 |'));
  assert.ok(md.includes('| 김민서 | 2026-08-26 |'));
  assert.ok(md.includes('## 4. 다음 회의'));
  assert.ok(md.includes('- 2026-08-28'));
});
test('toMarkdown: 담당/기한 없으면 미정', () => {
  const md = L.toMarkdown({}, { discussions: [], decisions: [], actions: [{ id: 'a', text: '리스트 정리', assignee: '', due: '' }] });
  assert.ok(md.includes('| 리스트 정리 | 미정 | 미정 |'));
});
test('buildPrompt: 회의 정보와 메모 삽입', () => {
  const pr = L.buildPrompt({ title: '주간회의' }, MEMO);
  assert.ok(pr.includes('- 제목: 주간회의'));
  assert.ok(pr.includes('[회의 메모]'));
  assert.ok(pr.includes('9월호부터 신규 뉴스레터 템플릿'));
  assert.ok(pr.includes('YYYY-MM-DD'));
});

console.log('\n' + passed + '개 테스트 통과');
