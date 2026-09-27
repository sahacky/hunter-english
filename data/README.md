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

Статус (M3): папка наполнена пайплайном `research/tools/`:
- `words/` — 4 024 записи (NGSL-Spoken 719 лемм + NGSL до 2 806; переводы kaikki, CEFR, примеры Tatoeba/цитат);
- `quotes/` — 274 цитаты по 15 тайтлам (RU-переводы у всех);
- `traps.json` — 22 ловушки русскоязычных;
- `manifest.json` — манифест сборки для PWA;
- `../audio/words/cori/` — 4 024 файла Opus (Piper en_GB cori).

Сырьё в `data/raw/` не коммитится; сборка воспроизводится скриптами
`research/tools/data/build_*.py` и `research/tools/audio/gen_audio.py`.

Валидация схем — `npm run validate:data` (ajv draft-07 + кросс-ссылки, запускается в CI).
