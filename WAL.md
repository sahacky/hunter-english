# WAL — Hunter English

## Current Phase
M0: Ресёрч — DONE → следующий M1: Дизайн и спецификации

## Completed
- Бутстрап: PROMT.md прочитан и перенесён в `example_rules/`; созданы AGENTS.md (вход для любых агентов → BOOT/WAL/PLANS), BOOT.md, WAL.md, PLANS.md, CLAUDE.md (`@AGENTS.md`)
- Ресёрч M0 завершён, выжимка — `research/00-summary.md`; файлы `research/01`, `02`, `03`, `04` (+ `tools/bebris/`), `05` (+ `data/quotes-sample.json`, `tools/quotes/*.py`), `06`, `07`
- `gh` авторизован (аккаунт sahacky, classic-токен repo+workflow в ~/.config/gh/hosts.yml); push в origin/main работает

## In Progress
- —

## TODO
- (опц.) Докачать 25 уроков Бебриса (список в 04, раздел «Не охвачено»), проверить Present Perfect (уроки 2.26–2.45)
- M1: начать с plan://M1#1 — программа курса по рангам E→S (читать research/00-summary.md, 01 §5, 03, 04 §4)
- Затем M2 (инициализация: Vite, CI, Supabase, хостинг)

## Known Issues
- Git инициализирован, первый коммит запушен в приватный `sahacky/hunter-english` (main); .gitignore базовый — дополнить в M2
- По AoT, JJK, Solo Leveling цитаты только ручным сбором; фанатские источники помечены «⚠ сверить с дубляжом»
- IMDb: ToS запрещает автоматический сбор — только ручная выборка
- Supabase free засыпает после 7 дней без активности

## Decisions Made
- Стек: Vite + React + TS + Supabase (GitHub OAuth) + Dexie + ts-fsrs + react-i18next + PWA; тесты Vitest/Playwright
- Репо **приватный** `sahacky/hunter-english` (передумали с публичного). ⚠️ GitHub Pages для приватного репо требует GitHub Pro — хостинг решить в M2 (Pro / Cloudflare Pages / сделать публичным)
- UI локали ru + en с первого дня; учебный контент — в `data/`, не в i18n
- Голос en-GB: Piper `cori` (high) основной + Kokoro `bm_george` мужской; предзаписанное аудио + фолбэк Web Speech
- Ранги E→S = CEFR, повышение только через «Врата»; XP только за реальную работу
- Без лимита токенов, чекпоинты WAL; интернет свободно (без секретов наружу)
- 15 новых карточек/день (~10 слов + 5 фраз), FSRS retention 0.90

## Decisions Pending
- AI-собеседник (Claude API через Supabase Edge Function) — отложено
- Хостинг при приватном репо (GitHub Pro / Cloudflare Pages / публичный репо) — в M2

## Watch out:
- В коммитах/PR НИКАКИХ упоминаний ИИ/Claude (без Co-Authored-By, Generated with и т.п.)
- `CLAUDE.md` — локальный (в .gitignore), только `@AGENTS.md`; правила не дублировать, всё писать в AGENTS.md; никуда не публиковать
- `example_rules/` — только примеры, не редактировать и не считать правилами проекта
- Не публиковать Oxford 3000/5000, видео/аудио из сериалов, тексты песен
- Цитаты: только короткие, с источником, ≤ 40–60 на тайтл
- Код не писать до M2 и без подтверждения задачи

## 📜 Changelog
| Дата | Изменение | Причина |
|------|-----------|---------|
| 2026-09-27 | Инициализация WAL | Первый запуск PROMT.md |
| 2026-09-27 | AGENTS.md — единый вход для всех агентов, добавлен CLAUDE.md | Не только Claude работает с проектом |
| 2026-09-27 | Создан .gitignore, CLAUDE.md в игноре | Решение разработчика |
| 2026-09-27 | Создан приватный репо, первый коммит; правило «без упоминаний ИИ» | Решение разработчика |
| 2026-09-27 | Готова карта курса Бебриса (04) | Субагент завершён |
| 2026-09-27 | M0 завершён: резюме, выбран голос, файл-источник снят | Решение разработчика |
