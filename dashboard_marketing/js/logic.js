/**
 * logic.js — 마케팅 파트 업무공유 대시보드 순수 로직 계층
 * 브라우저(window.MarketingLogic)와 Node(module.exports) 양쪽에서 동작한다.
 * DOM/localStorage 접근 금지 — 순수 함수만 둔다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MarketingLogic = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** 'YYYY-MM-DD' 문자열 → Date(로컬 자정). 잘못된 값이면 null */
  function parseDate(str) {
    if (str instanceof Date && !isNaN(str)) {
      return new Date(str.getFullYear(), str.getMonth(), str.getDate());
    }
    if (typeof str !== 'string') return null;
    var m = str.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  /** Date → 'YYYY-MM-DD' */
  function formatDate(dt) {
    if (!(dt instanceof Date) || isNaN(dt)) return '';
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var dd = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + mm + '-' + dd;
  }

  /** 기준일이 속한 주의 월요일(Date)을 반환. offsetWeeks 만큼 주 이동 */
  function weekMonday(baseDate, offsetWeeks) {
    var base = parseDate(baseDate) || (baseDate instanceof Date ? baseDate : new Date());
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    var day = d.getDay(); // 0=일
    var diff = (day === 0 ? -6 : 1 - day); // 월요일로 이동
    d.setDate(d.getDate() + diff + (offsetWeeks || 0) * 7);
    return d;
  }

  /** 해당 주 월~금 날짜 배열(Date 5개) */
  function weekDays(baseDate, offsetWeeks) {
    var mon = weekMonday(baseDate, offsetWeeks);
    var days = [];
    for (var i = 0; i < 5; i++) {
      days.push(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    }
    return days;
  }

  /** dateStr이 기준일이 속한 주(월~일)에 포함되는가 */
  function isInWeek(dateStr, baseDate, offsetWeeks) {
    var d = parseDate(dateStr);
    if (!d) return false;
    var mon = weekMonday(baseDate, offsetWeeks);
    var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return d >= mon && d <= sun;
  }

  /** 지연 판정: 마감일이 오늘보다 이전이고 상태가 완료가 아님 */
  function isDelayed(task, today) {
    if (!task || task.status === '완료') return false;
    var due = parseDate(task.due);
    var t = parseDate(today) || today;
    if (!due || !(t instanceof Date)) return false;
    var t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return due < t0;
  }

  /** 이번 주(월~일) 마감 & 미완료 업무 수 */
  function countDueThisWeek(tasks, today) {
    var n = 0;
    (tasks || []).forEach(function (t) {
      if (t.status !== '완료' && isInWeek(t.due, today, 0)) n++;
    });
    return n;
  }

  /** 지연 업무 수 */
  function countDelayed(tasks, today) {
    var n = 0;
    (tasks || []).forEach(function (t) { if (isDelayed(t, today)) n++; });
    return n;
  }

  /** 이번 달 완료율(%): 마감일이 이번 달인 업무 중 완료 비율. 대상 없으면 null */
  function monthlyCompletionRate(tasks, today) {
    var t = parseDate(today) || today;
    if (!(t instanceof Date)) return null;
    var total = 0, done = 0;
    (tasks || []).forEach(function (task) {
      var due = parseDate(task.due);
      if (!due) return;
      if (due.getFullYear() === t.getFullYear() && due.getMonth() === t.getMonth()) {
        total++;
        if (task.status === '완료') done++;
      }
    });
    if (total === 0) return null;
    return Math.round((done / total) * 100);
  }

  /** 진행 중 캠페인 수: 상태가 진행/검토인 캠페인 */
  function countActiveCampaigns(campaigns) {
    return (campaigns || []).filter(function (c) {
      return c.status === '진행' || c.status === '검토';
    }).length;
  }

  /** KPI 묶음 계산 */
  function computeKpis(campaigns, tasks, today) {
    return {
      activeCampaigns: countActiveCampaigns(campaigns),
      dueThisWeek: countDueThisWeek(tasks, today),
      delayed: countDelayed(tasks, today),
      completionRate: monthlyCompletionRate(tasks, today)
    };
  }

  /** 캠페인 상태 필터 ('전체'면 전부) */
  function filterCampaignsByStatus(campaigns, status) {
    if (!status || status === '전체') return (campaigns || []).slice();
    return (campaigns || []).filter(function (c) { return c.status === status; });
  }

  /** 담당자 필터 ('전체'면 전부) */
  function filterTasksByOwner(tasks, owner) {
    if (!owner || owner === '전체') return (tasks || []).slice();
    return (tasks || []).filter(function (t) { return t.owner === owner; });
  }

  /** 주간 일정을 요일(0=월 ~ 4=금)별로 묶는다 */
  function groupEventsByWeekday(events, baseDate, offsetWeeks) {
    var days = weekDays(baseDate, offsetWeeks);
    var buckets = days.map(function (d) { return { date: d, events: [] }; });
    (events || []).forEach(function (ev) {
      var d = parseDate(ev.date);
      if (!d) return;
      for (var i = 0; i < days.length; i++) {
        if (formatDate(days[i]) === formatDate(d)) {
          buckets[i].events.push(ev);
          break;
        }
      }
    });
    buckets.forEach(function (b) {
      b.events.sort(function (a, x) { return String(a.time || '').localeCompare(String(x.time || '')); });
    });
    return buckets;
  }

  /** 진행률 값 정규화(0~100 정수) */
  function clampProgress(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  /** 채널 실적 배열 → 월 오름차순 정렬 후 최근 n개월 */
  function recentChannelMonths(rows, n) {
    var months = {};
    (rows || []).forEach(function (r) { if (r.month) months[r.month] = true; });
    var keys = Object.keys(months).sort();
    return keys.slice(Math.max(0, keys.length - (n || 6)));
  }

  return {
    parseDate: parseDate,
    formatDate: formatDate,
    weekMonday: weekMonday,
    weekDays: weekDays,
    isInWeek: isInWeek,
    isDelayed: isDelayed,
    countDueThisWeek: countDueThisWeek,
    countDelayed: countDelayed,
    monthlyCompletionRate: monthlyCompletionRate,
    countActiveCampaigns: countActiveCampaigns,
    computeKpis: computeKpis,
    filterCampaignsByStatus: filterCampaignsByStatus,
    filterTasksByOwner: filterTasksByOwner,
    groupEventsByWeekday: groupEventsByWeekday,
    clampProgress: clampProgress,
    recentChannelMonths: recentChannelMonths
  };
});
