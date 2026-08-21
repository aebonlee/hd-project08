/**
 * logic.js — 회의록 정리 도우미 순수 로직
 * 줄 단위 규칙 기반 분류(결정/액션/논의) + 담당자·기한 추출 + 마크다운 생성.
 * 브라우저(window.MeetingLogic)와 Node(module.exports) 양쪽에서 동작. DOM 접근 금지.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MeetingLogic = api;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // 직함/호칭 (담당자 추출에 사용)
  var TITLES = '님|씨|책임|프로|매니저|대리|과장|차장|부장|팀장|사원|주임|수석|실장';

  // 액션을 강하게 암시하는 명시적 마커
  var RE_ACTION_MARKER = /(^|\W)(TODO|To-?Do|투두|액션(\s*아이템)?|A\/I|후속\s*조치|F\/U|팔로우업)(\W|$)/i;
  var RE_MENTION = /@([가-힣A-Za-z0-9._-]+)/;
  var RE_OWNER_LABEL = new RegExp('담당(자)?\\s*[:：]?\\s*([가-힣]{2,4})\\s*(' + TITLES + ')?');
  // "홍길동이 ~까지", "김민서 대리가 ~까지" 류
  var RE_PERSON_UNTIL = new RegExp('([가-힣]{2,4})\\s*(' + TITLES + ')?\\s*(이|가|께서)\\s*[^\\n]*까지');

  // 결정 키워드
  var RE_DECISION = /(결정|확정|하기로\s*(함|했|한다|결정)|하기로$|승인|합의|채택|결론|(으로|로)\s*정함|정하였|가결)/;

  // 액션성 동사 (기한과 함께 있으면 액션으로 판단)
  var RE_TASK_VERB = /(완료|제출|공유|전달|작성|보고|준비|발송|송부|확인|회신|정리|업데이트|요청|취합|검토|배포|등록)/;

  /** 불릿/번호 접두어 제거 */
  function stripBullet(line) {
    return String(line || '')
      .replace(/^\s*([-*•·▶▷○●]|\d+[.)]|[①-⑳])\s*/, '')
      .trim();
  }

  /**
   * 한 줄 분류: 'decision' | 'action' | 'discussion'
   * 우선순위:
   *  1) 명시적 액션 마커(TODO/@이름/담당:/액션) → action
   *  2) 결정 키워드(결정/확정/하기로 등) → decision
   *  3) "~가/이 ~까지" 또는 기한+액션성 동사 → action
   *  4) 나머지 → discussion
   */
  function classifyLine(rawLine) {
    var line = stripBullet(rawLine);
    if (!line) return null;
    if (RE_ACTION_MARKER.test(line) || RE_MENTION.test(line) || RE_OWNER_LABEL.test(line)) {
      return 'action';
    }
    if (RE_DECISION.test(line)) return 'decision';
    if (RE_PERSON_UNTIL.test(line)) return 'action';
    if (/까지/.test(line) && RE_TASK_VERB.test(line)) return 'action';
    return 'discussion';
  }

  /** 담당자 추출 ('' = 미정) */
  function extractAssignee(rawLine) {
    var line = stripBullet(rawLine);
    var m = line.match(RE_MENTION);
    if (m) return m[1];
    m = line.match(RE_OWNER_LABEL);
    if (m) return m[2];
    m = line.match(RE_PERSON_UNTIL);
    if (m) return m[1];
    // "홍길동:" 접두 형태
    m = line.match(/^([가-힣]{2,4})\s*[:：]/);
    if (m) return m[1];
    return '';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function fmt(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 기준일이 속한 주(월요일 시작)의 특정 요일 날짜 */
  function weekdayOf(base, dowKo, nextWeek) {
    var idx = '월화수목금토일'.indexOf(dowKo); // 0=월
    if (idx < 0) return null;
    var day = base.getDay(); // 0=일
    var monOffset = (day === 0 ? -6 : 1 - day);
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + monOffset + idx + (nextWeek ? 7 : 0));
    // "금요일까지"가 이미 지난 요일이면 다음 주로 해석
    if (!nextWeek && d < base) d.setDate(d.getDate() + 7);
    return d;
  }

  /**
   * 기한 추출. 반환: '' 또는 'YYYY-MM-DD' 또는 원문 표현(계산 불가 시).
   * baseDate: 기준일(Date 또는 'YYYY-MM-DD')
   */
  function extractDue(rawLine, baseDate) {
    var line = stripBullet(rawLine);
    var base = baseDate instanceof Date ? baseDate : (baseDate ? new Date(baseDate + 'T00:00:00') : new Date());
    if (isNaN(base)) base = new Date();
    base = new Date(base.getFullYear(), base.getMonth(), base.getDate()); // 자정으로 정규화
    var m;

    m = line.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);

    m = line.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m) return base.getFullYear() + '-' + pad2(+m[1]) + '-' + pad2(+m[2]);

    m = line.match(/(?:^|[^\d.])(\d{1,2})[\/.](\d{1,2})(?![\d.%])/);
    if (m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) {
      return base.getFullYear() + '-' + pad2(+m[1]) + '-' + pad2(+m[2]);
    }

    if (/오늘/.test(line)) return fmt(base);
    if (/내일/.test(line)) return fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1));
    if (/모레/.test(line)) return fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 2));

    m = line.match(/(다음\s*주|차주)?\s*(월|화|수|목|금|토|일)요일/);
    if (m) {
      var d = weekdayOf(base, m[2], !!m[1]);
      if (d) return fmt(d);
    }
    if (/(다음\s*주|차주)/.test(line)) {
      var nf = weekdayOf(base, '금', true);
      return nf ? fmt(nf) : '다음 주';
    }
    if (/(이번\s*주|금주)/.test(line)) {
      var f = weekdayOf(base, '금', false);
      return f ? fmt(f) : '이번 주';
    }
    if (/월말/.test(line)) {
      return fmt(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    }
    if (/(EOD|당일)/i.test(line)) return fmt(base);
    return '';
  }

  /** 액션 본문 정리: 마커/담당/기한 표현을 걷어낸 요약 텍스트 */
  function cleanActionText(rawLine) {
    var t = stripBullet(rawLine);
    t = t.replace(RE_ACTION_MARKER, ' ');
    t = t.replace(/@[가-힣A-Za-z0-9._-]+/g, ' ');
    t = t.replace(new RegExp('담당(자)?\\s*[:：]?\\s*[가-힣]{2,4}\\s*(' + TITLES + ')?'), ' ');
    t = t.replace(/\s+,/g, ',').replace(/,{2,}/g, ',');
    t = t.replace(/^[\s,·:：-]+|[\s,·:：-]+$/g, '').replace(/\s{2,}/g, ' ');
    return t || stripBullet(rawLine);
  }

  /**
   * 메모 전체 파싱.
   * 반환: { decisions:[{id,text}], actions:[{id,text,assignee,due}], discussions:[{id,text}] }
   */
  function parseMemo(text, baseDate) {
    var out = { decisions: [], actions: [], discussions: [] };
    var seq = 0;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = stripBullet(raw);
      if (!line) return;
      var kind = classifyLine(raw);
      var id = 'i' + (++seq);
      if (kind === 'decision') {
        out.decisions.push({ id: id, text: line });
      } else if (kind === 'action') {
        out.actions.push({
          id: id,
          text: cleanActionText(raw),
          assignee: extractAssignee(raw),
          due: extractDue(raw, baseDate)
        });
      } else {
        out.discussions.push({ id: id, text: line });
      }
    });
    return out;
  }

  /** 항목 이동: 결정 ↔ 논의 ↔ 액션 (parsed를 변경한 새 객체 반환) */
  function moveItem(parsed, id, target) {
    var keys = { decision: 'decisions', action: 'actions', discussion: 'discussions' };
    var next = { decisions: [], actions: [], discussions: [] };
    var found = null;
    ['decisions', 'actions', 'discussions'].forEach(function (k) {
      parsed[k].forEach(function (item) {
        if (item.id === id) { found = item; return; }
        next[k].push(item);
      });
    });
    if (!found || !keys[target]) return parsed;
    var moved = { id: found.id, text: found.text };
    if (target === 'action') {
      moved.assignee = found.assignee || extractAssignee(found.text);
      moved.due = found.due || extractDue(found.text);
    }
    next[keys[target]].push(moved);
    return next;
  }

  /** 표준 회의록 마크다운 생성 */
  function toMarkdown(info, parsed) {
    info = info || {};
    parsed = parsed || { decisions: [], actions: [], discussions: [] };
    var lines = [];
    lines.push('# 회의록: ' + (info.title || '(제목 없음)'));
    lines.push('');
    lines.push('- **일시**: ' + (info.datetime || '-'));
    lines.push('- **참석자**: ' + (info.attendees || '-'));
    lines.push('- **작성자**: ' + (info.author || '-'));
    lines.push('');
    lines.push('## 1. 논의 내용');
    if (parsed.discussions.length) {
      parsed.discussions.forEach(function (d) { lines.push('- ' + d.text); });
    } else {
      lines.push('- (없음)');
    }
    lines.push('');
    lines.push('## 2. 결정 사항');
    if (parsed.decisions.length) {
      parsed.decisions.forEach(function (d) { lines.push('- ' + d.text); });
    } else {
      lines.push('- (없음)');
    }
    lines.push('');
    lines.push('## 3. 액션 아이템');
    if (parsed.actions.length) {
      lines.push('| 항목 | 담당 | 기한 |');
      lines.push('|---|---|---|');
      parsed.actions.forEach(function (a) {
        lines.push('| ' + a.text.replace(/\|/g, '/') + ' | ' + (a.assignee || '미정') + ' | ' + (a.due || '미정') + ' |');
      });
    } else {
      lines.push('- (없음)');
    }
    lines.push('');
    lines.push('## 4. 다음 회의');
    lines.push('- ' + (info.nextMeeting || '미정'));
    lines.push('');
    return lines.join('\n');
  }

  /** 사내 Copilot/LLM에 붙여넣을 회의록 정리 프롬프트 생성 */
  function buildPrompt(info, memo) {
    info = info || {};
    return [
      '당신은 회의록 정리 전문가입니다. 아래 [회의 메모]를 읽고 표준 회의록으로 정리해 주세요.',
      '',
      '요구사항:',
      '1. 결과는 마크다운으로 작성합니다.',
      '2. 구성: 회의 개요(제목/일시/참석자/작성자) → 논의 내용 → 결정 사항 → 액션 아이템 표(항목·담당·기한) → 다음 회의.',
      '3. 결정 사항은 "~하기로 함" 형태의 완결된 문장으로 통일합니다.',
      '4. 액션 아이템의 담당자와 기한이 메모에 없으면 "미정"으로 표기하고, 날짜는 YYYY-MM-DD로 통일합니다.',
      '5. 메모에 없는 내용을 추측해서 추가하지 않습니다.',
      '',
      '[회의 정보]',
      '- 제목: ' + (info.title || '(미입력)'),
      '- 일시: ' + (info.datetime || '(미입력)'),
      '- 참석자: ' + (info.attendees || '(미입력)'),
      '- 작성자: ' + (info.author || '(미입력)'),
      '',
      '[회의 메모]',
      String(memo || '').trim() || '(메모 없음)'
    ].join('\n');
  }

  return {
    stripBullet: stripBullet,
    classifyLine: classifyLine,
    extractAssignee: extractAssignee,
    extractDue: extractDue,
    cleanActionText: cleanActionText,
    parseMemo: parseMemo,
    moveItem: moveItem,
    toMarkdown: toMarkdown,
    buildPrompt: buildPrompt
  };
});
