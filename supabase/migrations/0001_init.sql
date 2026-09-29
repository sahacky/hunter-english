-- Hunter English — схема Supabase (specs/06 §1–2), plan://M13#13.1
-- Применять: Supabase Dashboard → SQL Editor → Run (или supabase db push).
-- ВАЖНО (спека): updated_at ставит КЛИЕНТ (LWW) — серверных триггеров нет;
-- review_log.id без default — uuid приходит с клиента (дедуп по PK).
-- Регистрация закрыта в Auth-настройках дашборда; приглашения — Send invitation.

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale       text not null default 'ru' check (locale in ('ru', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============ card_states ============
create table public.card_states (
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        text not null,   -- '<entity_id>.<тип карточки>', напр. 'ph-e-0042.ru-en'
  note_id        text,
  type           text not null,
  deck           text,
  due            timestamptz not null default now(),
  stability      real not null default 0,
  difficulty     real not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  state          smallint not null default 0 check (state between 0 and 3),
  last_review    timestamptz,
  suspended      boolean not null default false,
  cloze_index    integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.card_states enable row level security;
create policy "card_states_select_own" on public.card_states
  for select to authenticated
  using (user_id = auth.uid());
create policy "card_states_insert_own" on public.card_states
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "card_states_update_own" on public.card_states
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- индекс выборки «карточки на сегодня»
create index card_states_user_due_idx on public.card_states (user_id, due);

-- ============ review_log (append-only) ============
create table public.review_log (
  id             uuid primary key,               -- uuid генерирует клиент
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        text not null,
  rating         smallint not null check (rating between 1 and 4),
  state          smallint not null check (state between 0 and 3),      -- до ответа
  state_after    smallint not null check (state_after between 0 and 3),-- после ответа
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  duration_ms    integer,
  client         text,
  session_id     uuid,
  reviewed_at    timestamptz not null
);
alter table public.review_log enable row level security;
create policy "review_log_select_own" on public.review_log
  for select to authenticated
  using (user_id = auth.uid());
create policy "review_log_insert_own" on public.review_log
  for insert to authenticated
  with check (user_id = auth.uid());
-- НЕТ политик update/delete → append-only на уровне БД
create index review_log_user_reviewed_idx on public.review_log (user_id, reviewed_at desc);

-- ============ lesson_progress ============
create table public.lesson_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  lesson_id    text not null,
  status       text not null default 'in_progress' check (status in ('in_progress', 'completed', 'review_due')),
  score        smallint check (score between 0 and 100),
  checkpoint   jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy "lesson_progress_select_own" on public.lesson_progress
  for select to authenticated
  using (user_id = auth.uid());
create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "lesson_progress_update_own" on public.lesson_progress
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index lesson_progress_user_status_idx on public.lesson_progress (user_id, status);

-- ============ user_stats ============
create table public.user_stats (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  xp             integer not null default 0,
  streak_current integer not null default 0,
  streak_best    integer not null default 0,
  freezes_left   integer not null default 0,
  rank           text not null default 'E' check (rank in ('E', 'D', 'C', 'B', 'A', 'S')),
  gates_history  jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);
alter table public.user_stats enable row level security;
create policy "user_stats_select_own" on public.user_stats
  for select to authenticated
  using (user_id = auth.uid());
create policy "user_stats_insert_own" on public.user_stats
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "user_stats_update_own" on public.user_stats
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ item_progress ============
create table public.item_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null,
  kind       text not null,                      -- 'quote_progress' | 'gate_attempts' | 'achievement' | 'quest_day'
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id, kind)
);
alter table public.item_progress enable row level security;
create policy "item_progress_select_own" on public.item_progress
  for select to authenticated
  using (user_id = auth.uid());
create policy "item_progress_insert_own" on public.item_progress
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "item_progress_update_own" on public.item_progress
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index item_progress_user_kind_idx on public.item_progress (user_id, kind);

-- ============ автосоздание профиля и статистики при регистрации ============
-- (после создания всех таблиц, в которые пишет функция)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'user_name', 'Hunter'));
  insert into public.user_stats (user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
