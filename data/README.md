# data/ — учебные данные Hunter English

Лицензия папки: **CC BY-SA 4.0** (наследуется от NGSL и Wiktionary/kaikki). Источники — `CREDITS.md`.

Планируемая структура (спека `specs/05-data-formats.md`):

```
data/
  words/        words-0001-0719.json (NGSL-Spoken), words-0720-2806.json (NGSL), words-2807-5000.json
  phrases/      грамматические фразы уроков (по рангам)
  lessons/      уроки (по рангам E→S)
  quotes/       цитаты по тайтлам (≤60 на тайтл)
  phrasebook/   диалоги разговорника (10 ситуаций)
```

Каждый файл: `{ "schema_version": 1, "kind": "word|phrase|lesson|quote|phrasebook_dialog", "items": [...] }`.

Статус (M2): папка пуста — наполнение в M3 из локального `data/raw/`
(NGSL 2806, NGSL-Spoken 719, переводы kaikki на 1800 слов, цитаты 274 с русским переводом в
`research/data/quotes-ru-merged.json`). Сырьё в `data/raw/` не коммитится.

Валидация схем — `npm run validate:data` (добавляется вместе с первыми файлами данных).
