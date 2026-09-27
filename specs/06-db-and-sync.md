# Спека 06: Схема БД Supabase + синхронизация {#db-and-sync}

> Задача: plan://M1#db-and-sync. Источники: `research/02-decisions-and-research.md` §1 (Supabase, что хранить), `research/07-tech-and-data.md` §4 (стек, вход через GitHub, офлайн-first), `research/00-summary.md`. Канонические URI этой спеки: `db://<якорь>`. SQL-черновик кладётся в `supabase/migrations/0001_init.sql` в M2 — применять миграцию только после подтверждения разработчика.

## 0. Принципы {#db-principles}

- БД хранит **только прогресс и профиль**. Весь учебный контент — в `data/` репозитория (спека `data://data-formats`).
- Доступ: только **publishable (anon) key** во фронте (`VITE_SUPABASE_PUBLISHABLE_KEY`), вся защита — **Row Level Security** (`user_id = auth.uid()`). `service_role` — никогда не в браузере и не в git.
- Вход — GitHub OAuth (`supabase.auth.signInWithOAuth({ provider: 'github' })`).
- Офлайн-first: любая операция **сначала пишется в Dexie (IndexedDB)**, сервер — отложенно, через очередь. Пропал интернет — занятие не прерывается.
- `review_log` — **append-only** (нет UPDATE/DELETE): не конфликтует, служит журналом для статистики и будущей подстройки параметров FSRS.

---

## 1. Таблицы {#db-tables}

### profiles {#db://table-profiles}

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | **= `auth.users.id`** |
| `display_name` | text | имя из GitHub (raw_user_meta_data → user_name), можно менять |
| `locale` | text | `ru` \| `en`, дефолт `ru` |
| `created_at` | timestamptz | момент регистрации |
| `updated_at` | timestamptz not null default now() | клиентское, для LWW |

Настройки (голос, скорость речи, 2/4 кнопки, лимит новых) — на старте тоже здесь см. «Открытые вопросы»; при росте вынести в отдельную таблицу/`user_stats.gates_history`-подобный jsonb.

### card_states {#db://table-card_states}

Текущее FSRS-состояние карточки (поля 1:1 с `ts-fsrs` `Card`; алгоритм и параметры — спека SRS, plan://M1#srs). PK составной: `(user_id, card_id)`.

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid | FK → auth.users |
| `card_id` | text | по конвенции `<entity_id>.<тип карточки>`, напр. `ph-e-0042.ru-en` |
| `note_id` | text | id заметки-источника (до 4 карточек на заметку, srs://rule-1) |
| `type` | text not null | `en-ru` \| `ru-en` \| `dictation` \| `cloze` \| `speak` \| `grammar` (srs://card-types) |
| `deck` | text | колода: слова / фразы / цитаты / разговорник |
| `due` | timestamptz | когда показывать снова |
| `stability` | real | FSRS stability |
| `difficulty` | real | FSRS difficulty |
| `elapsed_days` | int | с последнего повторения |
| `scheduled_days` | int | назначенный интервал |
| `reps` | int | число повторений |
| `lapses` | int | число провалов |
| `state` | smallint | 0 New / 1 Learning / 2 Review / 3 Relearning (enum `State` ts-fsrs) |
| `last_review` | timestamptz | время последнего повторения |
| `suspended` | boolean default false | выключена вручную (srs://case-suspend) |
| `cloze_index` | int null | номер пропуска, только для `cloze` |
| `created_at` | timestamptz default now() | момент создания карточки |
| `updated_at` | timestamptz | **ставит клиент** — используется для LWW (см. §3) |

### review_log {#db://table-review_log} — append-only

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | **генерирует клиент** (`crypto.randomUUID()`) — уникален даже офлайн, защита от дублей при повторной отправке |
| `user_id` | uuid | FK → auth.users |
| `card_id` | text | как в card_states |
| `rating` | smallint | 1 Again / 2 Hard / 3 Good / 4 Easy (enum `Rating` ts-fsrs; для режима 2 кнопок — 1/3) |
| `state` | smallint | состояние карточки **до** ответа (0–3) |
| `state_after` | smallint | состояние карточки **после** ответа (0–3) |
| `elapsed_days` | int | |
| `scheduled_days` | int | |
| `duration_ms` | int | длительность ответа (от показа до оценки) |
| `client` | text | `web` (далее — мобильный клиент, если появится) |
| `session_id` | uuid null | id сессии повторения (группировка ответов) |
| `reviewed_at` | timestamptz | момент ответа (клиентское время офлайн-ответа) |

### lesson_progress {#db://table-lesson_progress}

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid | FK → auth.users |
| `lesson_id` | text | `les-e-01` (id из `data://schema-lesson`) |
| `status` | text | `in_progress` \| `completed` \| `review_due` (урок пройден, запланирован к повторению) |
| `score` | smallint | 0–100, результат контрольной/итога урока |
| `checkpoint` | jsonb not null default '{}' | чекпоинт урока (позиция/состояние, чтобы продолжить с места остановки) |
| `completed_at` | timestamptz | когда завершён |
| `updated_at` | timestamptz | клиентское, для LWW |

### user_stats {#db://table-user_stats}

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid PK | FK → auth.users |
| `xp` | int | суммарный XP (только за реальную работу — research/02 §3) |
| `streak_current` | int | текущий стрик, дней |
| `streak_best` | int | рекорд |
| `freezes_left` | int | заморозки стрика |
| `rank` | text | `E` \| `D` \| `C` \| `B` \| `A` \| `S`; меняется только через «Врата» |
| `gates_history` | jsonb | `[ { "gate": "D", "passed_at": "...", "score": 87 } ]` — история экзаменов |
| `updated_at` | timestamptz | клиентское, для LWW |

### item_progress {#db://table-item_progress}

Прогресс по отдельным сущностям контента: `quote_progress` (цитаты), `gate_attempts` (попытки «Врат»), `achievement` (достижения). Позволяет добавлять новые виды прогресса без миграций — payload в `data` зависит от `kind`.

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid | FK → auth.users |
| `item_id` | text | id сущности контента (цитата, «Врата», достижение) |
| `kind` | text | `quote_progress` \| `gate_attempts` \| `achievement` |
| `data` | jsonb not null default '{}' | payload записи |
| `updated_at` | timestamptz not null default now() | клиентское, для LWW |

PK: `(user_id, item_id, kind)`.

---

## 2. SQL-черновик: CREATE TABLE + RLS + индексы {#db://sql-draft}

```sql
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
  kind       text not null,                      -- 'quote_progress' | 'gate_attempts' | 'achievement'
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
```

Примечания к SQL:
- `updated_at` **не имеет серверного триггера**: значение ставит клиент (время локального изменения, важно для офлайна и LWW). Серверная перезапись сломала бы last-write-wins для записей, сделанных офлайн.
- `review_log.id` без `default gen_random_uuid()`: uuid обязан прийти с клиента (иначе повторная отправка офлайн-записи создаст дубль).
- Для anon-роли без аутентификации все таблицы невидимы (RLS): ни один `select` без JWT не вернёт строк.

---

## 3. Протокол синхронизации (офлайн-first) {#db://sync}

```
ответ на карточку / завершение урока
        │  (всегда, мгновенно)
        ▼
   Dexie: обновить mirrors (profiles, card_states, review_log, lesson_progress, user_stats, item_progress)
        + положить операцию в sync_queue
        │
        ├── есть сеть → debounce ~5 c → flush()
        └── нет сети → ждёт; flush() по событию online / таймеру / кнопке
                          │
                          ▼
   Supabase:  review_log → insert (uuid клиента, дубли отбрасываются по PK)
              card_states, lesson_progress, user_stats, item_progress → upsert
              profiles → upsert (редко)
```

### Порядок инициализации (старт приложения) {#db://sync-init}

1. Открыть Dexie (локально, без сети) — UI готов офлайн.
2. `supabase.auth.getSession()`; если сессии нет — работа в офлайн-режиме, предложение войти.
3. `flush()` очереди (push локальных изменений).
4. **Pull**: `select` своих строк `card_states / lesson_progress / user_stats / profiles / item_progress` с `updated_at > last_sync_at` (из `meta`), `review_log` — по курсору `max(reviewed_at)`.
5. **Merge**: LWW по `updated_at` (см. ниже) → записать победителей в Dexie.
6. `meta.last_sync_at = now()`; далее — pull при каждом входе, push — по событиям.

Первый вход на новом устройстве: pull приносит полную копию → Dexie; пока идёт pull, UI показывает «синхронизация», но повторение офлайн-кэша доступно сразу.

### Конфликты {#db://sync-conflicts}

| Таблица | Правило |
|---|---|
| `card_states`, `lesson_progress`, `user_stats`, `item_progress`, `profiles` | **last-write-wins** по `updated_at` (сравнение при merge, победитель пишется в обе стороны) |
| `review_log` | конфликтов нет: append-only, id — uuid клиента; повтор из очереди — no-op по PK |

Ограничение LWW: `user_stats` — агрегат; два устройства, писавшие офлайн, дадут потерю XP одного из них (XP пересчитывается локально из review_log при merge — это устраняет потерю; см. «Открытые вопросы» п.2).

### Таблицы Dexie (зеркало + служебные) {#db://sync-dexie}

```ts
db.version(1).stores({
  profiles:       'id',                          // PK id (= auth.users.id), не user_id
  card_states:    '[user_id+card_id], user_id, note_id, due, type, deck, updated_at',
  review_log:     'id, user_id, card_id, reviewed_at',   // + state_after, duration_ms, client, session_id
  lesson_progress:'[user_id+lesson_id], user_id, status, updated_at',   // + checkpoint
  item_progress:  '[user_id+item_id+kind], user_id, updated_at',
  user_stats:     'user_id',
  disputes:       '++id, card_id, created_at',   // локальный store «Я был прав», без синка
  sync_queue:     '++seq, table, created_at',   // {seq, table, op: 'upsert'|'insert', payload, tries}
  meta:           'key'                          // { key: 'last_sync_at'|'cursor_review_log', value }
});
```

Схема Dexie — структурное зеркало таблиц Postgres (те же имена/поля). `sync_queue` хранит операции, а не снапшот: после успешного flush запись удаляется; при падении — retry с экспоненциальной задержкой (макс. 5 попыток, потом элемент помечается `failed` и показывается в UI). `disputes` — локальный store кнопки «Я был прав» (спор по оценке ответа): только на устройстве, в синхронизацию и экспорт не входит.

### Поведение офлайн/онлайн {#db://sync-modes}

- **Офлайн:** всё работает — повторения, уроки, XP; в UI индикатор «офлайн, прогресс сохранён локально».
- **Сеть вернулась** (`window online`): автоматически `flush()` → `pull()`, тихо, без блокировки UI.
- **Фоновый цикл:** push с debounce после каждой операции; pull — при входе и раз в ~5 мин активной сессии (второго устройства может не быть — это почти всегда no-op).
- **Кнопка «Синхронизировать»** (в настройках/профиле): принудительно `flush()` + `pull()` + показать отчёт (N отправлено, M получено, K ошибок, время). Нужна и как «поставить галочку», что всё улетело, и для отладки.

### Экспорт/импорт JSON (fallback) {#db://sync-export}

Страховка от смерти Supabase-проекта/засыпания (Known Issue: free-проект засыпает через 7 дней) и для ручного переноса:

```json
{
  "schema_version": 1,
  "kind": "user-backup",
  "exported_at": "2026-12-01T18:00:00Z",
  "tables": {
    "profiles": [ "..." ],
    "card_states": [ "..." ],
    "review_log": [ "..." ],
    "lesson_progress": [ "..." ],
    "user_stats": [ "..." ],
    "item_progress": [ "..." ]
  }
}
```

- Экспорт: дамп всех 6 таблиц пользователя из Dexie в файл (`hunter-backup-YYYYMMDD.json`).
- Импорт: построчная merge по тем же правилам LWW / PK — идемпотентно, повторный импорт ничего не портит.

---

## 4. Безопасность {#db://security}

- Во фронте только `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (публичные по дизайну). **`service_role` — никогда во фронт, в git, в логи**; если когда-нибудь понадобится (Edge Functions) — только секретом окружения на сервере.
- RLS включена на **всех** таблицах, политики только `user_id = auth.uid()` (или `id = auth.uid()` для profiles); таблицы без политики = недоступны. Перед деплоем — тест: анонимный запрос к каждой таблице обязан вернуть 0 строк.
- **Нельзя хранить в БД/Dexie:** пароли и токены (сессию управляет supabase-js, в Dexie не дублируем); `service_role`; данные карточки банков и пр. PII — максимум `display_name` и локаль; учебный контент (он в `data/`); Oxford-списки; аудио/видео из тайтлов.
- `data/raw/` и `.env.local` — в `.gitignore` (M2), секреты не коммитятся (правило AGENTS.md).

---

## Открытые вопросы {#db-open-questions}

1. `updated_at`: клиентские часы vs серверные (риск расхождения часов устройства → некорректный LWW). Вариант: при flush сверяться с `server time` и сдвигать; или серверный триггер + отдельное `client_updated_at`.
2. `user_stats`: хранить агрегат с LWW (так в спеке) или пересчитывать на сервере из `review_log`/`lesson_progress` (Edge Function, надёжнее, но сложнее). Решить к M8.
3. Настройки пользователя (голос, скорость, 2/4 кнопки, лимит новых): колонки в `profiles` vs jsonb vs отдельная таблица — когда дойдёт до экрана настроек.
4. Нужен ли Realtime Supabase (мгновенная синхронизация двух устройств) — кажется избыточным для одного пользователя, по умолчанию нет.
5. Политика retention `review_log` (лог ответов растёт годами): не чистить (объём копеечный) vs агрегировать по месяцам после года — решить при первых признаках роста.
6. Бэкап Supabase (free-план не бэкапит): достаточно ли экспорт-кнопки из §3 или добавить еженедельный автоматический экспорт.
