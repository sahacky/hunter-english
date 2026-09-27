# Ресёрч, часть 4: данные (переводы, лицензии) и технический стек

Дата: 2026-09-27. Продолжение [03-methods-and-exercises.md](03-methods-and-exercises.md).

---

## 1. Русские переводы для 5000 слов

В частотных списках (NGSL, FrequencyWords) только английские слова. Переводы нужно взять из открытого источника.

| Источник | Что есть | Лицензия | Вердикт |
|---|---|---|---|
| **Wiktionary через kaikki.org (wiktextract)** | для каждого английского слова части речи, значения и **переводы на русский, сгруппированные по значениям** | CC BY-SA | ✅ **основной** |
| OpenRussian.org | RU→EN словарь с формами | CC BY-SA | ⚠️ направление RU→EN, для нас вспомогательный |
| Tatoeba | предложения EN↔RU | CC BY 2.0 FR | ✅ примеры |
| HF «English-Russian-Dictionary» | пары слов | Apache 2.0, но доступ по условиям, источник мутный | ❌ |

**Проверено вживую** (API kaikki: `https://kaikki.org/dictionary/English/meaning/<a>/<ab>/<word>.jsonl`):
- `house` (сущ.): дом, палата, династия
- `get` (гл.): 23 перевода: доставать, получать, становиться, приносить…
- `take` (гл.): 43 перевода: брать, взять, принимать…; (сущ.) взятие, дубль
- `way` (сущ.): путь, дорога, способ, метод

В переводах стоят ударения (`пала́та`), их убираем нормализацией Unicode (или оставляем, это даже полезно).

**Пайплайн:**
1. Список слов собираем из NGSL-Spoken → NGSL → FrequencyWords, с дедупликацией, до ~5000.
2. Для каждого слова тянем kaikki JSON (по одному, это ~5000 маленьких запросов, или один раз фильтруем полный дамп).
3. Автоотбор: 1–3 главных перевода из первых значений каждой части речи.
4. **Ручная/AI-курация**: для новичка оставляем 1–2 перевода, которые подходят к фразе-примеру. Для топ-1000 проверяем всё вручную.
5. Пример к слову берём из Tatoeba (EN+RU), цитат или уроков.
6. Указываем атрибуцию в `CREDITS.md`, а данные словаря публикуем под CC BY-SA (требование ShareAlike).

---

## 2. Лицензии: сводка для публичного репозитория

| Данные | Лицензия | Требования |
|---|---|---|
| NGSL 1.2 / NGSL-Spoken 1.2 (Browne & Culligan) | **CC BY-SA 4.0** | атрибуция; производные списки под той же лицензией |
| FrequencyWords (hermitdave) | MIT | копирайт-нотис |
| Wiktionary / kaikki | CC BY-SA | атрибуция, ShareAlike |
| Tatoeba | CC BY 2.0 FR | атрибуция (ссылка на Tatoeba + авторы) |
| Piper `cori` | датасет public domain (LibriVox) | нет |
| Piper `alba` | CC BY 4.0 | атрибуция |
| Цитаты из сериалов/аниме/игр | © правообладатели | только короткие, с источником (fair use / право цитирования) |
| Oxford 3000/5000 | © OUP | **не публикуем** |

**Решение по репозиторию:** код под MIT, папка `data/` (слова, переводы) под CC BY-SA 4.0, файл `CREDITS.md` со всеми источниками.

---

## 3.1. Прямые ссылки на датасеты (дополнено в M0.5, из параллельного ресёрча)

| Что | Прямая ссылка | Примечание |
|---|---|---|
| NGSL 1.2 stats (word, SFI, дисперсия) | `https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv` | CSV с частотным рангом |
| Oxford 5000 JSON (word, POS, CEFR A1–C1, mp3) | `https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/main/full-word.json` | ⚠️ **только локально** (© OUP): для сверки уровней и списка mp3. В репо данные не класть |
| COCA top-5000 | `https://www.wordfrequency.info/samples/wordFrequency.xlsx` | письменная частота, доп. сверка к NGSL + OpenSubtitles; условие — указание источника |

Сырьё складывается в `data/raw/` (в `.gitignore`, не коммитится). Статус заготовки — см. WAL.

## 4. Технический стек (предложение)

| Слой | Выбор | Почему |
|---|---|---|
| Сборка | **Vite + TypeScript** | быстро, стандарт, статическая сборка под GitHub Pages |
| UI | **React** (или Svelte) | больше готовых компонентов и примеров; Svelte легче, решим на старте |
| Роутинг | hash-роутер (`/#/lesson/12`) | GitHub Pages не умеет SPA-роутинг без хака с 404.html |
| Локальное хранилище | **IndexedDB через Dexie** | карточки, лог ответов, офлайн |
| Сервер/авторизация | **Supabase**: вход через GitHub (OAuth), Postgres + Row Level Security | см. 02-research §1 |
| SRS | **ts-fsrs** | см. 01-research §7 |
| Звук | заранее сгенерированные **Opus/MP3 (Piper en_GB)** + фолбэк `speechSynthesis` | см. 02-research §2 |
| Микрофон | `SpeechRecognition` (Chrome/Edge) → позже Whisper в браузере | см. 01-research §9 |
| PWA | `vite-plugin-pwa` | установка на телефон, офлайн, кэш аудио |
| Деплой | **GitHub Actions → GitHub Pages** | пуш в main = автодеплой |
| Скрипты данных | Python (сбор слов, переводов, цитат, генерация аудио) | запускаются локально, результат коммитится в `data/` |

### Вход через GitHub (Supabase): как устроено

1. Создаём **GitHub OAuth App** (Settings → Developer settings → OAuth Apps). Callback: `https://<project>.supabase.co/auth/v1/callback`.
2. В Supabase: Authentication → Providers → GitHub, вводим Client ID/Secret.
3. В Supabase → URL Configuration добавляем адрес сайта `https://sahacky.github.io/<repo>/` в Redirect URLs.
4. В коде вызываем `supabase.auth.signInWithOAuth({ provider: 'github' })`.
5. В браузере лежит только **publishable key**, его светить можно. Защиту данных даёт Row Level Security (`user_id = auth.uid()`).

Что понадобится от пользователя (на этапе разработки, не сейчас): зарегистрироваться на supabase.com (можно через GitHub) и создать проект.

### Синхронизация (офлайн-first)

```
ответ на карточку → запись в IndexedDB (сразу) → очередь на отправку
                                              ↓ (когда есть сеть)
                                   Supabase: upsert card_state, insert review_log
при входе на новом устройстве → скачать card_state/progress → IndexedDB
конфликты: у каждой записи updated_at, выигрывает последняя;
           review_log только добавляется (append-only), поэтому не конфликтует
```

### Структура репозитория (черновик)

```
study_eng/
  research/          ← весь ресёрч (этот файл и др.)
  data/              ← слова, переводы, уроки, цитаты (JSON, CC BY-SA)
  audio/             ← сгенерированная озвучка (или отдельный репо / release)
  scripts/           ← Python: сбор и подготовка данных, генерация аудио
  src/               ← приложение (Vite + TS)
  supabase/          ← SQL-схема, RLS-политики
  CREDITS.md
  .github/workflows/deploy.yml
```

---

## Источники (часть 4)

- kaikki.org (Wiktextract): https://kaikki.org/dictionary/rawdata.html · формат: https://github.com/tatuylonen/wiktextract
- OpenRussian dictionary data: https://en.openrussian.org/dictionary-data
- NGSL 1.2: https://www.newgeneralservicelist.com/new-general-service-list · NGSL-Spoken (CC BY-SA 4.0): https://www.newgeneralservicelist.com/ngsl-spoken
- Supabase, Sign in with GitHub: https://supabase.com/docs/guides/auth/social-login/auth-github
