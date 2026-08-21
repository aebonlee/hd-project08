/**
 * test/logic.test.js — 순수 로직 테스트 (실행: node test/logic.test.js)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const L = require(path.join(__dirname, '..', 'js', 'logic.js'));
const D = require(path.join(__dirname, '..', 'js', 'data.js'));
const sample = require(path.join(__dirname, '..', 'js', 'sample-data.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ok - ' + name);
}

const TODAY = '2026-08-21'; // 금요일

console.log('# 날짜 파싱/포맷');
test('parseDate: 정상 날짜', () => {
  const d = L.parseDate('2026-08-21');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 7);
  assert.strictEqual(d.getDate(), 21);
});
test('parseDate: 구분자 . / 도 허용', () => {
  assert.strictEqual(L.formatDate(L.parseDate('2026.8.5')), '2026-08-05');
  assert.strictEqual(L.formatDate(L.parseDate('2026/12/31')), '2026-12-31');
});
test('parseDate: 잘못된 값은 null', () => {
  assert.strictEqual(L.parseDate('2026-02-30'), null);
  assert.strictEqual(L.parseDate('없음'), null);
  assert.strictEqual(L.parseDate(''), null);
  assert.strictEqual(L.parseDate(null), null);
});

console.log('# 주간 계산');
test('weekMonday: 금요일 기준 이번 주 월요일', () => {
  assert.strictEqual(L.formatDate(L.weekMonday(TODAY, 0)), '2026-08-17');
});
test('weekMonday: 일요일은 앞 주 월요일로', () => {
  assert.strictEqual(L.formatDate(L.weekMonday('2026-08-23', 0)), '2026-08-17');
});
test('weekMonday: 주 이동(offset)', () => {
  assert.strictEqual(L.formatDate(L.weekMonday(TODAY, 1)), '2026-08-24');
  assert.strictEqual(L.formatDate(L.weekMonday(TODAY, -1)), '2026-08-10');
});
test('weekDays: 월~금 5일', () => {
  const days = L.weekDays(TODAY, 0).map(L.formatDate);
  assert.deepStrictEqual(days, ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']);
});
test('isInWeek: 주 경계(월~일) 판정', () => {
  assert.strictEqual(L.isInWeek('2026-08-17', TODAY, 0), true);
  assert.strictEqual(L.isInWeek('2026-08-23', TODAY, 0), true);  // 일요일 포함
  assert.strictEqual(L.isInWeek('2026-08-16', TODAY, 0), false);
  assert.strictEqual(L.isInWeek('2026-08-24', TODAY, 0), false);
  assert.strictEqual(L.isInWeek('2026-08-24', TODAY, 1), true);
});

console.log('# 지연 판정');
test('isDelayed: 마감 지남 + 미완료 = 지연', () => {
  assert.strictEqual(L.isDelayed({ due: '2026-08-20', status: '진행' }, TODAY), true);
  assert.strictEqual(L.isDelayed({ due: '2026-08-20', status: '대기' }, TODAY), true);
});
test('isDelayed: 완료면 지연 아님', () => {
  assert.strictEqual(L.isDelayed({ due: '2026-08-01', status: '완료' }, TODAY), false);
});
test('isDelayed: 오늘 마감은 아직 지연 아님', () => {
  assert.strictEqual(L.isDelayed({ due: '2026-08-21', status: '진행' }, TODAY), false);
});
test('isDelayed: 마감일 없으면 지연 아님', () => {
  assert.strictEqual(L.isDelayed({ due: '', status: '진행' }, TODAY), false);
});

console.log('# KPI');
const tasks = [
  { due: '2026-08-21', status: '진행' },  // 이번 주 마감(미완료)
  { due: '2026-08-19', status: '진행' },  // 지연 + 이번 주
  { due: '2026-08-14', status: '대기' },  // 지연(지난 주)
  { due: '2026-08-20', status: '완료' },  // 완료
  { due: '2026-08-25', status: '대기' },  // 다음 주
  { due: '2026-09-01', status: '대기' },  // 다음 달
];
test('countDueThisWeek: 이번 주 마감 미완료', () => {
  assert.strictEqual(L.countDueThisWeek(tasks, TODAY), 2);
});
test('countDelayed', () => {
  assert.strictEqual(L.countDelayed(tasks, TODAY), 2);
});
test('monthlyCompletionRate: 이번 달 마감 기준', () => {
  // 8월 마감 5건 중 완료 1건 = 20%
  assert.strictEqual(L.monthlyCompletionRate(tasks, TODAY), 20);
});
test('monthlyCompletionRate: 대상 없으면 null', () => {
  assert.strictEqual(L.monthlyCompletionRate([{ due: '2026-09-01', status: '대기' }], TODAY), null);
});
test('countActiveCampaigns: 진행+검토', () => {
  const cs = [{ status: '진행' }, { status: '검토' }, { status: '기획' }, { status: '완료' }, { status: '보류' }];
  assert.strictEqual(L.countActiveCampaigns(cs), 2);
});
test('computeKpis: 묶음', () => {
  const k = L.computeKpis([{ status: '진행' }], tasks, TODAY);
  assert.deepStrictEqual(k, { activeCampaigns: 1, dueThisWeek: 2, delayed: 2, completionRate: 20 });
});

console.log('# 필터/그룹');
test('filterCampaignsByStatus', () => {
  const cs = [{ status: '진행' }, { status: '완료' }];
  assert.strictEqual(L.filterCampaignsByStatus(cs, '전체').length, 2);
  assert.strictEqual(L.filterCampaignsByStatus(cs, '진행').length, 1);
  assert.strictEqual(L.filterCampaignsByStatus(cs, '보류').length, 0);
});
test('filterTasksByOwner', () => {
  const ts = [{ owner: '홍재영' }, { owner: '김민서' }, { owner: '홍재영' }];
  assert.strictEqual(L.filterTasksByOwner(ts, '홍재영').length, 2);
  assert.strictEqual(L.filterTasksByOwner(ts, '전체').length, 3);
});
test('groupEventsByWeekday: 요일 배치 + 시간 정렬', () => {
  const evs = [
    { date: '2026-08-17', time: '14:00', title: 'B' },
    { date: '2026-08-17', time: '10:00', title: 'A' },
    { date: '2026-08-21', time: '', title: 'C' },
    { date: '2026-08-24', time: '', title: '다음주' },
  ];
  const buckets = L.groupEventsByWeekday(evs, TODAY, 0);
  assert.strictEqual(buckets.length, 5);
  assert.deepStrictEqual(buckets[0].events.map(e => e.title), ['A', 'B']);
  assert.strictEqual(buckets[4].events[0].title, 'C');
  assert.strictEqual(buckets[1].events.length + buckets[2].events.length + buckets[3].events.length, 0);
});
test('clampProgress', () => {
  assert.strictEqual(L.clampProgress(150), 100);
  assert.strictEqual(L.clampProgress(-3), 0);
  assert.strictEqual(L.clampProgress('42.6'), 43);
  assert.strictEqual(L.clampProgress('abc'), 0);
});
test('recentChannelMonths: 정렬 후 최근 6개', () => {
  const rows = ['2026-01', '2026-03', '2026-02', '2026-04', '2026-05', '2026-06', '2026-07']
    .map(m => ({ month: m }));
  assert.deepStrictEqual(L.recentChannelMonths(rows, 6),
    ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
});

console.log('# 데이터 계층 (엑셀 변환 왕복)');
test('stateToSheets → sheetsToState 왕복 보존', () => {
  const st = D.defaultState();
  const sheets = D.stateToSheets(st);
  assert.deepStrictEqual(Object.keys(sheets).sort(),
    ['공지', '업무', '주간일정', '채널실적', '캠페인'].sort());
  const back = D.sheetsToState(sheets, null);
  assert.strictEqual(back.imported.length, 5);
  assert.deepStrictEqual(back.state.campaigns, st.campaigns);
  assert.deepStrictEqual(back.state.tasks, st.tasks);
  assert.deepStrictEqual(back.state.events, st.events);
  assert.deepStrictEqual(back.state.channelStats, st.channelStats);
  assert.deepStrictEqual(back.state.notices, st.notices);
});
test('sheetsToState: 일부 시트만 있어도 동작', () => {
  const st = D.defaultState();
  const sheets = D.stateToSheets(st);
  const partial = { '업무': sheets['업무'] };
  const back = D.sheetsToState(partial, st);
  assert.deepStrictEqual(back.imported, ['업무']);
  assert.deepStrictEqual(back.state.campaigns, st.campaigns);
});
test('sheetsToState: 날짜 셀이 Date 객체여도 YYYY-MM-DD로 정규화', () => {
  const rows = [
    ['ID', '업무명', '관련 캠페인', '담당자', '우선순위', '마감일', '상태'],
    ['T1', '테스트 업무', 'C', '홍재영', '높음', new Date(2026, 7, 25), '대기'],
  ];
  const back = D.sheetsToState({ '업무': rows }, D.defaultState());
  assert.strictEqual(back.state.tasks[0].due, '2026-08-25');
});
test('nextId: 최대 번호 + 1', () => {
  assert.strictEqual(D.nextId([{ id: 'C1' }, { id: 'C7' }, { id: 'X9' }], 'C'), 'C8');
  assert.strictEqual(D.nextId([], 'T'), 'T1');
});

console.log('# 샘플 데이터 무결성');
test('샘플: 담당자 5명, 각 데이터 최소 건수', () => {
  assert.strictEqual(sample.members.length, 5);
  assert.ok(sample.campaigns.length >= 5);
  assert.ok(sample.tasks.length >= 10);
  assert.ok(sample.events.length >= 8);
  assert.strictEqual(sample.channelStats.length, 24); // 4채널 × 6개월
  assert.ok(sample.notices.length >= 3);
});
test('샘플: 업무 담당자는 모두 팀원 목록에 존재', () => {
  sample.tasks.forEach(t => assert.ok(sample.members.includes(t.owner), t.owner));
});
test('샘플: 기준일(2026-08-21) 기준 지연 항목 존재(데모 확인용)', () => {
  assert.ok(L.countDelayed(sample.tasks, TODAY) >= 1);
});

console.log('\n' + passed + '개 테스트 통과');
