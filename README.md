# Hunter English

**[Открыть приложение](https://sahacky.github.io/hunter-english/)** (GitHub Pages, PWA — работает офлайн, прогресс хранится в браузере).

Веб-приложение для изучения английского с нуля (A0) до продвинутого (C1) для
русскоязычного пользователя. Цель — путешествия: понимать людей на слух и отвечать.
Методика: короткое правило → построение фраз RU→EN → диктант → shadowing →
интервальные повторения (FSRS). Мотивация в стиле Solo Leveling: ты — «Охотник»,
ранги E→S, «Врата», XP и стрики. Озвучка — британский английский (Kokoro `bf_emma`, мягкий женский).

## Стек

Vite + React + TypeScript · Dexie (IndexedDB, офлайн-first) · ts-fsrs ·
react-i18next (ru/en) · Vitest + Playwright · GitHub Actions.
Supabase — синхронизация M13 (см. «Синхронизация» ниже). Подробности: `AGENTS.md` (единая точка
входа для людей и агентов), roadmap — `PLANS.md`, текущее состояние — `WAL.md`.

## Структура

| Каталог | Что это | Править руками? |
|---|---|---|
| `research/` | ресёрч, методика, лицензии; `research/tools/` — скрипты пайплайна данных | да (источник правды) |
| `specs/` | спецификации (курс, уроки, SRS, геймификация, форматы данных, экраны, дизайн) | да, через план |
| `data/` | учебные данные (CC BY-SA 4.0), генерируются пайплайном | `data/raw/` — нет (gitignored), остальное перегенерируется |
| `audio/` | озвучка курса (Kokoro en_GB `bf_emma`, Opus) | генерируется `research/tools/audio/gen_audio_kokoro.py` |
| `src/` | код приложения | да |
| `scripts/` | служебные скрипты (`validate-data.mjs`) | да |

## Сборка данных с нуля

Нужны: Node 22, Python 3.10+, ffmpeg в PATH, `pip3 install --user piper-tts kokoro-onnx soundfile`.
Сырьё (`data/raw/`, в git не попадает): NGSL CSV, kaikki-дампы, Tatoeba-экспорты.
Порядок (каждый шаг возобновляемый):

```bash
# 1. Целевой список слов (union NGSL+Spoken)
python3 research/tools/data/build_target_words.py --full
# 2. Скачка переводов Wiktionary (kaikki.org, ~1.2 c/слово)
python3 research/tools/data/fetch_kaikki.py
# 3. Экспорты Tatoeba -> /tmp/opencode/tatoeba/ (sentences_detailed.tar.bz2, links.tar.bz2)
#    https://downloads.tatoeba.org/exports/ ; затем индекс примеров:
python3 research/tools/data/build_examples.py
# 4. Слова: data/words/*.json (переводы, CEFR, теги, примеры)
python3 research/tools/data/build_words.py
# 5. Аудио: Kokoro en_GB bf_emma (модель -> data/raw/models/kokoro/; ранее Piper cori)
python3 research/tools/audio/gen_audio.py --words 'data/words/*.json'
# 6. Цитаты и ловушки
python3 research/tools/quotes/build_quotes.py
python3 research/tools/data/build_traps.py
# 7. Манифест и валидация
python3 research/tools/data/build_manifest.py
npm run validate:data
```

Схема данных и контракты — `specs/05-data-formats.md`; источники и лицензии —
`CREDITS.md`; статус данных — `data/README.md`.

## Разработка

```bash
npm ci
npm run dev          # дев-сервер
npm test             # vitest
npm run test:e2e     # playwright (нужен npx playwright install chromium)
npm run lint && npm run typecheck
npm run validate:data
```

## Лицензии

Код — MIT (`LICENSE`). Учебные данные `data/` — CC BY-SA 4.0 (наследуется от
NGSL/Wiktionary/kaikki); цитаты — короткие выдержки с указанием источника
(право цитирования). Полный список — `CREDITS.md`.


## Синхронизация (Supabase, M13)

Гостевой режим — основной: без ключей приложение полностью работает офлайн
(Dexie). Синхронизация включается переменными `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

Настройка проекта (однократно, владелец):

1. Создать проект на supabase.com (free tier).
2. SQL Editor → вставить `supabase/migrations/0001_init.sql` → Run
   (схема + RLS из specs/06).
3. Authentication → Providers → Email: включить, **снять** «Allow new users
   to sign up» (регистрация только по приглашениям).
4. Authentication → URL Configuration → Redirect URLs: добавить
   `https://<user>.github.io/hunter-english/` (и `http://localhost:5173/**`
   для дева) — иначе magic link/OAuth-редирект не вернётся в приложение.
5. Друзьям: Authentication → Users → Add user → Send invitation (magic link).
   Google-провайдер — опционально.
6. Прописать URL + anon key в `.env.local` устройств (publishable, не service!).

Первый вход: локальный прогресс автоматически переносится в аккаунт
(гость → uid, одна транзакция), затем push/pull (LWW по `updated_at`,
`review_log` append-only — specs/06 §3). Библиотека supabase-js грузится
только при настроенных ключах (гость её не качает).
