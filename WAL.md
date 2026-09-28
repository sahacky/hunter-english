# WAL — Hunter English

## Current Phase
**M7 закрыт** (PR #7 смержен, CI зелёный): домен геймификации (уровни 100+25×(n−1), капы XP дня, стрик+заморозки, квесты, Врата ≥80/85 + 72ч), хранилище user_stats/item_progress, XP-шина (SRS +1/+2, урок: категории+капы, +25/+10 бонус, повтор 50%), дашборд (квест/статус/«Начать день»/цитата дня), `/#/ranks` (титулы), `/#/gates/E-D` (intro/exam/result, рантайм-генерация из данных E, ранг-ап +200). Следующий — **M8 «Контент ранга E→D + разговорник»**: детализировать в PLANS (данные: уроки E-06…E-24 по specs/01 §5, phrasebook data/phrasebook + экран `/#/phrasebook`, контрольные юнитов, find_error/tense/transform упражнения).

## Completed
- Бутстрап: AGENTS.md (вход для любых агентов → BOOT/WAL/PLANS), BOOT.md, WAL.md, PLANS.md, CLAUDE.md (`@AGENTS.md`, локальный)
- M0: ресёрч, выжимка — `research/00-summary.md`
- M0.5: цитаты с RU → `research/data/quotes-ru-merged.json` (274); сырьё в `data/raw/` (NGSL 2806, NGSL-Spoken 719, en_50k, Oxford 5000 локально, kaikki 1800/1800)
- M1: 8 спеков в `specs/` (01 курс, 02 урок/упражнения, 03 SRS, 04 геймификация, 05 JSON-схемы, 06 БД+sync, 07 экраны, 08 дизайн-система), BLOCKER/MAJOR исправлены
- M2: скаффолд Vite+React+TS, i18n ru/en, hash-роутинг, Vitest+Playwright, CI/deploy; hotfix CI (PR #1 был смержен с красным CI — `npm ci` падал): Vite 7, `@testing-library/dom`, `@types/node`, Prettier в lint, typecheck конфигов, Node 22, `supabase-js` и `/login` убраны до M12. Все проверки зелёные локально, включая e2e
- M4: карточки SRS (PR #4) — домен `src/domain/srs/` (scheduler: applyAnswer, день 4:00, flood-guard 15/8/4/0, wake-up rule-2, buildQueue; REVIEW-маркер про шаги ts-fsrs), `ProgressRepository` (шов) + Dexie `src/data/db.ts` (зеркало specs/06 §3, sync_queue, append-only review_log) + `src/lib/uuidv7.ts`, контент-лоадер `src/content/words.ts` (ленивые чанки, createFirstCards rule-1), экран `src/screens/SrsScreen.tsx` (пробел/1/2, блоки по 20, живая очередь, счётчики, мгновенный saveAnswer, лимит новых между сессиями); 47 тестов; ревью 3 суб-агентов → блокер/мажоры исправлены
- M5: детализация внесена в PLANS (5.1–5.7, решения 1–6 подтверждены разработчиком); ветка `feature/m5-lessons`
- M5#5.1: домен проверки `src/domain/check/` (types / normalize / levenshtein / align / checker): нормализация, сокращения (can't=cannot=can not через expand в [can,not]), EXCEPTIONS+typoLimit, DP-выравнивание diff (match/typo/extra/missing), judge: trapWrong §4.3 + строгие ЛТ-06/17/19 §4.7, judgeVoice 0.85/0.80 §4.8; 47 unit-тестов; гейты зелёные (94 теста суммарно)
- M5#5.2: домен урока `src/domain/lesson/` (types / steps / xp / runner): groupIntoSteps (тип → шаг, cloze+quote → «Из сериала», card игнор), evaluateStep (warmup ≥70%, listening <60% retrySuggested), xpForOutcome (1-я/50% floor/0, disputed+self_reported полный), recordAnswer/advanceStep/finishPass/passAccuracy/totalXp, computeLessonStatus (locked/available/in_progress/completed/review_due, ≥90% learned, lapsed ≥30%), isLessonPassed; ProgressRepository + get/putLessonProgress (Dexie, sync_queue 'lesson_progress', LessonProgressRow); шаг 7 завершается явным finishPass; 27 новых тестов, всего 121
- M5#5.3: контент-лоадер `src/content/lessons.ts` (типы phrase/exercise/lesson по specs/05 §2–4, ленивые glob-чанки, courseToLessonId E-01↔les-e-01, exercisePhraseIds — все ссылки payload, assembleLesson — шаги+привязка фраз, loadLessonView); валидатор: phrasebook_topic известность (пассивна до M8, quotes_topic — реестр тем в M8); 8 новых тестов (129); открыт draft PR #5 — CI зелёный, проверять после каждого пуша

- M5#5.4: контент пилота E1 — `research/tools/lessons/build_e1.py` (детерминированный seed, авто-вывод упражнений из пулов): 218 фраз (43+43+44+44+44), 217 упражнений (шаблон 1–6: cloze правила, разогрев choose+match, построение 24 = 8 wb + 16 tr/sp, диктант 5, речь shadowing 4 + answer_question 1, цитаты 2), 5 уроков; аудио 218 opus Piper cori (1 outlier ph-e-0198 — длинная фраза >2.5с, файл записан); фразы → deck 'phrases' (step 7 экрана); слова НЕ дублируются — они уже в колоде из M4 (loadWordNotes); интерливинг-флаг в данных не нужен (выбор фраз — в билдере, schema additionalProperties:false); манифест пересобран
- M5#5.5–5.6: экран `/#/lesson/:id` (`src/screens/LessonScreen.tsx`: загрузка+guard «Продолжить/Сначала», deep-link ?step≤достигнутого, rule→cloze→…→deck flow, repeat-step для разогрева <70%, шаг 7 → ensureCards фраз в deck phrases + finishPass + score, финал XP/точность/время, 404 по :id), компоненты `src/components/lesson/ExerciseView.tsx` (translate/cloze/dictation через judge (+judgeDictation — артикль-ослабление §3), choose/match/word_bank (Backspace), voice: speak/shadowing/answer через Web Speech + фолбэк текст/self_reported; FeedbackPlate с diff и «Я был прав»), либы `src/lib/speech.ts`/`src/lib/audio.ts` (R/S, 🐢 0.75×); контракт: onAnswer ровно один раз финальным исходом; Enter только с body-фокуса; i18n lesson.* ru/en; 6 тестов экрана
- M7: домен `src/domain/game/` (types/game/award), user_stats/item_progress в репозитории, XP-шина в Srs/Lesson, Dashboard (`/#/`), RanksScreen, GatesScreen E-D; ревью: блокеры (XP урока после finishPass — снапшот finished; в Вратах correct всегда 0 — перемешивание; ранг-ап любому экзамену — условие E→D) и мажоры (кулдаун по провалу, слияние секций пересдачи, дубль XP сводки, self_reported не в экзамене, квест-день персистится с реальным due, «знаю» = Review-карточки, cloze-бонус только цитатный) исправлены; 179 тестов + 5 e2e
- M6: детализация 6.1–6.5 + решения 1–5; `src/lib/tts.ts` (speak/stopSpeak, en-GB выбор голоса с самовалидацией кэша), judgeVoice: артикли из обеих сторон + speech_threshold из данных + fallback артикль-only фраз, VoiceExercise: 5-попыточный «Сдаться» (0 XP) + волна (CSS, reduced-motion), SrsScreen: 🔊/🐢 R/S + stopSpeak на unmount, цитаты шага 6 — TTS с «…»; ревью: гонка play() в tts (захват элемента в catch), гарды повторов/модификаторов клавиш, diff голоса по «голым» токенам, missing `+слово`, dead audio.ts удалён; 149 тестов + 5 e2e; PR #6 смержен
- M5#5.7: e2e smoke урока (5 тестов, Playwright; NOTE: перед локальным e2e — `npm run build`, preview отдаёт dist); ревью 3 суб-агентов → 4 блокера (hint-dead-end, нулевая сводка финала, двойной onAnswer word-bank/voice) + мажоры исправлены: recordAnswer идемпотентен + диспут корректирует точность, self_reported не растит точность, ловушки подключены к CheckTask (trapWrong + строгие ЛТ-06/17/19), answer.typo=exact → exactTypos, judgeDictation прощает только пропущенные артикли (≤2), статус финала через computeLessonStatus (свежие фразы → in_progress «почти готов», повтор не затирает оригинал), persist-очередь «последний выигрывает», error-фаза, 404 на невалидный ?step, фразы в /#/srs (loadPhraseNotes), контент: answer_question в E-01..03, дедуп пар по RU, дистракторы без коллизий перевода, \b-границы цитат; 140 тестов
## In Progress
- (пусто) — следующая сессия: детализация M8 «Контент E→D + разговорник» в PLANS → реализация

## TODO
- M5: Движок уроков и упражнений (ранг E) — детализация в PLANS, затем реализация
- (опц.) Докачать 25 уроков Бебриса (research/04 «Не охвачено»), проверить Present Perfect (уроки 2.26–2.45)
- (опц., отдельной задачей) Обновить стек: React 19, react-router 7 (снимет audit moderate), i18next 26, Vite 8 + plugin-react 6, пакет `typescript-eslint`

## Known Issues
- Отложено ревью M5 (осознанно, вехи указаны): бонус +25 XP за урок и дневные капы XP, квесты — M7; «проход по ошибкам» на финале, ProgressBar шагов, выход-диалоги, beforeunload-flush — полировка M8/M10; разогрев «с новыми заданиями» (сейчас те же), listening-плашка retrySuggested, дистракторы по полосе SFI ±50, match_pairs из lesson.words[] — уточнение контента M8; shadowing «после 5 попыток — Дальше с 0 XP» — M6
- M4: порядок новых карточек внутри колоды — алфавитный по `card_id` (все созданы одним instant; спека порядок новых внутри не регламентирует, interleaving по колодам соблюдён)
- M4: счётчик пробуждений `wokenToday` не учитывается между сессиями — обратные карточки (ru-en/speak) материализуются с M6+, до тех пор недостижимо
- M4: подпись «Hard/Easy можно включить в настройках» (specs/03 §6) и показ интервалов на кнопках — добавить при появлении экрана настроек
- M4: `srs.progress` (Пройдено N из M) — M = длина начальной очереди; из-за живой очереди N может превысить M (косметика, не ломает логику)
- `npm audit`: 2 moderate в `react-router-dom@6` (порог high не превышен); исправление только в v7
- `research/tools/quotes/merge_ru.py:17` — дефолтный путь с чужой машины (`/home/llm/...`); передавать путь аргументом
- `research/tools/data/fetch_kaikki.py` — слова в URL не экранируются (для слов с `'`); лишний `import sys`; нет `requirements.txt`
- e2e (Playwright) не запускается в CI; локально нужен `npx playwright install chromium` один раз
- M4: новые зависимости — `dexie` (runtime) и `fake-indexeddb` (devDep, тесты репозитория); API ts-fsrs сверен по node_modules (факт: 4.7.1 — fsrs(), generatorParameters(), createEmptyCard(), Rating, State; learning_steps в параметрах НЕТ, шаги: New Again=1м/Hard=5м/Good=10м, Relearning-шаг 5м; fuzz детерминирован seed'ом время+reps)
- `src/App.tsx` 404 берёт `nav.notFound`; ключи `notFound.*`, `common.loading`, `common.backToDashboard` пока не используются
- По AoT, JJK, Solo Leveling цитаты только ручным сбором; фанатские источники помечены «⚠ сверить с дубляжом»
- IMDb: ToS запрещает автоматический сбор — только ручная выборка
- `data/raw/` не в git: kaikki-дампы пересоздаются `research/tools/data/fetch_kaikki.py` (возобновляемо)
- (M12) Supabase free засыпает после 7 дней без активности
- `gh` CLI в окружении НЕТ — GitHub API через `curl -H "Authorization: Bearer $(cat ~/tok)"` (PR #3 создан и смержен так)

## Decisions Made
- Стек: Vite + React + TS + Dexie + ts-fsrs + react-i18next + PWA; тесты Vitest/Playwright; Supabase — только в M12
- Архитектура: **local-first**. Доменное ядро (FSRS, проверка, XP) — чистый TS; прогресс через `ProgressRepository` (MVP — Dexie); UUIDv7 на клиенте; `review_log` append-only; `content_version` у контента. Бэкенд меняется без переписывания клиента
- Django/свой бэкенд НЕ нужен для себя и друзей; M12 = Supabase free (magic link/Google, только по приглашениям, гостевой режим + перенос прогресса)
- Хостинг: GitHub Pages, когда разработчик сделает репо публичным (не раньше MVP); до этого репо **приватный**
- UI локали ru + en с первого дня; учебный контент — в `data/`, не в i18n
- Голос en-GB: Piper `cori` (high) основной + Kokoro `bm_george` мужской; предзаписанное аудио + фолбэк Web Speech
- Ранги E→S = CEFR, повышение только через «Врата»; XP только за реальную работу
- 15 новых карточек/день (~10 слов + 5 фраз), FSRS retention 0.90
- (M1) Врата открыты всегда; секции ≥80% и сумма ≥85%, пересдача через 72ч; card_id = `<entity_id>.<тип>`; XP-канон — 04 §4.1; границы дня 04:00; цели E300/D1000/C1800/B2800/A4000/S5000
- Разработка делегируется AI-агентам; каждый значимый этап — ревью и исправления

## Decisions Pending
- specs/03 §2/§5: минутные шаги (learning/relearning steps) — синхронизировать спеку с фактом ts-fsrs 4.7 (шаги заданы библиотекой, REVIEW-маркер в scheduler.ts) или вернуться к обсуждению; решение за разработчиком
- Если проект станет продуктом (много пользователей): свой бэкенд Django + Postgres в Docker, регионы РФ (152-ФЗ, ЮKassa, VK/Яндекс ID) и позже глобальный (Stripe/Paddle, Google/Apple); юр. проверка лицензий (цитаты, голос `cori`, NGSL CC BY-SA) — не планировать без решения разработчика
- AI-собеседник — отложено (M12, опционально)
- Утверждение визуального стиля разработчиком (открытые вопросы specs/08)
- Порядок «Present Continuous в конце E» (спека 01, открытые вопросы)

## Watch out:
- В коммитах/PR НИКАКИХ упоминаний ИИ/Claude (без Co-Authored-By, Generated with и т.п.)
- **Не мержить в `main` при красном CI** (branch protection нет — дисциплина вручную). Проверять `gh run list` / статус PR перед merge
- Не использовать `--legacy-peer-deps` / `--force` для npm: конфликт peer-зависимостей = ошибка, которую надо чинить версиями
- `@vitejs/plugin-react@4` поддерживает Vite ≤7 — не поднимать Vite до 8 без plugin-react 6 (только в рамках задачи обновления стека)
- Не добавлять зависимости «на будущее» (`supabase-js` — только в M12, `vite-plugin-pwa` — в M9)
- Работать в feature/hotfix-ветках через PR, не в `main`
- `CLAUDE.md` — локальный (в .gitignore), только `@AGENTS.md`; правила писать в AGENTS.md
- `example_rules/` — только примеры, не редактировать
- Не публиковать Oxford 3000/5000, видео/аудио из сериалов, тексты песен; CEFR из Oxford — только внутренний пайплайн
- Цитаты: только короткие, с источником, ≤ 40–60 на тайтл

## 📜 Changelog
| Дата | Изменение | Причина |
|------|-----------|---------|
| 2026-09-27 | Инициализация WAL | Первый запуск PROMT.md |
| 2026-09-27 | AGENTS.md — единый вход для всех агентов, добавлен CLAUDE.md | Не только Claude работает с проектом |
| 2026-09-27 | Создан .gitignore, CLAUDE.md в игноре | Решение разработчика |
| 2026-09-27 | Создан приватный репо, первый коммит; правило «без упоминаний ИИ» | Решение разработчика |
| 2026-09-27 | Готова карта курса Бебриса (04) | Субагент завершён |
| 2026-09-27 | M0 завершён: резюме, выбран голос, файл-источник снят | Решение разработчика |
| 2026-09-27 | M0.5: цитаты обогащены RU (274), 07/03 дополнены, сырьё качается в data/raw/ (не в git) | Решение разработчика: базу готовить заранее, обработка в M3 |
| 2026-09-27 | M1 закрыт: 8 спеков + ревью + фиксы; сырьё докачано (kaikki 1800/1800) | Делегирование AI-агентам |
| 2026-09-27 | M2: скаффолд + CI готовы, проверки зелёные (lint/typecheck/test/e2e/build/audit чисто); branch protection — 403 (нужен Pro) | Автономная сессия |
| 2026-09-27 | PR #1 смержен в main (M0.5+M1+M2); хостинг отложен: репо станет публичным в конце | Решение разработчика |
| 2026-09-27 | Сторонние сервисы → M12 (после MVP); MVP = офлайн-first на Dexie | Решение разработчика |
| 2026-09-27 | Ревью после PR #1: CI был красный, WAL ошибочно писал «зелёные» → hotfix CI; M2 закрыт; зафиксированы local-first «швы», M12 = Supabase для себя и друзей, продуктовый вариант — в Pending; WAL очищен от устаревшего | Ревью по запросу разработчика |
| 2026-09-27 | M3 детализирован в PLANS (3.1–3.10, решения 1–7); старт ветки `feature/m3-data-pipeline`; разработчик разрешил merge/push без запроса | Делегирование автономной работы |
| 2026-09-27 | M3: 3.1–3.3, 3.5, 3.6 выполнены (схемы/валидатор/CI, Tatoeba-индекс, Piper-генератор, цитаты 274 с полными RU, 22 ловушки); validate:data и lint зелёные на готовых файлах | Автономная сессия M3, параллельные саб-агенты |
| 2026-09-27 | M3: датасет собран и провалидирован (3.4–3.8); kaikki докачан 2830/2830; финальные проверки зелёные | Автономная сессия M3 |
| 2026-09-27 | AITS-ревью M3: 2 блокера (Oxford CEFR в данных; джанк-переводы топ-1000) и 13 мажоров исправлены; датасет пересобран (3 989 слов/3989 аудио/274 цитаты/22 ловушки); git-автор починен | Ревью 9 ролей + медиатор + 3 синтезатора |
| 2026-09-27 | M3 закрыт: PR #3 смержен в main при зелёном CI; git-автор ветки переписан на noreply (был literal-плейсхолдер); для старой истории main — rewrite перед публикацией репо (Known Issues) | Автономная сессия M3, merge разрешён разработчиком |
| 2026-09-27 | Чекпоинт перед новой сессией: M4 стартовал (ветка feature/m4-srs запушена, детализация 4.1–4.6, контракт src/domain/srs/types.ts); порядок работ — в In Progress | Ограничение токенов сессии |
| 2026-09-27 | M3#3.1: 8 схем draft-07 в `data/schemas/` (вкл. envelope и trap), §6.5 trap в спеке 05, `scripts/validate-data.mjs` (ajv + кросс-ссылки + аудио) → `npm run validate:data`, шаг Validate data в CI; ajv/ajv-formats в devDeps | План M3#3.1 |
| 2026-09-28 | M4#4.1 выполнена: `src/domain/srs/scheduler.ts` + 28 unit-тестов (test/lint/typecheck/validate:data/audit зелёные); API ts-fsrs 4.7.1 сверен — learning_steps не конфигурируются (REVIEW-маркер в коде) | Автономная сессия, merge/push разрешены |
| 2026-09-28 | M4#4.2–4.3 выполнены: Dexie-репозиторий + uuidv7 (+dexie/fake-indexeddb; eslint no-unused-vars varsIgnorePattern '^_'), загрузчик слов (ленивые чанки) + createFirstCards; 37 тестов зелёные | Автономная сессия |
| 2026-09-28 | M4#4.4–4.5 выполнены: экран /srs (бутрап+очередь+блоки 20+финал, клавиши пробел/1/2, счётчики, i18n), локальные гейты зелёные (42 теста) | Автономная сессия |
| 2026-09-28 | M4#4.6: ревью 3 суб-агентами (спеки/React/адверсариал) → блокер (сброс счётчика блока) и мажоры (гонка двойного ответа, живая очередь, дневной лимит новых между сессиями, wake-up только для ru-en/speak) исправлены; 47 тестов; PR #4 смержен при зелёном CI; ветки удалены | Автономная сессия, merge/push разрешены |
| 2026-09-28 | Детализация M5 внесена в PLANS (5.1–5.7 + решения 1–6: пилот контента — модуль E1, голос фолбэк-first, оркестрация дня вне M5, опечатка = полный XP, разговорник/бонус — позже, аудио цитат не генерим); ветка `feature/m5-lessons` | План следующего майлстоуна, ожидает подтверждения разработчика |
| 2026-09-28 | Решения M5 1–6 подтверждены разработчиком; M5#5.1 выполнена: `src/domain/check/` + 47 unit-тестов (test/lint/typecheck/validate:data/audit зелёные); REVIEW-маркер: артикль в знаменателе голосовой проверки (спека буквально, пересмотр M6) | Автономная сессия, merge/push разрешены |
| 2026-09-28 | M5#5.2 выполнена: `src/domain/lesson/` + расширение ProgressRepository (lesson_progress); 27 новых тестов (всего 121), гейты зелёные; разработчик: автономный режим до конца M5 + контроль CI после пушей | Автономная сессия |
| 2026-09-28 | M5#5.3 выполнена: контент-лоадер `src/content/lessons.ts` + phrasebook_topic в валидаторе; 8 тестов; draft PR #5 открыт, CI зелёный | Автономная сессия |
| 2026-09-28 | M5#5.4 выполнена: пилот E1 — 218 фраз/217 упражнений/5 уроков/218 аудио; validate:data зелёный (26 файлов); решения: фразы в deck phrases, слова не дублируются (M4), интерливинг без флага в данных | Автономная сессия |
| 2026-09-28 | M5#5.5–5.6 выполнены: экран урока + компоненты + голос с фолбэками; 137 тестов; CI зелёный на каждом пуше (draft PR #5) | Автономная сессия |
| 2026-09-28 | M5#5.7: e2e (5) + ревью 3 суб-агентов → 4 блокера и мажоры исправлены (140 тестов); M5 закрыт, PR #5 смержен при зелёном CI; ветка удалена | Автономная сессия, merge разрешён |
| 2026-09-28 | M6 закрыт: 6.1–6.5 выполнены, adversarial-ревью исправлено (блокер гонки play(), мажоры), PR #6 смержен при зелёном CI; ветка удалена | Автономная сессия |
| 2026-09-28 | M7 закрыт: 7.1–7.7 выполнены, ревью исправлено, PR #7 смержен при зелёном CI; ветка удалена | Автономная сессия |
