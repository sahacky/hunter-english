# data/ — учебные данные Hunter English

Лицензия папки: **CC BY-SA 4.0** (наследуется от NGSL и Wiktionary/kaikki) —
кроме `data/quotes/` и цитат-примеров в словах: это короткие цитаты с указанием
источника (право цитирования, не relicensing) — см. `CREDITS.md`.
Схемы и контракты — `specs/05-data-formats.md`.

```
data/
  schemas/      *.schema.json (draft-07) — из спеки 05, не редактировать руками
  words/        слова, фиксированные диапазоны freq_rank_ngsl:
                words-0001-0500 … words-2401-2809 + words-spoken-only.json
                + words-2810-4000.json / words-4001-5000.json
                  (субтитровая полоса, freq_rank_sub — M11, курация форм/джанка)
  quotes/       цитаты по тайтлам (274 записи, все с RU-переводом)
  traps.json    22 ловушки русскоязычных (ЛТ-01…ЛТ-22)
  manifest.json манифест сборки (пути, kind, counts, sha256) — для PWA
  raw/          сырьё пайплайна — gitignored, НЕ коммитится
```

Каждый файл данных — обёртка
`{ "schema_version": 1, "kind": "words|phrases|lessons|exercises|quotes|phrasebook|traps", "items": [...] }`.

Статус (M3): наполнено пайплайном `research/tools/`:
- `words/` — 3 989 записей (2 830 целевых лемм NGSL-Spoken + NGSL; CURATED-слой
  курации функциональных лемм и топ-переводов; CEFR выводится из частотного ранга;
  дроп по лицензионной курации — 0, без примера — 9);
- `quotes/` — 15 файлов / 274 записи; `auto_vocab` пересчитан единым алгоритмом
  (готовых к показу при ≥0.9 — 28; порог пересматривается в M8);
- `traps.json` — 22 ловушки; `manifest.json` — 23 файла;
- `../audio/words/cori/` — 3 989 файлов Opus (Piper en_GB cori; ~17 МБ).

Файлы `data/words|quotes|traps.json|manifest.json` генерируются — руками не
править (пересборка затрёт); правки через скрипты `research/tools/` или
источники (`research/data/quotes-ru-merged.json`, backfill-файл переводов).
Промежуточные данные: `research/data/` (merged-цитаты, backfill) — можно
править как источник; `data/raw/` — только сырьё скриптов.

## Сборка (runbook)

Порядок и команды — корневой `README.md` (раздел «Сборка данных с нуля»).
Валидация: `npm run validate:data` (ajv draft-07 + кросс-ссылки + манифест +
уникальность id; шаг в CI и в deploy).

Ключевые решения M3 — `PLANS.md` (раздел M3, решения 1–8): фиксированные чанки,
id `lemma-pos`, sentinel `100000+spoken_rank` для spoken-only лемм (сортировка
UI по `freq_rank_spoken ?? freq_rank_ngsl`), аудио в репо.
