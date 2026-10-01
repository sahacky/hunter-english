# Спека 09 — Тест-план проекта {#test-plan}

> Версия 1.1 (M17#17.2–17.3, 2026-09-30). Источники: specs/01–08 (функциональные контракты), WAL (Known Issues, Watch out), постмортем флейка a45b3a5, ревью тест-плана суб-агентом (все блокеры/мажоры внесены).
> Живой документ: обновляется при добавлении модулей/экранов и на каждом ретроспективном анализе падений CI.
>
> **Легенда указателей на историю:** «постмортем M<N> Б<к>» = блокер №<к> ревью майлстоуна M<N> (см. WAL Changelog); «a45b3a5» — SHA коммита с единичным падением CI.

## 1. Цели и рамки

**Цель:** достоверная карта покрытия и гарантии корректности доменной логики, экранов, данных и инфраструктуры перед каждым merge в `main` и перед публикацией релиза.

**В рамках:** приложение Hunter English (SPA, офлайн-first), датасет `data/`, аудио-манифест, PWA, Supabase-синк (за env-гейтом), CI-конвейер.

**Вне рамок:** нагрузочное тестирование серверов (нет своего бэкенда), длительность аудио как таковая (гейт живёт в генераторе Piper, см. §4.10), нереализованные экраны/режимы (`/#/dictionary`, VLT-режим specs/03 §8, онбординг «День 1» specs/07 §2.1 — добавляются в план по мере реализации), юзабилити-исследования.

## 2. Уровни тестирования {#levels}

| Уровень | Инструмент | Что проверяет | Бюджет времени |
|---|---|---|---|
| L1 Unit (домены) | Vitest, чистый TS | `src/domain/**`, `src/lib/**` — вся бизнес-логика без DOM/IO | < 10 с |
| L2 Unit (данные/контент) | Vitest + fake-indexeddb | `src/data/**`, `src/content/**` — репозиторий, лоадеры, синк | < 20 с |
| L3 Интеграция (экраны) | Vitest + RTL + jsdom | `src/screens/**`, Layout, ToastHost — рендер + взаимодействия + i18n | < 40 с |
| L4 E2E | Playwright + chromium, preview собранного dist | сквозные пользовательские сценарии по реальным данным | локально < 3 мин (CI не запускает — нет браузера, Known Issue WAL) |
| L5 Контракт данных | `npm run validate:data` (ajv + кросс-ссылки + манифест + аудио-файлы) | `data/**` против схем draft-07 | < 30 с |
| L6 Статический анализ | ESLint + Prettier + tsc --noEmit, `npm audit --audit-level=high` | стиль, типы, известные уязвимости | < 60 с |
| L7 Сборка/доставка | `npm run build` (+ шаги CI), проверка чанков | собираемость, копирование аудио в dist, SW/манифест PWA | < 120 с |

**Правило пирамиды:** новую логику в первую очередь закрываем на L1–L2; L3 — на критичных интерактивных сценариях экрана; L4 — один сценарий на крупную фичу (smoke-принцип, принято M9). E2e не размножаем — они медленные и первыми страдают от цейтнота раннера.

**Методология подсчёта** (чтобы числа совпадали с CI): количество unit-кейсов = вывод Vitest «Tests N passed»; файлы = «Test Files N». Числа в §3 — снимок на M17; при каждом обновлении плана сверять с актуальным прогоном.

## 3. Трассировка покрытие ↔ модули (снимок M17: 249 тестов, 24 unit-файла, 47 e2e) {#traceability}

| Модуль | Спека | Тест-файлы |
|---|---|---|
| Проверка ответов | specs/02 §4 | checker.test (34), normalize.test (14) |
| SRS-планировщик | specs/03 | scheduler.test (19), scheduler.preview.test (4) |
| Урок | specs/02 §2, §5; specs/04 §4.1 | lesson.test (29) |
| Геймификация | specs/04 | game.test (17), award.test (7) |
| Настройки | specs/07 §2.1 | settings/types.test (6), data/settings.test (3), state/settings.test (3) |
| Репозиторий Dexie | specs/06 §3 | progress-repository.test (10) |
| Supabase-синк | specs/06 §3 | sync.test (11) |
| TTS-шлюз | research/02 §2 | tts.test (8) |
| Контент-лоадеры | specs/05 | words.test (4), lessons.test (13) |
| Экраны | specs/07 | SrsScreen (12), LessonScreen (7), QuotesScreen (11), SettingsScreen (7), RanksGates (4), Layout (6), ToastHost (3), App (2), TransformExercise (4) |
| E2E | specs/07 | smoke (5), pwa (5), auth (3), quotes (3), settings (4), rank-a/b/c/d (7+7+7+6) |
| Данные | specs/05 §9 | validate:data (L5, не Vitest) |

**Принцип честности:** колонка «Покрытие» в §4 указывает файл, где кейс действительно закрыт; «частично» — закрыта часть поведения; **GAP-xx** — пробел, вынесен в §8.

## 4. Тест-кейсы по модулям {#cases}

Обозначения: **П** — позитивный, **Н** — негативный, **Г** — граничный.

### 4.1 Домен проверки ответов (TC-CHK) — specs/02 §4

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-CHK-01 | Точное совпадение EN-ответа с эталоном | П | ✔ checker.test |
| TC-CHK-02 | Регистр/пунктуация/двойные пробелы не влияют (нормализация) | П | ✔ normalize.test |
| TC-CHK-03 | Сокращения эквивалентны: can't = cannot = can not | П | ✔ checker.test |
| TC-CHK-04 | I'm ↔ I am — двойное сравнение расширенной формы | П | ✔ checker.test |
| TC-CHK-05 | Опечатка в пределах typoLimit → верно с опечаткой (полный XP) | Г | ✔ checker.test |
| TC-CHK-06 | Опечатка за пределом → неверно | Г | ✔ checker.test |
| TC-CHK-07 | typo=exact (cloze/verb_tense): одна опечатка = ошибка (exactTypos) | Г | ✔ checker.test (M18) |
| TC-CHK-08 | Ловушки-оверрайды: ЛТ-06/17/19 строгий вердикт при «похожем» ответе | Н | ✔ checker.test |
| TC-CHK-09 | Ответ-вариант фразы (variants[]) принимается как эталон | П | ✔ checker.test |
| TC-CHK-10 | Диктант: judgeDictation, пропущенный артикль (≤2) прощается | Г | ✔ checker.test (M18) |
| TC-CHK-11 | Голос: порог 0.85/0.80, артикли исключены из обеих сторон | Г | ✔ checker.test (judgeVoice) |
| TC-CHK-12 | Голос ниже порога → «повтори» (не error) | Н | ✔ checker.test |
| TC-CHK-13 | Пустой ответ / только пробелы → неверно, без краха | Н | частично (normalize.test — косвенно; прямой кейс judge('') — GAP-9) |
| TC-CHK-14 | EXCEPTIONS-слова не считаются опечатками | Г | ✔ checker.test |
| TC-CHK-15 | Diff-выравнивание: missing/extra/typo корректно размечаются | П | ✔ checker.test |
| TC-CHK-16 | Очень длинный ввод (500+ символов) — без зависания | Г | GAP-9 (опц.) |
| TC-CHK-17 | Unicode/эмодзи в ответе — нормализация не падает | Н | GAP-9 (опц.) |

### 4.2 SRS-планировщик (TC-SRS) — specs/03

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-SRS-01 | applyAnswer: все Rating 1–4 → корректный state/stability | П | ✔ scheduler.test |
| TC-SRS-02 | Граница дня 04:00: ответ в 03:59 — «вчера», в 04:00 — «сегодня» | Г | ✔ scheduler.test |
| TC-SRS-03 | Лимит новых 15/день; между сессиями вычитание отвеченных (countNewAnsweredSince) | Г | ✔ scheduler.test (лимиты) + progress-repository.test (вычитание) |
| TC-SRS-04 | Flood-guard: долг ≤50→15 новых, 51–120→8, 121–200→4, >200→0 (проверено кейсами 130→4, 300→0) | Г | ✔ scheduler.test (newLimitForDebt + интеграционный) |
| TC-SRS-05 | Очередь: learning → review young→mature → new | П | ✔ scheduler.test |
| TC-SRS-06 | Relearning-карточка возвращается в очередь сессии (state 3) | П | частично: переход в Relearning — ✔ applyAnswer; возврат в очередь сессии — GAP-9 |
| TC-SRS-07 | Превью интервалов = фактический ответ (один now, fuzz-паритет; постмортем M10 Б1) | Г | ✔ scheduler.preview.test |
| TC-SRS-08 | card_id = `<entity_id>.<тип>`; правило rule-1 (en-ru первой) | П | ✔ scheduler.test + words.test |
| TC-SRS-09 | Просроченные карты (даты в прошлом/будущем) — не NaN | Г | ✔ scheduler.test |
| TC-SRS-10 | Пробуждение обратных карточек ≤5/день (wokenToday) | Г | ✔ scheduler.test |
| TC-SRS-11 | Параметры FSRS: retention 0.90, max interval 36500 | П | ✔ scheduler.test (M18) |

### 4.3 Урок (TC-LES) — specs/02 §2, §5

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-LES-01 | groupIntoSteps: тип → шаг 1–7 по шаблону | П | ✔ lesson.test |
| TC-LES-02 | Разогрев <70% → повтор шага теми же заданиями | Г | ✔ lesson.test |
| TC-LES-03 | Слушание <60% → retrySuggested | Г | ✔ lesson.test |
| TC-LES-04 | XP: 1-я попытка/50% floor/подсказка 0; disputed → полный; typo → полный | Г | ✔ lesson.test |
| TC-LES-05 | finishPass: ≥90% фраз «выучено» → completed | Г | ✔ lesson.test |
| TC-LES-06 | Статусы: locked/available/in_progress/completed/review_due (просело ≥30%) | Г | ✔ lesson.test |
| TC-LES-07 | Чекпоинт {stepIndex, passIndex, scores} переживает перезагрузку | П | ✔ LessonScreen.test + progress-repository.test |
| TC-LES-08 | Повтор урока не затирает лучший результат | Н | ✔ lesson.test |
| TC-LES-09 | Невалидный :id урока → 404-экран | Н | ✔ LessonScreen.test |
| TC-LES-10 | ?step=N deep-link: >достигнутого → guard «Продолжить/Заново»; прямой редирект (07 §4.2) | Г | частично: guard-логика ✔ LessonScreen.test; URL-редирект — GAP-8 |
| TC-LES-11 | Шаг 7 «В колоду»: createFirstCards фраз + слова | П | ✔ LessonScreen.test |
| TC-LES-12 | «Проход по ошибкам»: только wrong/disputed-negative, без XP и персиста | П | ✔ LessonScreen.test (M11) |

### 4.4 Геймификация (TC-GAME) — specs/04

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-GAME-01 | Уровни: 100+25×(n−1); границы рангов | Г | ✔ game.test |
| TC-GAME-02 | Дневные XP-капы (повторы 200/выбор 30/голос 60/диктант 60/shadowing 45) | Г | ✔ game.test |
| TC-GAME-03 | Стрик: граница 4:00, заморозка тратится, +1 за кратное 7 | Г | ✔ game.test |
| TC-GAME-04 | Квесты: 3 слота + seeded-бонус; квест-день персистируется с реальным due | П | ✔ game.test + award.test |
| TC-GAME-05 | Врата: секции ≥80%, сумма ≥85% → ранг-ап +200 XP; только своему экзамену | Г | ✔ game.test + RanksGates.test |
| TC-GAME-06 | Врата: кулдаун 72ч после провала; слияние секций пересдачи (постмортем M7) | Г | частично: кулдаун ✔; слияние секций пересдачи — GAP-9 |
| TC-GAME-07 | XP-шина: SRS +1/+2, урок по категориям, +25 первый урок дня | П | ✔ award.test + SrsScreen.test |
| TC-GAME-08 | self_reported не растит точность, но даёт полный XP | Г | ✔ lesson.test |

### 4.5 Репозиторий и синхронизация (TC-DATA) — specs/06

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-DATA-01 | saveAnswer: card_states + review_log + sync_queue одной транзакцией | П | ✔ progress-repository.test |
| TC-DATA-02 | review_log append-only: повторный id не перезаписывает | Н | ✔ progress-repository.test |
| TC-DATA-03 | UUIDv7: монотонность, версия 7 | П | ✔ progress-repository.test |
| TC-DATA-04 | flush: экспоненциальный retry ≤5 → failed | Н | ✔ sync.test |
| TC-DATA-05 | flush: дедуп батча по conflict-ключу, последний seq wins | Г | ✔ sync.test (постмортем M13) |
| TC-DATA-06 | pull: high-water курсоры; ошибка не двигает курсор | Г | ✔ sync.test (постмортем M13 Б2) |
| TC-DATA-07 | pull: review_log по reviewed_at, постранично asc | Г | ✔ sync.test |
| TC-DATA-08 | mergeLww: более поздний updated_at побеждает | П | ✔ sync.test |
| TC-DATA-09 | Перенос гостя → uid (remap + enqueueAllRows) | П | ✔ sync.test |
| TC-DATA-10 | Импорт дампа: sanitizeImport, ремап user_id, валидация полей | Н | ✔ SettingsScreen.test (постмортем M10) |
| TC-DATA-11 | Импорт битого JSON / не той версии → отказ без потери данных | Н | ✔ SettingsScreen.test |
| TC-DATA-12 | Серверный LWW-guard (suppress_stale_update, SQL-триггер) отбрасывает устаревшее | Н | клиентская часть ✔ sync.test (mergeLww); серверный триггер — GAP-6 (с активацией Supabase) |
| TC-DATA-13 | Online-триггер (events online) запускает flush/pull | П | GAP-9 |
| TC-DATA-14 | 5-минутный интервал автосинка | П | GAP-9 (опц.) |

### 4.6 Контент и данные (TC-CONT) — specs/05 §9

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-CONT-01 | Все JSON против схем draft-07 (word/phrase/exercise/lesson/quote/dialog/trap) | П | ✔ validate:data |
| TC-CONT-02 | Кросс-ссылки: phrase_id/trap_id/quote/bebris_video/phrasebook_topic существуют | Н | ✔ validate:data |
| TC-CONT-03 | Уникальность id внутри типа; манифест strict (FAIL на расхождение) | Н | ✔ validate:data (постмортем M3-ревью) |
| TC-CONT-04 | Аудио: файл по каждой ссылке существует, в манифесте | Н | ✔ validate:data |
| TC-CONT-05 | vocab_band: известный list; полосы уроков одного ранга не пересекаются | Г | ✔ validate:data (enum); непересечение — билдер (round-trip ✔ lessons.test) |
| TC-CONT-06 | Лоадеры: ленивые чанки грузятся; проверка schema_version при загрузке | Н | ✔ assertEnvelope-гварды в words/lessons/phrasebook/quotes + envelope.test (M18) |
| TC-CONT-07 | 404-поведение лоадеров при отсутствии файла (деградация, не белый экран) | Н | закрыто иначе (M18): чанки бандлятся в dist, «отсутствующего файла» в рантайме нет; рассинхрон версий ловит assertEnvelope |
| TC-CONT-08 | Целостность после регенерации билдером (round-trip): количество уроков/фраз по рангам | Г | ✔ lessons.test |

### 4.7 Экраны (TC-UI) — specs/07

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-UI-01 | /srs: фронт→Space→оборот→оценка→next; клавиши 1–4/R/S/Esc | П | ✔ SrsScreen.test (стабилизирован 17.1) |
| TC-UI-02 | /srs: блок 20 → пауза → продолжить → финал | Г | ✔ SrsScreen.test |
| TC-UI-03 | /srs: гонка двойного клика → один ответ | Н | ✔ SrsScreen.test |
| TC-UI-04 | /srs: режим 4 кнопок + превью интервалов; 2 — подпись про настройки | Г | ✔ SrsScreen.test |
| TC-UI-05 | /srs: Esc-подтверждение «прервать» ✔; beforeunload в активной сессии | Н | ✔ SrsScreen.test (M18: оба) |
| TC-UI-06 | /lesson: все типы упражнений рендерятся и проверяются | П | ✔ LessonScreen.test + e2e rank-* |
| TC-UI-07 | /lesson: «Я был прав» → dispute, точность корректируется | Н | ✔ LessonScreen.test |
| TC-UI-08 | /lesson: голос с фолбэком текстом/self_reported при недоступном микрофоне | Г | ✔ LessonScreen.test |
| TC-UI-09 | /lesson: выход-гард «прогресс сохранён» (кнопка + beforeunload) | Н | частично: кнопка ✔ e2e settings.spec; beforeunload — GAP-4 |
| TC-UI-10 | Врата: intro→exam (без фидбэка до конца секции)→result (пороги/пересдача слабых секций) | Г | ✔ RanksGates.test (M18: полный проход 65 заданий → result → пересдача) |
| TC-UI-11 | /quotes: галерея, фильтр «понятные» (card_state ≥90%), раскраска слов, поповер «в колоду» | П | ✔ QuotesScreen.test + e2e |
| TC-UI-12 | /quotes: cloze по top1000, «понял без перевода» | П | ✔ QuotesScreen.test |
| TC-UI-13 | /phrasebook: список глав ✔; сценка с ответами текстом/голосом | П | ✔ PhrasebookScreen.test (M18; найден и починен баг: финал-экран был недостижим — 404 вместо «Ситуация пройдена») |
| TC-UI-14 | /settings: тема/локаль ✔ live; SRS-кнопки ✔; экспорт-пейлоад ✔; **сброс с подтверждением** ✔ (M18: таблицы очищены, meta сохранена) | П/Н | частично: скорость/анимации live — GAP-9 |
| TC-UI-15 | Дашборд: квест-окно [N/M] ✔; таймер до 4:00; «Начать день»; цитата дня (seed) | П | частично: квест-окно/навигация ✔ App.test + e2e smoke; таймер/цитата дня/«Начать день» — GAP-9 |
| TC-UI-16 | Тосты: квест/ранг-ап/заморозка; aria-live polite | Н | ✔ ToastHost.test |
| TC-UI-17 | 404-маршрут: nav.notFound | Н | ✔ App.test |
| TC-UI-18 | Таб-бар мобилки (5 пунктов) ✔; бейдж офлайн ✔; safe-area | Г | частично: таб-бар/бейдж ✔ Layout.test + e2e pwa; safe-area — GAP-9 (визуальная) |
| TC-UI-19 | Тема: тёмная/светлая/system — токены, data-theme ✔; анти-FOUC-скрипт | Г | частично: тема ✔ state/settings.test + e2e; FOUC-скрипт — GAP-9 |
| TC-UI-20 | prefers-reduced-motion: волна/анимации отключаются | Н | GAP-8 |
| TC-UI-21 | PWA autoUpdate: перезагрузка открытых вкладок на новую версию (постмортем M9) | Г | GAP-8 |
| TC-UI-22 | Врата deep-link ?stage=exam без попытки → редирект на intro (07 §4.2) | Н | GAP-8 |

### 4.8 E2E-сквозные (TC-E2E) — по одному на крупную фичу

| ID | Сценарий | Покрытие |
|---|---|---|
| TC-E2E-01 | Smoke: дашборд → SRS-сессия → настройки; десктоп + мобильный viewport | ✔ smoke.spec |
| TC-E2E-02 | Урок ранга E целиком (шаги 1–7, финал, проход по ошибкам) | ✔ smoke.spec (M11) |
| TC-E2E-03 | Уроки каждого контент-ранга открываются (D/C/B/A по 1–2 урока, Врата чеклист) | ✔ rank-d/c/b/a.spec |
| TC-E2E-04 | PWA: manifest 200, sw.js 200, иконки, офлайн app shell + кэш аудио | ✔ pwa.spec |
| TC-E2E-05 | Гость без env: /#/login гостевой режим; приложение не ломается; чанк supabase-js не грузится | ✔ auth.spec (M18: + network-проверка чанка) |
| TC-E2E-06 | Цитаты: галерея → тайтл → цитата → cloze | ✔ quotes.spec |
| TC-E2E-07 | Настройки: смена темы/локали; **экспорт-файл доступен** (download) | ✔ settings.spec (M18) |
| TC-E2E-08 | Вход magic link (полный флоу с мок-Supabase) | GAP-6 |

### 4.9 i18n / доступность / безопасность (TC-XXX)

| ID | Кейс | Тип | Покрытие |
|---|---|---|---|
| TC-I18N-01 | Все ключи ru/en синхронны — шаг CI `npm run check:i18n` (scripts/check-i18n.mjs, M18). Ручная команда сверки: `node -e "const a=require('./src/locales/ru.json'),b=require('./src/locales/en.json');const k=o=>Object.keys(o).flatMap(x=>typeof o[x]==='object'?Object.keys(o[x]).map(y=>x+'.'+y):[x]);const A=new Set(k(a));console.log('только ru:',k(b).filter(x=>!A.has(x)));const B=new Set(k(b));console.log('только en:',k(a).filter(x=>!B.has(x))))"` (пустые списки = ок) | П | регламентно (не в CI) — GAP-9 (опц.: шаг CI) |
| TC-I18N-02 | Переключение локали live; персистится после перезагрузки | П | частично: live ✔ e2e settings; persistence после reload — GAP-9 |
| TC-I18N-03 | Хардкод-строки интерфейса отсутствуют (только t()) | Н | ревью + чеклист; ESLint-правило — GAP-9 (опц.) |
| TC-A11Y-01 | Клавиатурная навигация: Space/1–4/R/S/Esc/Enter/Backspace | П | ✔ screen-тесты |
| TC-A11Y-02 | aria: счётчики очереди ✔, toast polite ✔; волна микрофона aria | П | частично: счётчики/тост ✔; волна — GAP-9 |
| TC-A11Y-03 | Тач-цели ≥44×44 на мобиле | Г | GAP-8 (визуальная проверка; автомат — опц.) |
| TC-A11Y-04 | Space на сфокусированной кнопке — её активация, не переворот карточки (onControl, постмортем M10) | Г | ✔ SrsScreen.test (M18) |
| TC-SEC-01 | npm audit: 0 high/critical | Н | ✔ CI-гейт |
| TC-SEC-02 | Секреты не в git: .env* в ignore, diff-ревью чеклист | Н | ✔ чеклист коммита |
| TC-SEC-03 | RLS-политики Supabase: аноним не читает чужие схемы | Н | GAP-6 (sql-тесты — с активацией Supabase) |
| TC-SEC-04 | Импорт дампа не инжектит user_id / не выполняет код | Н | ✔ sanitizeImport-тесты |

### 4.10 Производительность и поставка (TC-PERF) — бюджеты

| ID | Бюджет | Контроль |
|---|---|---|
| TC-PERF-01 | Сборка: чанк гостя без supabase-js (lazy-import) | ✔ sync.test + e2e network-проверка (M18) |
| TC-PERF-02 | Аудио не в precache SW (23 МБ+) | ✔ pwa.spec + Watch out M9 |
| TC-PERF-03 | mergeLww пачкой (без квадратичной деградации) | ✔ sync.test (постмортем M13) |
| TC-PERF-04 | Unit-набор < 60 с на CI (замер по логам CI); e2e — локально < 3 мин (замер вручную при прогоне §6; вынос e2e на CI — отдельная задача) | мониторинг CI-времени |
| TC-PERF-05 | Длительность аудио в гейте 0.3–2.5 с — на стороне генератора (gen_audio.py, outliers фиксируются в WAL); validate:data проверяет существование файлов, не длительность | регламент билдера |

## 5. Политика нестабильных (flaky) тестов {#flaky}

**Постмортем a45b3a5 (2026-09-30):** SrsScreen «Space переворачивает» упал на CI, re-run зелёный. 130+ локальных прогонов (TZ=UTC, 2 воркера, taskset 2 CPU, shuffle) — не воспроизведён. Корневая причина (по DOM-дампу: фронт показан, revealed=false): цейтнот раннера — ре-рендер после Space не успел в 1000ms-бюджет waitFor. **Исправление (17.1):** полный init события (`key: ' '`, `code: 'Space'`) + единый таймаут 4000ms на пост-интерактивных `findBy*`.

Правила:
1. **Таймауты:** все `findBy*` после асинхронных взаимодействий (Dexie-запись, XP-шина) — `{ timeout: 4000 }`; после тяжёлого бутстрапа больших данных — 10 000.
2. **События:** `fireEvent` с полным init (`key`+`code` для клавиш) — не полагаться на дефолты jsdom.
3. **Детерминизм:** даты/now — фиксированные (замороженный `previewNowRef`-паттерн); fuzz ts-fsrs — seeded (время+reps, паритет превью/ответа).
4. **Регламент падения:** единичный red на CI при зелёном локальном → 1 re-run; повторное падение → блокер, расследование с DOM-дампом (Vitest печатает body), фикс в ветке, запись в WAL Known Issues.
5. **Анти-паттерны:** sleep-ожидания вместо findBy; мокирование ради зелёного (чинить код/тест честно); тесты, зависящие от порядка файлов (изоляция jsdom).

## 6. Регламент прогонов {#runs}

| Ситуация | Набор | Критерий |
|---|---|---|
| Каждый push (CI) | L1–L3, L5–L7 (lint, typecheck, validate:data, test, audit, build); e2e (L4) в CI не запускается — нет браузера (Known Issue) | все зелёные |
| Локально перед PR | то же + `npm run test:e2e` (включая build в webServer) | все зелёные |
| Перед merge | статус PR зелёный (Watch out: не мержить при красном) | явная проверка |
| Контент-правки (data/) | validate:data + unit (lessons/words) + e2e смежных экранов | зелёные |
| Релиз/публикация | полный набор ×2 + ручной смоук дашборд→урок→SRS→синк | зелёные + отчёт |
| Стресс-стабильность (раз в майлстоун, опц.) | unit ×3 в CI-условиях (TZ=UTC, `--maxWorkers=2`, shuffle), e2e ×3 | 0 падений |

## 7. Критерии приёмки {#exit}

- L1–L7 зелёные локально и в CI; e2e — локально.
- Новая функциональность ≥1 кейс на каждый тип поведения (П+Н+Г для доменов).
- Данные валидны (validate:data), манифест актуален.
- 0 high/critical в audit; секретов в diff нет.
- Новые пробелы, найденные при тестировании, зафиксированы в §8 с вехой (не «замолчаны» ✔).
- WAL/PLANS обновлены; чеклист коммита пройден.

## 8. GAP-анализ и вехи {#gaps}

Вехи: **S1** = текущая ветка M17 (быстрые правки документов), **S2** = следующая полировка, **S3** = с активацией Supabase/публикацией.

| GAP | Что не покрыто | Приоритет | Веха |
|---|---|---|---|
| ~~GAP-3~~ | judgeDictation, exactTypos, FSRS-параметры, сброс /settings, beforeunload, onControl-Space | ~~высокий~~ | **закрыт M18** |
| ~~GAP-4~~ | beforeunload-гарды и Space-на-кнопке | ~~высокий~~ | **закрыт M18 (влит в GAP-3)** |
| ~~GAP-5~~ | Экранные фазы: result+пересдача Врат, сценка разговорника | ~~высокий~~ | **закрыт M18; найден баг финала разговорника — починен** |
| GAP-6 | Supabase: e2e входа с мок-сервером, SQL-тесты RLS, серверный suppress_stale_update | средний | S3 |
| ~~GAP-7~~ | Контент-лоадеры: schema_version (assertEnvelope), 404-деградация | ~~средний~~ | **закрыт M18** |
| GAP-8 | E2E: ~~экспорт~~, ~~чанк supabase-js~~ (M18); ~~reduced-motion~~, ~~тач-цели~~ (M21: e2e/polish.spec — media-правила волны/тоста + кнопки SRS ≥44px на 375px). Остались: autoUpdate-reload (нужен реальный деплой SW-обновления), deep-links ?stage= (у нас ?step= — покрыт unit'ом M19; отдельный e2e не требуется) | низкий | S3 |
| GAP-9 | M21 закрыты: judge('')/unicode-ввод (checker.test), ~~Relearning-возврат~~ (был в scheduler.test), ~~online-триггер~~ (auth.test, M19), ~~слияние секций пересдачи~~ (GAP-5 walk), волна aria-hidden (есть с M6), I18N-сверка в CI (check:i18n, M18), ~~I18N-persistence после reload~~ (settings.test «сохранённая локаль применяется» — провайдер читает localStorage при монтировании, 2026-10-01). Остались по мере: автосинк-интервал 5 мин (таймер-тест хрупкий — триггер покрыт), safe-area/FOUC (визуальные), ESLint-правило i18n (вне стека, ревью вручную), скорость/анимации live | низкий | S3/по мере |

Решение о сроках закрытия GAP — за разработчиком (протокол: предложить добавление в PLANS отдельной задачей).

## 📜 Changelog

| Дата | Изменение | Причина |
|------|-----------|---------|
| 2026-09-30 | Создан тест-план 1.0 (уровни, кейсы, flaky-политика, регламент, GAP) | plan://M17#17.2, постмортем a45b3a5 |
| 2026-09-30 | M18: закрыты GAP-3/4/5/7 и часть 8/9 (+20 unit, +2 e2e: 269/49); e2e теперь в CI (джоба с chromium и артефактом отчёта) + шаг check:i18n; **найден и починен баг: финал разговорника показывал 404** (порядок проверок dialogIndex/-2) | plan://M18, задача разработчика «закрой баги и cicd» |
| 2026-09-30 | Версия 1.1 по ревью суб-агента: аудит трассировки (~15 ложных ✔ → частично/GAP: judgeDictation, exactTypos, FSRS-параметры, beforeunload, result Врат, фразбук-сценка, сброс, reduced-motion, экспорт e2e, чанк supabase-js, onControl, FOUC и др.); flood-guard 51–120→8/121–200→4/>200→0; 24 unit-файла; e2e-бюджет → локально; добавлены TC-DATA-13/14, TC-UI-21/22, TC-PERF-05; GAP переписан вехами S1–S3 (9 групп) | plan://M17#17.3, ревью тест-плана |
| 2026-09-30 | M21: GAP-8 — e2e тач-цели + reduced-motion (polish.spec); GAP-9 — judge('')/unicode; статусы остальных уточнены по факту покрытия (S3/по мере) | plan://M21#21.3 |
| 2026-09-30 | Веха S4 закрыта: statements/lines 100%, branches 90/functions 99 (пороги подняты); найден и починен баг key у упражнений экзамена Врат; placebo-ignore переведены на рабочую форму в затронутых файлах | plan://M21#21.4 |

## 10. M19: покрытие (coverage) {#coverage}

**Конфигурация**: `npm run test:coverage` — провайдер **istanbul** (v8-мерж терял покрытие модулей, загруженных несколькими тест-файлами — last-wins; M19), reporters text/html/lcov, exclude: i18n.ts/main.tsx (bootstrap, не тестируются юнитами). CI: шаг в e2e-джобе + артефакт `coverage-report`.

**Зафиксированный уровень (thresholds в vite.config.ts, рейчёт)**:
| Метрика | M19 | **M21 (веха S4)** | Порог CI |
|---|---|---|---|
| Statements | 94.25% | **100%** | 100 |
| Branches | 84.29% | 90.15% | 90 |
| Functions | 92.95% | 99.7% | 99 |
| Lines | 96.37% | **100%** | 100 |

**Докрыто в M19** (+111 тестов: 249→360): ExerciseView (все типы/ветки/аудио/трансформ), speech (Web Speech моки), auth+supabase (env-гейт, сессии, SIGNED_OUT, online-триггер), Login, sync (enqueueAllRows/pull-страницы/LWW-владельцы/conflict-ключи/client), SettingsScreen (валидация импорта, экспорт, контролы, аккаунт), LessonScreen (полный walk всех 7 шагов, deep-link, guard, Esc/beforeunload/Enter), Phrasebook (голос, финал — найден баг 404), Quotes (фильтр/озвучка/поповер), Srs (гарды, финал очереди, error, озвучка), Gates (чеклист, dispute), домены (formatInterval/judgeDictation/judgeVoice/FSRS-параметры/runner/award-бонусы), tts, App-404, Ranks error, Dashboard error.

**Веха S4 закрыта в M21** (~154 statement'ов: +~50 тестов по 12 модулям — LessonScreen-хвосты, Quotes, Gates-проход, Settings-импорт UI-ok, Srs-заморозка/клики, auth-таймеры, tts-voices, db/sync-края, Dashboard-ветки; + найден и починен **баг экзамена Врат**: упражнения рендерились без `key` — состояние перетекало между однотипными заданиями, экзамен был фактически непроходимым; LessonScreen:771-прецедент). Форма ignore: обычный `/* istanbul ignore next */` в этом тулчейне — placebo (esbuild стирает комментарии до инструментации); рабочие формы — `/* istanbul ignore next @preserve */` и `ignore start/stop`; защитные недостижимые ветки помечены рабочей формой с обоснованием.
