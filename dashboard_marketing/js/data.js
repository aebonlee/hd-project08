/**
 * data.js — 데이터 계층
 * 상태 보관(localStorage) + 엑셀 시트 ↔ 내부 상태 변환.
 * node --check 통과를 위해 브라우저 전역 접근은 모두 가드 처리.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MarketingData = api;
  }
})(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  var STORAGE_KEY = 'amps_marketing_dashboard_v1';

  var SHEETS = {
    campaigns: '캠페인',
    tasks: '업무',
    events: '주간일정',
    channelStats: '채널실적',
    notices: '공지'
  };

  var HEADERS = {
    campaigns: ['ID', '캠페인명', '브랜드', '상태', '진행률(%)', '담당자', '시작일', '종료일', '다음 마일스톤'],
    tasks: ['ID', '업무명', '관련 캠페인', '담당자', '우선순위', '마감일', '상태'],
    events: ['ID', '날짜', '시간', '구분', '일정명'],
    channelStats: ['월(YYYY-MM)', '채널', '값'],
    notices: ['ID', '고정(Y/N)', '중요도', '제목', '작성자', '날짜']
  };

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** 샘플 데이터 기반 초기 상태 */
  function defaultState() {
    var sample = (root && root.MarketingSampleData) ||
      (typeof require === 'function' ? require('./sample-data.js') : null);
    if (!sample) throw new Error('샘플 데이터를 찾을 수 없습니다.');
    return deepCopy(sample);
  }

  function storageAvailable() {
    try {
      return !!(root && root.localStorage);
    } catch (e) {
      return false;
    }
  }

  /** 저장된 상태 로드. 없거나 깨졌으면 null */
  function loadState() {
    if (!storageAvailable()) return null;
    try {
      var raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var st = JSON.parse(raw);
      if (!st || !Array.isArray(st.campaigns) || !Array.isArray(st.tasks)) return null;
      return st;
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    if (!storageAvailable()) return false;
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearState() {
    if (!storageAvailable()) return;
    try { root.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 무시 */ }
  }

  /** 새 ID 발급 (prefix + 최대번호+1) */
  function nextId(list, prefix) {
    var max = 0;
    (list || []).forEach(function (item) {
      var m = String(item.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, +m[1]);
    });
    return prefix + (max + 1);
  }

  // ---------- 엑셀 변환 (SheetJS의 aoa 형식과 주고받음) ----------

  function campaignsToRows(campaigns) {
    return [HEADERS.campaigns].concat((campaigns || []).map(function (c) {
      return [c.id, c.name, c.brand, c.status, c.progress, c.owner, c.start, c.end, c.milestone];
    }));
  }

  function tasksToRows(tasks) {
    return [HEADERS.tasks].concat((tasks || []).map(function (t) {
      return [t.id, t.name, t.campaign, t.owner, t.priority, t.due, t.status];
    }));
  }

  function eventsToRows(events) {
    return [HEADERS.events].concat((events || []).map(function (e) {
      return [e.id, e.date, e.time, e.type, e.title];
    }));
  }

  function channelStatsToRows(rows) {
    return [HEADERS.channelStats].concat((rows || []).map(function (r) {
      return [r.month, r.channel, r.value];
    }));
  }

  function noticesToRows(notices) {
    return [HEADERS.notices].concat((notices || []).map(function (n) {
      return [n.id, n.pinned ? 'Y' : 'N', n.importance, n.title, n.author, n.date];
    }));
  }

  function s(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  /** 날짜 셀 정규화: Date 객체/문자열 모두 'YYYY-MM-DD'로 */
  function normDate(v) {
    if (v instanceof Date && !isNaN(v)) {
      var mm = String(v.getMonth() + 1).padStart(2, '0');
      var dd = String(v.getDate()).padStart(2, '0');
      return v.getFullYear() + '-' + mm + '-' + dd;
    }
    return s(v).replace(/[./]/g, '-');
  }

  function rowsToCampaigns(rows) {
    return (rows || []).slice(1).filter(function (r) { return r && s(r[1]); }).map(function (r, i) {
      return {
        id: s(r[0]) || 'C' + (i + 1),
        name: s(r[1]),
        brand: s(r[2]) || '공통',
        status: s(r[3]) || '기획',
        progress: Number(r[4]) || 0,
        owner: s(r[5]),
        start: normDate(r[6]),
        end: normDate(r[7]),
        milestone: s(r[8])
      };
    });
  }

  function rowsToTasks(rows) {
    return (rows || []).slice(1).filter(function (r) { return r && s(r[1]); }).map(function (r, i) {
      return {
        id: s(r[0]) || 'T' + (i + 1),
        name: s(r[1]),
        campaign: s(r[2]),
        owner: s(r[3]),
        priority: s(r[4]) || '중간',
        due: normDate(r[5]),
        status: s(r[6]) || '대기'
      };
    });
  }

  function rowsToEvents(rows) {
    return (rows || []).slice(1).filter(function (r) { return r && s(r[4]); }).map(function (r, i) {
      return {
        id: s(r[0]) || 'E' + (i + 1),
        date: normDate(r[1]),
        time: s(r[2]),
        type: s(r[3]) || '회의',
        title: s(r[4])
      };
    });
  }

  function rowsToChannelStats(rows) {
    return (rows || []).slice(1).filter(function (r) { return r && s(r[0]) && s(r[1]); }).map(function (r) {
      return { month: normDate(r[0]).slice(0, 7), channel: s(r[1]), value: Number(r[2]) || 0 };
    });
  }

  function rowsToNotices(rows) {
    return (rows || []).slice(1).filter(function (r) { return r && s(r[3]); }).map(function (r, i) {
      return {
        id: s(r[0]) || 'N' + (i + 1),
        pinned: s(r[1]).toUpperCase() === 'Y',
        importance: s(r[2]) || '보통',
        title: s(r[3]),
        author: s(r[4]),
        date: normDate(r[5])
      };
    });
  }

  /** 상태 → {시트명: aoa} 묶음 (엑셀 내보내기용) */
  function stateToSheets(state) {
    var out = {};
    out[SHEETS.campaigns] = campaignsToRows(state.campaigns);
    out[SHEETS.tasks] = tasksToRows(state.tasks);
    out[SHEETS.events] = eventsToRows(state.events);
    out[SHEETS.channelStats] = channelStatsToRows(state.channelStats);
    out[SHEETS.notices] = noticesToRows(state.notices);
    return out;
  }

  /**
   * {시트명: aoa} → 부분 상태. 존재하는 시트만 갱신하고 나머지는 base 유지.
   * 반환: { state, imported: [시트명…] }
   */
  function sheetsToState(sheetMap, base) {
    var st = deepCopy(base || defaultState());
    var imported = [];
    if (sheetMap[SHEETS.campaigns]) { st.campaigns = rowsToCampaigns(sheetMap[SHEETS.campaigns]); imported.push(SHEETS.campaigns); }
    if (sheetMap[SHEETS.tasks]) { st.tasks = rowsToTasks(sheetMap[SHEETS.tasks]); imported.push(SHEETS.tasks); }
    if (sheetMap[SHEETS.events]) { st.events = rowsToEvents(sheetMap[SHEETS.events]); imported.push(SHEETS.events); }
    if (sheetMap[SHEETS.channelStats]) { st.channelStats = rowsToChannelStats(sheetMap[SHEETS.channelStats]); imported.push(SHEETS.channelStats); }
    if (sheetMap[SHEETS.notices]) { st.notices = rowsToNotices(sheetMap[SHEETS.notices]); imported.push(SHEETS.notices); }
    // 담당자 목록은 업무/캠페인에서 재구성
    var owners = {};
    st.campaigns.concat(st.tasks).forEach(function (x) { if (x.owner) owners[x.owner] = true; });
    if (Object.keys(owners).length) st.members = Object.keys(owners);
    return { state: st, imported: imported };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SHEETS: SHEETS,
    HEADERS: HEADERS,
    defaultState: defaultState,
    loadState: loadState,
    saveState: saveState,
    clearState: clearState,
    nextId: nextId,
    stateToSheets: stateToSheets,
    sheetsToState: sheetsToState
  };
});
