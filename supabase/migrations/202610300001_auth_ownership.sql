-- 하루 한 장 과제 7: 기존 다이어리 자료를 Auth 계정에 연결하고 RLS로 잠급니다.
-- 실행 전: Supabase Authentication > Users에 소유자가 될 계정이 있어야 합니다.
-- 이 파일은 auth.users에서 가장 먼저 만들어진 계정을 소유자로 사용합니다.
-- 기존 6번 자료가 있으면 그 계정으로 연결됩니다. 실제 서비스에 적용하기 전 백업하세요.

begin;

do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  order by created_at asc
  limit 1;

  if owner_id is null then
    raise exception 'Supabase Auth 계정이 없습니다. 먼저 가입한 뒤 이 마이그레이션을 실행하세요.';
  end if;

  alter table public.plans add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table public.plan_revisions add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table public.execution_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table public.reflections add column if not exists user_id uuid references auth.users(id) on delete cascade;

  update public.plans set user_id = owner_id where user_id is null;
  update public.plan_revisions r set user_id = p.user_id from public.plans p where r.plan_id = p.id and r.user_id is null;
  update public.tasks t set user_id = p.user_id from public.plans p where t.plan_id = p.id and t.user_id is null;
  update public.reflections r set user_id = p.user_id from public.plans p where r.plan_id = p.id and r.user_id is null;
  update public.execution_logs e set user_id = t.user_id from public.tasks t where e.task_id = t.id and e.user_id is null;

  if exists (select 1 from public.plans where user_id is null)
     or exists (select 1 from public.plan_revisions where user_id is null)
     or exists (select 1 from public.tasks where user_id is null)
     or exists (select 1 from public.execution_logs where user_id is null)
     or exists (select 1 from public.reflections where user_id is null) then
    raise exception '소유자를 연결하지 못한 행이 있습니다. 외래 키 관계를 확인하세요.';
  end if;
end $$;

alter table public.plans alter column user_id set not null;
alter table public.plan_revisions alter column user_id set not null;
alter table public.tasks alter column user_id set not null;
alter table public.execution_logs alter column user_id set not null;
alter table public.reflections alter column user_id set not null;

-- 기존 정책을 정리합니다. 이전 6번 쿼리의 익명 전체 접근 정책도 여기서 제거됩니다.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['plans','plan_revisions','tasks','execution_logs','reflections'] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create policy "owner manages plans" on public.plans
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "owner manages plan revisions" on public.plan_revisions
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);

create policy "owner manages tasks" on public.tasks
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);

create policy "owner manages execution logs" on public.execution_logs
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
);

create policy "owner manages reflections" on public.reflections
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);

-- security_invoker 뷰는 호출자의 RLS 정책을 따릅니다.
revoke all on public.plan_review_summary from anon;
grant select on public.plan_review_summary to authenticated;

commit;
