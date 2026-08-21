/**
 * app.js — 회의록 정리 도우미 UI
 * 분류/추출/마크다운 생성은 MeetingLogic(logic.js) 사용.
 */
(function () {
  'use strict';

  var L = window.MeetingLogic;
  var STORAGE_KEY = 'amps_meeting_notes_v1';

  var state = {
    info: { title: '', datetime: '', attendees: '', author: '', nextMeeting: '' },
    memo: '',
    parsed: null
  };

  var SAMPLE = {
    info: {
      title: '8월 마케팅 파트 주간회의',
      datetime: '2026-08-21 10:00',
      attendees: '홍재영, 김민서, 이준호, 박소연, 최다인',
      author: '홍재영',
      nextMeeting: '2026-08-28 10:00 회의실 B'
    },
    memo: [
      '지난주 뉴스레터 오픈율 39%로 상승, 리뉴얼 효과로 보임',
      '9월호부터 신규 뉴스레터 템플릿을 전면 적용하기로 결정',
      '발송 대상은 딜러 포함 전체로 확정',
      '티저 영상 공개일은 8/28로 하기로 함',
      '김민서가 8/26까지 Develon 가을 프로모션 기획안 제출',
      'TODO: 전시회 부스 시안 2차 피드백 취합 @이준호 9/4까지',
      '보도자료 최종본 배포 담당: 박소연, 다음 주 화요일까지',
      'SNS 광고 예산 증액 여부는 데이터 더 보고 재논의',
      '최다인 님이 금요일까지 브랜드 필름 콘티 공유',
      '홈페이지 개편 성과는 다음 회의에서 회고 진행'
    ].join('\n')
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- 저장/복원 ----------
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var st = JSON.parse(raw);
      if (st && typeof st === 'object') {
        state.info = st.info || state.info;
        state.memo = st.memo || '';
        state.parsed = st.parsed || null;
      }
    } catch (e) { /* 무시 */ }
  }

  function readInfoInputs() {
    state.info = {
      title: $('in-title').value.trim(),
      datetime: $('in-datetime').value.trim(),
      attendees: $('in-attendees').value.trim(),
      author: $('in-author').value.trim(),
      nextMeeting: $('in-next').value.trim()
    };
    state.memo = $('in-memo').value;
  }

  function fillInputs() {
    $('in-title').value = state.info.title || '';
    $('in-datetime').value = state.info.datetime || '';
    $('in-attendees').value = state.info.attendees || '';
    $('in-author').value = state.info.author || '';
    $('in-next').value = state.info.nextMeeting || '';
    $('in-memo').value = state.memo || '';
  }

  // ---------- 회의록 렌더 ----------
  function moveBtns(id, current) {
    var targets = { decision: '결정', action: '액션', discussion: '논의' };
    var html = '<span class="move-btns">';
    Object.keys(targets).forEach(function (t) {
      if (t === current) return;
      html += '<button class="mv" data-id="' + esc(id) + '" data-target="' + t + '">→' + targets[t] + '</button>';
    });
    return html + '</span>';
  }

  function renderMinutes() {
    var area = $('minutes-area');
    if (!state.parsed) {
      area.innerHTML = '<p class="placeholder">좌측에 메모를 입력하고 [정리하기]를 누르면 여기에 회의록이 표시됩니다.</p>';
      return;
    }
    var p = state.parsed;
    var html = '';
    html += '<h3 class="m-title">회의록: ' + esc(state.info.title || '(제목 없음)') + '</h3>';
    html += '<ul class="m-meta">' +
      '<li>일시: <b>' + esc(state.info.datetime || '-') + '</b></li>' +
      '<li>참석자: <b>' + esc(state.info.attendees || '-') + '</b></li>' +
      '<li>작성자: <b>' + esc(state.info.author || '-') + '</b></li></ul>';

    html += '<h4 class="m-sec">1. 논의 내용<span class="badge-cnt">' + p.discussions.length + '</span></h4>';
    html += p.discussions.length
      ? '<ul class="m-list">' + p.discussions.map(function (d) {
          return '<li><span class="txt">' + esc(d.text) + '</span>' + moveBtns(d.id, 'discussion') + '</li>';
        }).join('') + '</ul>'
      : '<p class="m-empty">(없음)</p>';

    html += '<div class="sec-decision"><h4 class="m-sec">2. 결정 사항<span class="badge-cnt">' + p.decisions.length + '</span></h4>';
    html += p.decisions.length
      ? '<ul class="m-list">' + p.decisions.map(function (d) {
          return '<li><span class="txt">' + esc(d.text) + '</span>' + moveBtns(d.id, 'decision') + '</li>';
        }).join('') + '</ul>'
      : '<p class="m-empty">(없음)</p>';
    html += '</div>';

    html += '<h4 class="m-sec">3. 액션 아이템<span class="badge-cnt">' + p.actions.length + '</span></h4>';
    if (p.actions.length) {
      html += '<table class="action-table"><thead><tr><th>항목</th><th style="width:110px">담당</th><th style="width:130px">기한</th><th style="width:120px"></th></tr></thead><tbody>';
      html += p.actions.map(function (a) {
        return '<tr data-id="' + esc(a.id) + '">' +
          '<td>' + esc(a.text) + '</td>' +
          '<td><input class="edit-assignee' + (a.assignee ? '' : ' missing') + '" value="' + esc(a.assignee) + '" placeholder="미정"></td>' +
          '<td><input class="edit-due' + (a.due ? '' : ' missing') + '" value="' + esc(a.due) + '" placeholder="미정"></td>' +
          '<td>' + moveBtns(a.id, 'action') + '</td></tr>';
      }).join('');
      html += '</tbody></table>';
    } else {
      html += '<p class="m-empty">(없음)</p>';
    }

    html += '<h4 class="m-sec">4. 다음 회의</h4><p style="padding-left:8px">' + esc(state.info.nextMeeting || '미정') + '</p>';
    area.innerHTML = html;

    // 이동 버튼
    area.querySelectorAll('.mv').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.parsed = L.moveItem(state.parsed, btn.dataset.id, btn.dataset.target);
        save();
        renderMinutes();
      });
    });
    // 액션 담당/기한 인라인 편집
    area.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.dataset.id;
      function bind(cls, field) {
        var inp = tr.querySelector(cls);
        if (!inp) return;
        inp.addEventListener('change', function () {
          state.parsed.actions = state.parsed.actions.map(function (a) {
            if (a.id !== id) return a;
            var copy = { id: a.id, text: a.text, assignee: a.assignee, due: a.due };
            copy[field] = inp.value.trim();
            return copy;
          });
          save();
          inp.classList.toggle('missing', !inp.value.trim());
        });
      }
      bind('.edit-assignee', 'assignee');
      bind('.edit-due', 'due');
    });
  }

  // ---------- 프롬프트 ----------
  function renderPrompt() {
    readInfoInputs();
    $('prompt-area').value = L.buildPrompt(state.info, state.memo);
  }

  // ---------- 내보내기 ----------
  function currentMarkdown() {
    return L.toMarkdown(state.info, state.parsed || { decisions: [], actions: [], discussions: [] });
  }

  function copyText(text, doneMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); alert(doneMsg); } catch (e) { alert('복사에 실패했습니다. 직접 선택해 복사해 주세요.'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { alert(doneMsg); }, fallback);
    } else {
      fallback();
    }
  }

  function downloadMd() {
    var name = '회의록_' + (state.info.title || '무제').replace(/[\\/:*?"<>|\s]+/g, '_') + '.md';
    var blob = new Blob(['﻿' + currentMarkdown()], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ---------- 탭 ----------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    $('tab-minutes').classList.toggle('hidden', name !== 'minutes');
    $('tab-prompt').classList.toggle('hidden', name !== 'prompt');
    if (name === 'prompt') renderPrompt();
  }

  // ---------- 이벤트 ----------
  function bind() {
    $('btn-organize').addEventListener('click', function () {
      readInfoInputs();
      if (!state.memo.trim()) { alert('회의 메모를 먼저 입력해 주세요.'); return; }
      state.parsed = L.parseMemo(state.memo, new Date());
      save();
      switchTab('minutes');
      renderMinutes();
    });

    $('btn-sample').addEventListener('click', function () {
      if (state.memo.trim() && !confirm('샘플 메모를 불러올까요? 현재 입력 내용은 대체됩니다.')) return;
      state.info = JSON.parse(JSON.stringify(SAMPLE.info));
      state.memo = SAMPLE.memo;
      state.parsed = null;
      fillInputs();
      save();
      renderMinutes();
    });

    $('btn-clear').addEventListener('click', function () {
      if (!confirm('입력 내용과 정리 결과를 모두 지울까요?')) return;
      state = { info: { title: '', datetime: '', attendees: '', author: '', nextMeeting: '' }, memo: '', parsed: null };
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 무시 */ }
      fillInputs();
      renderMinutes();
    });

    // 입력 자동 저장
    ['in-title', 'in-datetime', 'in-attendees', 'in-author', 'in-next', 'in-memo'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        readInfoInputs();
        save();
      });
    });

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });

    $('btn-copy-md').addEventListener('click', function () {
      if (!state.parsed) { alert('먼저 [정리하기]를 실행해 주세요.'); return; }
      copyText(currentMarkdown(), '마크다운 회의록이 클립보드에 복사되었습니다.');
    });
    $('btn-download-md').addEventListener('click', function () {
      if (!state.parsed) { alert('먼저 [정리하기]를 실행해 주세요.'); return; }
      downloadMd();
    });
    $('btn-print').addEventListener('click', function () {
      if (!state.parsed) { alert('먼저 [정리하기]를 실행해 주세요.'); return; }
      switchTab('minutes');
      window.print();
    });
    $('btn-copy-prompt').addEventListener('click', function () {
      renderPrompt();
      copyText($('prompt-area').value, '프롬프트가 클립보드에 복사되었습니다.');
    });
  }

  load();
  fillInputs();
  bind();
  renderMinutes();
})();
