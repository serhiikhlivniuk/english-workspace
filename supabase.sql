-- ===== English Workspace · схема для Supabase =====
-- Виконати один раз у Supabase → SQL Editor → New query → Run.

create table if not exists public.progress (
  student_id text not null,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (student_id, key)
);

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  student_id text not null,
  kind       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_student_created_idx on public.events (student_id, created_at desc);

alter table public.progress enable row level security;
alter table public.events   enable row level security;

-- Сайт ходить у базу анонімним ключем: дозволяємо тільки запис прогресу й читання.
-- Видалення й зміна чужих рядків лишаються забороненими.
drop policy if exists progress_rw on public.progress;
create policy progress_rw on public.progress
  for all to anon using (true) with check (true);

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to anon with check (true);

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to anon using (true);
