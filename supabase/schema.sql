-- ============================================================================
-- hd-project08 — 마케팅 업무공유 대시보드 + 회의록 정리
-- Supabase(Postgres) 운영 스키마 + RLS · 재실행 안전
--
--  이 스키마는 **수강생 본인의 Supabase 프로젝트**에 올리는 것을 전제로 합니다.
--  프로젝트가 본인 것이라 테이블 이름에 접두사를 붙이지 않았습니다.
--  (여러 앱을 한 프로젝트에 몰아 쓸 계획이면 이름 충돌을 먼저 확인하세요.)
--
--  "업무공유"는 **서로 보여야** 성립합니다. 각자 브라우저에만 있으면 공유가 아닙니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 테이블
-- ----------------------------------------------------------------------------

create table if not exists public.member (
  user_id    uuid primary key,
  name       text not null,
  email      text,
  part       text,                                -- 파트/담당
  role       text not null default '팀원' check (role in ('팀원','파트장','관리자')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.task (
  id          bigint generated always as identity primary key,
  title       text not null,
  part        text,
  owner_id    uuid default auth.uid(),
  owner_name  text,
  status      text not null default '진행중'
              check (status in ('예정','진행중','보류','완료')),
  priority    text not null default '보통' check (priority in ('높음','보통','낮음')),
  start_date  date,
  due_date    date,
  done_at     timestamptz,
  progress    int not null default 0 check (progress between 0 and 100),
  detail      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 완료인데 진행률이 100 이 아니면 대시보드 수치가 서로 어긋난다
  constraint task_done_progress
    check (status <> '완료' or progress = 100),
  constraint task_dates
    check (due_date is null or start_date is null or due_date >= start_date)
);
create index if not exists task_status_idx on public.task (status, due_date);
create index if not exists task_owner_idx  on public.task (owner_id);

create table if not exists public.meeting (
  id          bigint generated always as identity primary key,
  title       text not null,
  held_at     timestamptz not null,
  place       text,
  attendees   text,
  raw_notes   text,                               -- 붙여 넣은 원문
  summary     text,                               -- 정리된 요약
  decisions   text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists meeting_idx on public.meeting (held_at desc);

-- 회의에서 나온 할 일. 회의록만 남고 실행이 안 되는 것을 막는 자리다.
create table if not exists public.action_item (
  id          bigint generated always as identity primary key,
  meeting_id  bigint not null references public.meeting(id) on delete cascade,
  content     text not null,
  owner_name  text,
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  -- 완료 표시와 완료 시각이 따로 놀면 "언제 끝났나"를 알 수 없다
  constraint action_done_consistency check (done = (done_at is not null))
);
create index if not exists action_meeting_idx on public.action_item (meeting_id);

create table if not exists public.log (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  kind      text not null,
  detail    text,
  processed int not null default 0,
  failed    int not null default 0,
  actor     uuid default auth.uid()
);
create index if not exists log_ran_at_idx on public.log (ran_at desc);

create table if not exists public.admin (
  user_id uuid primary key, email text, created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. 함수
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.admin a where a.user_id = auth.uid())
      or exists (select 1 from public.member m
                  where m.user_id = auth.uid() and m.role in ('파트장','관리자'));
$fn$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.member m where m.user_id = auth.uid() and m.active);
$fn$;

-- 완료로 바꾸면 진행률과 완료 시각을 함께 맞춘다.
-- 사람이 셋을 따로 고치게 두면 반드시 어긋난다.
create or replace function public.sync_task()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.status = '완료' then
    new.progress := 100;
    if new.done_at is null then new.done_at := now(); end if;
  else
    new.done_at := null;
    if new.progress = 100 then new.progress := 99; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists task_sync on public.task;
create trigger task_sync before insert or update on public.task
  for each row execute function public.sync_task();

create or replace function public.sync_action()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.done and new.done_at is null then new.done_at := now(); end if;
  if not new.done then new.done_at := null; end if;
  return new;
end;
$fn$;

drop trigger if exists action_sync on public.action_item;
create trigger action_sync before insert or update on public.action_item
  for each row execute function public.sync_action();

-- ----------------------------------------------------------------------------
-- 3. 뷰
-- ----------------------------------------------------------------------------


-- ⚠ 뷰에는 `with (security_invoker = true)` 를 붙인다.
--   붙이지 않으면 뷰는 **만든 사람(postgres)의 권한**으로 돌아, 뷰를 읽을 수 있는
--   사람이 밑에 깔린 표의 RLS 를 통째로 지나친다. 표만 잠그고 뷰를 안 잠그면 헛일이다.
--   (hd-project03 에서 실제로 남의 업체 실사 결과가 뷰로 그대로 보였다.
--    tests/server.test.js 의 "업체는 보고서 뷰로도 남의 자료를 볼 수 없다" 가 잡는다)
--   security_invoker 는 PostgreSQL 15 부터. Supabase 는 15 이상이다.
create or replace view public.task_board with (security_invoker = true) as
select t.*,
       case
         when t.status = '완료' then '완료'
         when t.due_date is null then '기한없음'
         when t.due_date < current_date then '지연'
         when t.due_date <= current_date + 3 then '임박'
         else '여유'
       end as due_state,
       case when t.due_date is not null and t.status <> '완료' and t.due_date < current_date
            then current_date - t.due_date else 0 end as overdue_days
from public.task t;

create or replace view public.part_summary with (security_invoker = true) as
select coalesce(part, '(미지정)') as part,
       count(*)                                     as total,
       count(*) filter (where status = '완료')       as done,
       count(*) filter (where due_state = '지연')    as overdue,
       round(avg(progress), 1)                      as avg_progress
from public.task_board
group by coalesce(part, '(미지정)');

-- 회의는 했는데 할 일이 안 끝난 것 — 회의록이 실행으로 이어지는지 본다
create or replace view public.open_actions with (security_invoker = true) as
select a.id, m.title as meeting_title, m.held_at, a.content, a.owner_name, a.due_date,
       case when a.due_date is not null and a.due_date < current_date
            then current_date - a.due_date else 0 end as overdue_days
from public.action_item a
join public.meeting m on m.id = a.meeting_id
where not a.done;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

alter table public.member      enable row level security;
alter table public.task        enable row level security;
alter table public.meeting     enable row level security;
alter table public.action_item enable row level security;
alter table public.log         enable row level security;
alter table public.admin       enable row level security;

-- 업무·회의록은 팀원이 읽고 쓰되, 고치고 지우는 것은 작성자(담당자)와 파트장만.
-- 남의 업무를 아무나 고치면 "공유"가 아니라 혼선이 된다.
drop policy if exists task_read   on public.task;
drop policy if exists task_write  on public.task;
drop policy if exists task_update on public.task;
drop policy if exists task_delete on public.task;
create policy task_read   on public.task for select to authenticated using (public.is_member());
create policy task_write  on public.task for insert to authenticated with check (public.is_member());
create policy task_update on public.task for update to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());
create policy task_delete on public.task for delete to authenticated
  using (public.is_admin() or owner_id = auth.uid());

drop policy if exists meeting_read   on public.meeting;
drop policy if exists meeting_write  on public.meeting;
drop policy if exists meeting_update on public.meeting;
drop policy if exists meeting_delete on public.meeting;
create policy meeting_read   on public.meeting for select to authenticated using (public.is_member());
create policy meeting_write  on public.meeting for insert to authenticated with check (public.is_member());
create policy meeting_update on public.meeting for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy meeting_delete on public.meeting for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists action_item_read   on public.action_item;
drop policy if exists action_item_write  on public.action_item;
drop policy if exists action_item_update on public.action_item;
drop policy if exists action_item_delete on public.action_item;
create policy action_item_read   on public.action_item for select to authenticated using (public.is_member());
create policy action_item_write  on public.action_item for insert to authenticated with check (public.is_member());
create policy action_item_update on public.action_item for update to authenticated using (public.is_member()) with check (public.is_member());
create policy action_item_delete on public.action_item for delete to authenticated using (public.is_admin());

drop policy if exists member_read   on public.member;
drop policy if exists member_write  on public.member;
drop policy if exists member_update on public.member;
create policy member_read   on public.member for select to authenticated using (public.is_member());
create policy member_write  on public.member for insert to authenticated with check (public.is_admin());
create policy member_update on public.member for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists log_read  on public.log;
drop policy if exists log_write on public.log;
create policy log_read  on public.log for select to authenticated using (public.is_member());
create policy log_write on public.log for insert to authenticated with check (true);

drop policy if exists admin_read on public.admin;
create policy admin_read on public.admin for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. 함수 실행 권한 (§3.7)
-- ----------------------------------------------------------------------------

revoke all on function public.is_admin()    from public, anon;
revoke all on function public.is_member()   from public, anon;
revoke all on function public.sync_task()   from public, anon;
revoke all on function public.sync_action() from public, anon;

grant execute on function public.is_admin()    to authenticated;
grant execute on function public.is_member()   to authenticated;
grant execute on function public.sync_task()   to authenticated;
grant execute on function public.sync_action() to authenticated;

-- ----------------------------------------------------------------------------
-- 끝. 팀원 등록:
--   insert into public.member (user_id, name, email, role)
--   select id, '<이름>', email, '파트장' from auth.users where email = '<이메일>'
--   on conflict (user_id) do nothing;
-- ----------------------------------------------------------------------------

-- ===============================================================
-- 팀 공용 문서 (hd-docsync.js 용)
--
--   이 표 하나에 앱의 JSON 문서를 통째로 담아 팀원이 같은 것을 본다.
--   팀 내부 도구 — 어차피 서로 다 보는 화면 — 에만 쓴다.
--   사람마다 볼 범위가 달라야 하는 화면에는 쓸 수 없다(모두가 전부를 받게 된다).
-- ===============================================================

create table if not exists workspace (
  id         text primary key,
  doc        jsonb not null default '{}'::jsonb,
  -- 동시 편집으로 남의 작업이 조용히 사라지지 않게 하는 장치.
  -- 저장할 때 "내가 받아 온 버전"과 같은지 확인하고, 다르면 쓰지 않는다.
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table workspace enable row level security;

drop policy if exists workspace_read   on workspace;
drop policy if exists workspace_write  on workspace;
drop policy if exists workspace_update on workspace;
drop policy if exists workspace_delete on workspace;

-- 팀 내부 도구라 로그인한 사람은 읽고 쓴다.
-- 더 좁히려면 아래 정책의 using/with check 를 조직 규칙에 맞게 바꾸면 된다.
create policy workspace_read   on workspace for select to authenticated using (true);
create policy workspace_write  on workspace for insert to authenticated with check (true);
create policy workspace_update on workspace for update to authenticated using (true) with check (true);
-- DELETE 정책은 두지 않는다. 팀 자료를 화면에서 통째로 지울 수 있으면 안 된다.
