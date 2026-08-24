-- 로컬 검증 전용 — hd-project08 (운영 실행 금지)
do $guard$
begin
  if exists (select 1 from pg_roles where rolname in ('supabase_admin','authenticator'))
     or exists (select 1 from pg_namespace where nspname='graphql') then
    raise exception '이 파일은 로컬 검증 전용입니다.';
  end if;
end;
$guard$;

do $t$ begin raise notice '[프로젝트] 완료 동기화 · 지연 판정 · 할 일 추적'; end $t$;

do $t$
declare v_id bigint; v_m bigint; v_a bigint; v_r boolean;
begin
  -- 완료로 바꾸면 진행률·완료시각이 함께 맞는다
  insert into public.task (title, part, status, progress) values ('테스트업무','마케팅','진행중', 40)
  returning id into v_id;
  perform public._assert_eq((select progress from public.task where id=v_id), 40, '진행중 진행률 40');
  perform public._assert((select done_at from public.task where id=v_id) is null, '진행중이면 완료시각 없음');

  update public.task set status='완료' where id=v_id;
  perform public._assert_eq((select progress from public.task where id=v_id), 100,
    '완료로 바꾸면 진행률이 100 으로 맞춰진다');
  perform public._assert((select done_at from public.task where id=v_id) is not null,
    '완료로 바꾸면 완료시각이 채워진다');

  -- 되돌리면 셋이 함께 풀린다
  update public.task set status='진행중' where id=v_id;
  perform public._assert((select done_at from public.task where id=v_id) is null,
    '되돌리면 완료시각이 지워진다');
  perform public._assert((select progress from public.task where id=v_id) < 100,
    '완료가 아니면 진행률이 100 으로 남지 않는다');

  -- 지연 판정
  update public.task set due_date = current_date - 5 where id=v_id;
  perform public._assert_eq((select due_state from public.task_board where id=v_id), '지연', '기한이 지나면 지연');
  perform public._assert_eq((select overdue_days from public.task_board where id=v_id), 5, '지연 5일');

  update public.task set due_date = current_date + 2 where id=v_id;
  perform public._assert_eq((select due_state from public.task_board where id=v_id), '임박', '3일 이내면 임박');

  update public.task set due_date = current_date + 30 where id=v_id;
  perform public._assert_eq((select due_state from public.task_board where id=v_id), '여유', '멀면 여유');

  -- 완료된 업무는 기한이 지났어도 지연이 아니다
  update public.task set due_date = current_date - 5, status='완료' where id=v_id;
  perform public._assert_eq((select due_state from public.task_board where id=v_id), '완료',
    '완료된 업무는 기한이 지나도 지연으로 세지 않는다');
  perform public._assert_eq((select overdue_days from public.task_board where id=v_id), 0,
    '완료된 업무의 지연일수는 0');

  v_r := false;
  begin
    insert into public.task (title, start_date, due_date)
    values ('날짜역전','2026-09-10','2026-09-01');
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '기한이 시작일보다 앞서면 check 제약이 막는다');

  v_r := false;
  begin
    insert into public.task (title, progress) values ('진행률초과', 150);
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '진행률 100 초과는 check 제약이 막는다');

  -- 회의 → 할 일
  insert into public.meeting (title, held_at) values ('테스트회의', now()) returning id into v_m;
  insert into public.action_item (meeting_id, content, owner_name, due_date)
  values (v_m, '자료 정리', '홍길동', current_date - 2) returning id into v_a;

  perform public._assert_eq((select count(*) from public.open_actions where id=v_a), 1::bigint,
    '안 끝난 할 일이 드러난다');
  perform public._assert_eq((select overdue_days from public.open_actions where id=v_a), 2,
    '할 일 지연 2일');

  update public.action_item set done = true where id=v_a;
  perform public._assert((select done_at from public.action_item where id=v_a) is not null,
    '완료 표시하면 완료시각이 채워진다');
  perform public._assert_eq((select count(*) from public.open_actions where id=v_a), 0::bigint,
    '끝난 할 일은 목록에서 빠진다');

  -- 회의를 지우면 할 일도 함께 사라진다
  delete from public.meeting where id=v_m;
  perform public._assert_eq((select count(*) from public.action_item where meeting_id=v_m), 0::bigint,
    '회의를 지우면 할 일도 함께 지워진다 (고아 행이 남지 않는다)');

  perform public._assert_eq(
    (select done from public.part_summary where part='마케팅'), 1::bigint,
    '파트별 요약에 완료 건수가 잡힌다');
end $t$;

do $t$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('task','meeting')
     and not exists (
       select 1 from pg_policy p where p.polrelid=c.oid and p.polcmd='w'
         and pg_get_expr(p.polqual, p.polrelid) like '%uid()%');
  perform public._assert(v_bad is null,
    '업무·회의록 수정 정책에 작성자 조건이 있다' || coalesce(' (누락: '||v_bad||')',''));
end $t$;

delete from public.task where title='테스트업무';

do $t$ begin raise notice ''; raise notice '전부 통과했습니다.'; end $t$;
