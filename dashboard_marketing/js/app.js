/**
 * app.js — 마케팅 파트 업무공유 대시보드 UI
 * 데이터: MarketingData(data.js) / 계산: MarketingLogic(logic.js)
 */
(function () {
  'use strict';

  var L = window.MarketingLogic;
  var D = window.MarketingData;

  var state = D.loadState() || D.defaultState();

  // UI 상태 (저장 대상 아님)
  var ui = {
    campaignFilter: '전체',
    ownerFilter: '전체',
    weekOffset: 0,
    selectedChannel: '뉴스레터',
    editingCampaignId: null,   // 캠페인 ID 또는 '__new__'
    showTaskForm: false,
    showEventForm: false,
    showNoticeForm: false
  };

  var today = new Date();
  var chart = null;

  var STATUSES = ['기획', '진행', '검토', '완료', '보류'];
  var BRANDS = ['Hyundai', 'Develon', '공통'];
  var PRIORITIES = ['높음', '중간', '낮음'];
  var TASK_STATUSES = ['대기', '진행', '완료'];
  var EVENT_TYPES = ['회의', '마감', '행사'];
  var DOW = ['월', '화', '수', '목', '금'];

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 저장.
   *
   * "업무공유" 대시보드인데 각자 브라우저에만 담으면 공유가 안 된다.
   * 서버에 연결돼 있으면 팀 공용 문서로도 함께 보낸다.
   * 화면 코드는 이 함수만 부르면 되고 저장 위치를 몰라도 된다.
   */
  function persist() {
    D.saveState(state);
    if (window.HDDoc && HDDoc.mode() === 'synced') HDDoc.save(state);
  }

  function mmdd(dateStr) {
    var d = L.parseDate(dateStr);
    if (!d) return dateStr || '-';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  // ---------------- KPI ----------------
  function renderKpis() {
    var k = L.computeKpis(state.campaigns, state.tasks, today);
    $('kpi-active').textContent = k.activeCampaigns + '건';
    $('kpi-week').textContent = k.dueThisWeek + '건';
    $('kpi-delayed').textContent = k.delayed + '건';
    $('kpi-delayed').classList.toggle('has-delay', k.delayed > 0);
    $('kpi-rate').textContent = k.completionRate === null ? '-' : k.completionRate + '%';
  }

  // ---------------- 캠페인 보드 ----------------
  function renderCampaignFilter() {
    var el = $('campaign-filter');
    var chips = ['전체'].concat(STATUSES);
    el.innerHTML = chips.map(function (s) {
      return '<button class="chip' + (ui.campaignFilter === s ? ' active' : '') + '" data-status="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');
    el.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.campaignFilter = btn.dataset.status;
        renderCampaignFilter();
        renderCampaigns();
      });
    });
  }

  function campaignFormHtml(c) {
    c = c || { name: '', brand: 'Hyundai', status: '기획', progress: 0, owner: state.members[0] || '', start: '', end: '', milestone: '' };
    function opts(list, sel) {
      return list.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    }
    return '<div class="inline-form" data-role="campaign-form">' +
      '<label class="full">캠페인명<input name="name" value="' + esc(c.name) + '" placeholder="예: Hyundai 신모델 런칭"></label>' +
      '<label>브랜드<select name="brand">' + opts(BRANDS, c.brand) + '</select></label>' +
      '<label>상태<select name="status">' + opts(STATUSES, c.status) + '</select></label>' +
      '<label>진행률(%)<input name="progress" type="number" min="0" max="100" value="' + esc(c.progress) + '"></label>' +
      '<label>담당자<input name="owner" value="' + esc(c.owner) + '" list="member-list"></label>' +
      '<label>시작일<input name="start" type="date" value="' + esc(c.start) + '"></label>' +
      '<label>종료일<input name="end" type="date" value="' + esc(c.end) + '"></label>' +
      '<label class="full">다음 마일스톤<input name="milestone" value="' + esc(c.milestone) + '" placeholder="예: 티저 영상 공개 (08-28)"></label>' +
      '<div class="form-actions">' +
      (c.id ? '<button class="btn-del" data-act="delete">삭제</button>' : '') +
      '<button class="btn btn-outline btn-sm" data-act="cancel">취소</button>' +
      '<button class="btn btn-primary btn-sm" data-act="save">저장</button>' +
      '</div></div>';
  }

  function readForm(formEl) {
    var out = {};
    formEl.querySelectorAll('input,select,textarea').forEach(function (inp) {
      out[inp.name] = inp.value;
    });
    return out;
  }

  function bindCampaignForm(wrap, id) {
    var form = wrap.querySelector('[data-role="campaign-form"]');
    form.addEventListener('click', function (e) { e.stopPropagation(); });
    form.querySelector('[data-act="save"]').addEventListener('click', function () {
      var v = readForm(form);
      if (!v.name.trim()) { alert('캠페인명을 입력해 주세요.'); return; }
      var rec = {
        id: id === '__new__' ? D.nextId(state.campaigns, 'C') : id,
        name: v.name.trim(), brand: v.brand, status: v.status,
        progress: L.clampProgress(v.progress), owner: v.owner.trim(),
        start: v.start, end: v.end, milestone: v.milestone.trim()
      };
      if (id === '__new__') state.campaigns.unshift(rec);
      else state.campaigns = state.campaigns.map(function (c) { return c.id === id ? rec : c; });
      ui.editingCampaignId = null;
      persist(); renderAll();
    });
    form.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      ui.editingCampaignId = null;
      renderCampaigns();
    });
    var del = form.querySelector('[data-act="delete"]');
    if (del) del.addEventListener('click', function () {
      if (!confirm('이 캠페인을 삭제할까요?')) return;
      state.campaigns = state.campaigns.filter(function (c) { return c.id !== id; });
      ui.editingCampaignId = null;
      persist(); renderAll();
    });
  }

  function renderCampaigns() {
    var grid = $('campaign-grid');
    var list = L.filterCampaignsByStatus(state.campaigns, ui.campaignFilter);
    var html = '';

    if (ui.editingCampaignId === '__new__') {
      html += '<div class="campaign-card editing" data-id="__new__">' + campaignFormHtml(null) + '</div>';
    }

    html += list.map(function (c) {
      if (ui.editingCampaignId === c.id) {
        return '<div class="campaign-card editing" data-id="' + esc(c.id) + '">' + campaignFormHtml(c) + '</div>';
      }
      return '<div class="campaign-card" data-id="' + esc(c.id) + '" title="클릭하여 상세 수정">' +
        '<div class="cc-top"><span class="cc-name">' + esc(c.name) + '</span>' +
        '<span class="badge badge-st-' + esc(c.status) + '">' + esc(c.status) + '</span></div>' +
        '<div class="cc-meta"><span class="badge badge-brand-' + esc(c.brand) + '">' + esc(c.brand) + '</span></div>' +
        '<div class="progress"><span style="width:' + L.clampProgress(c.progress) + '%"></span></div>' +
        '<span class="progress-num">진행률 ' + L.clampProgress(c.progress) + '%</span>' +
        '<div class="cc-row">담당 <b>' + esc(c.owner) + '</b> · 기간 <b>' + esc(mmdd(c.start)) + ' ~ ' + esc(mmdd(c.end)) + '</b></div>' +
        '<div class="cc-row">다음 마일스톤: <b>' + esc(c.milestone || '-') + '</b></div>' +
        '</div>';
    }).join('');

    if (!html) html = '<p class="hint">해당 상태의 캠페인이 없습니다.</p>';
    grid.innerHTML = html;

    grid.querySelectorAll('.campaign-card').forEach(function (card) {
      var id = card.dataset.id;
      if (ui.editingCampaignId === id) {
        bindCampaignForm(card, id);
      } else {
        card.addEventListener('click', function () {
          ui.editingCampaignId = id;
          renderCampaigns();
        });
      }
    });
  }

  // ---------------- 담당자별 업무 ----------------
  function renderOwnerFilter() {
    var el = $('owner-filter');
    var chips = ['전체'].concat(state.members);
    el.innerHTML = chips.map(function (m) {
      return '<button class="chip' + (ui.ownerFilter === m ? ' active' : '') + '" data-owner="' + esc(m) + '">' + esc(m) + '</button>';
    }).join('');
    el.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.ownerFilter = btn.dataset.owner;
        renderOwnerFilter();
        renderTasks();
      });
    });
  }

  function renderTaskForm() {
    var wrap = $('task-form-wrap');
    if (!ui.showTaskForm) { wrap.innerHTML = ''; return; }
    function opts(list) { return list.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(''); }
    wrap.innerHTML = '<div class="inline-form" data-role="task-form">' +
      '<label class="full">업무명<input name="name" placeholder="예: 보도자료 초안 작성"></label>' +
      '<label>관련 캠페인<select name="campaign"><option>(캠페인 외 공통)</option>' +
      state.campaigns.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>담당자<input name="owner" list="member-list" value="' + esc(state.members[0] || '') + '"></label>' +
      '<label>우선순위<select name="priority">' + opts(PRIORITIES) + '</select></label>' +
      '<label>마감일<input name="due" type="date"></label>' +
      '<div class="form-actions">' +
      '<button class="btn btn-outline btn-sm" data-act="cancel">취소</button>' +
      '<button class="btn btn-primary btn-sm" data-act="save">추가</button>' +
      '</div></div>';
    var form = wrap.querySelector('[data-role="task-form"]');
    form.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      ui.showTaskForm = false; renderTaskForm();
    });
    form.querySelector('[data-act="save"]').addEventListener('click', function () {
      var v = readForm(form);
      if (!v.name.trim()) { alert('업무명을 입력해 주세요.'); return; }
      state.tasks.unshift({
        id: D.nextId(state.tasks, 'T'), name: v.name.trim(), campaign: v.campaign,
        owner: v.owner.trim(), priority: v.priority, due: v.due, status: '대기'
      });
      if (v.owner.trim() && state.members.indexOf(v.owner.trim()) < 0) state.members.push(v.owner.trim());
      ui.showTaskForm = false;
      persist(); renderAll();
    });
  }

  function renderTasks() {
    var tbody = $('task-tbody');
    var list = L.filterTasksByOwner(state.tasks, ui.ownerFilter);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="hint">표시할 업무가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (t) {
      var delayed = L.isDelayed(t, today);
      return '<tr class="' + (delayed ? 'delayed' : '') + '" data-id="' + esc(t.id) + '">' +
        '<td>' + esc(t.name) + (delayed ? '<span class="tag-delay">지연</span>' : '') + '</td>' +
        '<td>' + esc(t.campaign) + '</td>' +
        '<td>' + esc(t.owner) + '</td>' +
        '<td class="prio-' + esc(t.priority) + '">' + esc(t.priority) + '</td>' +
        '<td>' + esc(t.due || '-') + '</td>' +
        '<td><select class="cell-status">' +
        TASK_STATUSES.map(function (s) { return '<option' + (s === t.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select></td>' +
        '<td><button class="btn-del">삭제</button></td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.dataset.id;
      var sel = tr.querySelector('.cell-status');
      if (sel) sel.addEventListener('change', function () {
        state.tasks = state.tasks.map(function (t) {
          if (t.id !== id) return t;
          var copy = {}; Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
          copy.status = sel.value;
          return copy;
        });
        persist(); renderKpis(); renderTasks();
      });
      var del = tr.querySelector('.btn-del');
      if (del) del.addEventListener('click', function () {
        if (!confirm('이 업무를 삭제할까요?')) return;
        state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
        persist(); renderAll();
      });
    });
  }

  // ---------------- 주간 일정 ----------------
  function renderEventForm() {
    var wrap = $('event-form-wrap');
    if (!ui.showEventForm) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<div class="inline-form" data-role="event-form">' +
      '<label>날짜<input name="date" type="date" value="' + esc(L.formatDate(today)) + '"></label>' +
      '<label>시간<input name="time" type="time"></label>' +
      '<label>구분<select name="type">' + EVENT_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label>일정명<input name="title" placeholder="예: 주간 파트 회의"></label>' +
      '<div class="form-actions">' +
      '<button class="btn btn-outline btn-sm" data-act="cancel">취소</button>' +
      '<button class="btn btn-primary btn-sm" data-act="save">추가</button>' +
      '</div></div>';
    var form = wrap.querySelector('[data-role="event-form"]');
    form.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      ui.showEventForm = false; renderEventForm();
    });
    form.querySelector('[data-act="save"]').addEventListener('click', function () {
      var v = readForm(form);
      if (!v.title.trim()) { alert('일정명을 입력해 주세요.'); return; }
      if (!v.date) { alert('날짜를 선택해 주세요.'); return; }
      state.events.push({ id: D.nextId(state.events, 'E'), date: v.date, time: v.time, type: v.type, title: v.title.trim() });
      ui.showEventForm = false;
      persist(); renderEventForm(); renderWeek();
    });
  }

  function renderWeek() {
    var buckets = L.groupEventsByWeekday(state.events, today, ui.weekOffset);
    var mon = buckets[0].date, fri = buckets[4].date;
    $('week-label').textContent =
      (mon.getMonth() + 1) + '/' + mon.getDate() + ' (월) ~ ' + (fri.getMonth() + 1) + '/' + fri.getDate() + ' (금)' +
      (ui.weekOffset === 0 ? ' · 이번 주' : '');

    $('week-grid').innerHTML = buckets.map(function (b, i) {
      var isToday = L.formatDate(b.date) === L.formatDate(today);
      var evHtml = b.events.length ? b.events.map(function (ev) {
        return '<div class="event-card type-' + esc(ev.type) + '" data-id="' + esc(ev.id) + '">' +
          '<button class="ev-del" title="삭제">&times;</button>' +
          '<span class="ev-type ev-type-' + esc(ev.type) + '">' + esc(ev.type) + '</span>' +
          (ev.time ? '<span class="ev-time">' + esc(ev.time) + '</span>' : '') +
          esc(ev.title) + '</div>';
      }).join('') : '<div class="day-empty">일정 없음</div>';
      return '<div class="day-col' + (isToday ? ' today' : '') + '">' +
        '<div class="day-head"><span>' + (b.date.getMonth() + 1) + '/' + b.date.getDate() + '</span>' +
        '<span class="dow">' + DOW[i] + (isToday ? ' · 오늘' : '') + '</span></div>' + evHtml + '</div>';
    }).join('');

    $('week-grid').querySelectorAll('.event-card').forEach(function (card) {
      var id = card.dataset.id;
      card.querySelector('.ev-del').addEventListener('click', function () {
        if (!confirm('이 일정을 삭제할까요?')) return;
        state.events = state.events.filter(function (e) { return e.id !== id; });
        persist(); renderWeek();
      });
    });
  }

  // ---------------- 채널 성과 ----------------
  function channelSeries(channel) {
    var months = L.recentChannelMonths(state.channelStats, 6);
    var map = {};
    state.channelStats.forEach(function (r) {
      if (r.channel === channel) map[r.month] = r.value;
    });
    return {
      months: months,
      values: months.map(function (m) { return map[m] !== undefined ? map[m] : null; })
    };
  }

  function fmtValue(v, unit) {
    if (v === null || v === undefined) return '-';
    var num = unit === '%' ? Number(v).toFixed(1) : Number(v).toLocaleString('ko-KR');
    return num + (unit || '');
  }

  function renderChannels() {
    var grid = $('channel-grid');
    grid.innerHTML = state.channelMeta.map(function (meta) {
      var s = channelSeries(meta.channel);
      var last = s.values[s.values.length - 1];
      var prev = s.values[s.values.length - 2];
      var deltaHtml = '';
      if (last !== null && prev !== null && prev !== undefined) {
        var diff = last - prev;
        var cls = diff >= 0 ? 'up' : 'down';
        var arrow = diff >= 0 ? '▲' : '▼';
        var dv = meta.unit === '%' ? Math.abs(diff).toFixed(1) + '%p' : Math.abs(diff).toLocaleString('ko-KR') + (meta.unit || '');
        deltaHtml = '<span class="ch-delta ' + cls + '">' + arrow + ' ' + dv + ' <small>(전월 대비)</small></span>';
      }
      var lastMonth = s.months[s.months.length - 1] || '';
      return '<div class="channel-card' + (ui.selectedChannel === meta.channel ? ' active' : '') + '" data-channel="' + esc(meta.channel) + '">' +
        '<div class="ch-name">' + esc(meta.channel) + '</div>' +
        '<div class="ch-value">' + fmtValue(last, meta.unit) + '</div>' +
        deltaHtml +
        '<div class="ch-metric">' + esc(lastMonth) + ' ' + esc(meta.metric) + '</div>' +
        '</div>';
    }).join('');
    grid.querySelectorAll('.channel-card').forEach(function (card) {
      card.addEventListener('click', function () {
        ui.selectedChannel = card.dataset.channel;
        renderChannels(); renderChart();
      });
    });
  }

  function renderChart() {
    var meta = state.channelMeta.filter(function (m) { return m.channel === ui.selectedChannel; })[0] ||
      { channel: ui.selectedChannel, metric: '', unit: '' };
    var s = channelSeries(ui.selectedChannel);
    var ctx = $('channel-chart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: s.months,
        datasets: [{
          label: meta.channel + ' ' + meta.metric + (meta.unit ? ' (' + meta.unit + ')' : ''),
          data: s.values,
          borderColor: '#1b5bd7',
          backgroundColor: 'rgba(27, 91, 215, .12)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#0b2e59',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { font: { family: "'Noto Sans KR','Malgun Gothic',sans-serif" } } },
          title: { display: true, text: '최근 6개월 추이 — ' + meta.channel, color: '#0b2e59', font: { size: 14, weight: 'bold' } }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // ---------------- 공지 ----------------
  function renderNoticeForm() {
    var wrap = $('notice-form-wrap');
    if (!ui.showNoticeForm) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<div class="inline-form" data-role="notice-form">' +
      '<label class="full">제목<input name="title" placeholder="공지 제목"></label>' +
      '<label>작성자<input name="author" list="member-list" value="' + esc(state.members[0] || '') + '"></label>' +
      '<label>중요도<select name="importance"><option>보통</option><option>높음</option></select></label>' +
      '<label>상단 고정<select name="pinned"><option value="N">아니오</option><option value="Y">예</option></select></label>' +
      '<div class="form-actions">' +
      '<button class="btn btn-outline btn-sm" data-act="cancel">취소</button>' +
      '<button class="btn btn-primary btn-sm" data-act="save">추가</button>' +
      '</div></div>';
    var form = wrap.querySelector('[data-role="notice-form"]');
    form.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      ui.showNoticeForm = false; renderNoticeForm();
    });
    form.querySelector('[data-act="save"]').addEventListener('click', function () {
      var v = readForm(form);
      if (!v.title.trim()) { alert('제목을 입력해 주세요.'); return; }
      state.notices.unshift({
        id: D.nextId(state.notices, 'N'), pinned: v.pinned === 'Y', importance: v.importance,
        title: v.title.trim(), author: v.author.trim(), date: L.formatDate(today)
      });
      ui.showNoticeForm = false;
      persist(); renderNoticeForm(); renderNotices();
    });
  }

  function renderNotices() {
    var list = state.notices.slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
    $('notice-list').innerHTML = list.length ? list.map(function (n) {
      return '<li class="' + (n.pinned ? 'pinned' : '') + '" data-id="' + esc(n.id) + '">' +
        (n.pinned ? '<span class="pin-mark">고정</span>' : '') +
        '<span class="imp-' + esc(n.importance) + '">' + esc(n.importance) + '</span>' +
        '<span class="notice-title">' + esc(n.title) + '</span>' +
        '<span class="notice-meta">' + esc(n.author) + ' · ' + esc(n.date) + '</span>' +
        '<button class="btn-del">삭제</button></li>';
    }).join('') : '<li class="hint">등록된 공지가 없습니다.</li>';

    $('notice-list').querySelectorAll('li[data-id]').forEach(function (li) {
      var id = li.dataset.id;
      li.querySelector('.btn-del').addEventListener('click', function () {
        if (!confirm('이 공지를 삭제할까요?')) return;
        state.notices = state.notices.filter(function (n) { return n.id !== id; });
        persist(); renderNotices();
      });
    });
  }

  // ---------------- 엑셀 가져오기 / 내보내기 ----------------
  function exportExcel() {
    var wb = XLSX.utils.book_new();
    var sheets = D.stateToSheets(state);
    Object.keys(sheets).forEach(function (name) {
      var ws = XLSX.utils.aoa_to_sheet(sheets[name]);
      ws['!cols'] = sheets[name][0].map(function (h, i) {
        var w = 12;
        sheets[name].forEach(function (r) { w = Math.max(w, String(r[i] === undefined ? '' : r[i]).length + 4); });
        return { wch: Math.min(w, 44) };
      });
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, '마케팅_대시보드_데이터.xlsx');
  }

  function importExcel(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        var sheetMap = {};
        wb.SheetNames.forEach(function (name) {
          sheetMap[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
        });
        var result = D.sheetsToState(sheetMap, state);
        if (!result.imported.length) {
          alert('인식된 시트가 없습니다.\n시트명은 [캠페인 / 업무 / 주간일정 / 채널실적 / 공지] 형식이어야 합니다.\n[엑셀 내보내기]로 양식을 먼저 받아 사용해 주세요.');
          return;
        }
        state = result.state;
        persist(); renderAll();
        alert('가져오기 완료: ' + result.imported.join(', ') + ' 시트를 반영했습니다.');
      } catch (err) {
        alert('엑셀을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ---------------- 공통 ----------------
  function renderMemberDatalist() {
    var dl = document.getElementById('member-list');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'member-list';
      document.body.appendChild(dl);
    }
    dl.innerHTML = state.members.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
  }

  function renderAll() {
    renderMemberDatalist();
    renderKpis();
    renderCampaignFilter();
    renderCampaigns();
    renderOwnerFilter();
    renderTaskForm();
    renderTasks();
    renderEventForm();
    renderWeek();
    renderChannels();
    renderChart();
    renderNoticeForm();
    renderNotices();
  }

  function bindToolbar() {
    $('today-line').textContent = '기준일: ' + L.formatDate(today) +
      ' (' + ['일', '월', '화', '수', '목', '금', '토'][today.getDay()] + ') · 편집 내용은 이 브라우저(localStorage)에 자동 저장됩니다.';

    $('excel-file').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (f) importExcel(f);
      e.target.value = '';
    });
    $('btn-export').addEventListener('click', exportExcel);
    $('btn-sample').addEventListener('click', function () {
      if (!confirm('샘플 데이터를 불러올까요? 현재 편집 내용은 대체됩니다.')) return;
      state = D.defaultState();
      persist(); renderAll();
    });
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('저장된 편집 내용을 모두 지우고 초기 상태로 되돌릴까요?')) return;
      D.clearState();
      state = D.defaultState();
      renderAll();
    });
    $('btn-add-campaign').addEventListener('click', function () {
      ui.editingCampaignId = '__new__';
      renderCampaigns();
    });
    $('btn-add-task').addEventListener('click', function () {
      ui.showTaskForm = !ui.showTaskForm;
      renderTaskForm();
    });
    $('btn-add-event').addEventListener('click', function () {
      ui.showEventForm = !ui.showEventForm;
      renderEventForm();
    });
    $('btn-add-notice').addEventListener('click', function () {
      ui.showNoticeForm = !ui.showNoticeForm;
      renderNoticeForm();
    });
    $('btn-prev-week').addEventListener('click', function () { ui.weekOffset--; renderWeek(); });
    $('btn-next-week').addEventListener('click', function () { ui.weekOffset++; renderWeek(); });
    $('btn-this-week').addEventListener('click', function () { ui.weekOffset = 0; renderWeek(); });
  }

  /**
   * 시작 — 팀 공용 자료를 먼저 받아 온 뒤 화면을 그린다.
   * 연결이 안 되면 이 브라우저에 있던 것으로 그대로 그린다(배너에 이유가 뜬다).
   */
  function boot() {
    bindToolbar();

    if (window.HDDoc && HDDoc.available()) {
      HDDoc.boot({
        id: 'amps-marketing',
        initial: state,                 // 서버가 비어 있으면 이걸 씨앗으로 올린다
        onReady: function (doc) {
          if (doc && Array.isArray(doc.campaigns) && Array.isArray(doc.tasks)) {
            // state 를 통째로 바꾸지 않고 속을 갈아 끼운다.
            // 다른 함수들이 이 객체를 이미 붙들고 있기 때문이다.
            Object.keys(state).forEach(function (k) { delete state[k]; });
            Object.keys(doc).forEach(function (k) { state[k] = doc[k]; });
          }
          renderAll();
        },
        onFallback: function () { renderAll(); }
      });
      return;
    }

    if (window.HDDoc) HDDoc.banner('demo');
    renderAll();
  }

  boot();
})();
