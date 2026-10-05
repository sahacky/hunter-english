# Спека 05: Форматы данных (JSON-схемы) {#data-formats}

> Задача: plan://M1#data-formats. Источники: `research/07-tech-and-data.md` (§1–3 — переводы, лицензии, датасеты), `research/03-methods-and-exercises.md` (§2 — каталог упражнений, §3 — проверка ответов, §9 — шаблон урока), `research/05-quotes-availability.md` (§0 — формат), `research/00-summary.md`. Канонические URI этой спеки: `data://<якорь>`.

## 0. Общие положения {#data-common}

- Все учебные данные лежат в `data/` репозитория в виде JSON (UTF-8, LF). Лицензия `data/` — **CC BY-SA 4.0**, источники — в `CREDITS.md`. Oxford 3000/5000, видео/аудио из тайтлов, тексты песен в `data/` **не попадают** (см. WAL → Watch out).
- Каждая сущность описывается **JSON Schema draft-07**. Схемы из этой спеки вынесены в файлы `data/schemas/<name>.schema.json` (M3) и не редактируются вручную при использовании — правки только через эту спеку.
- Каждый **файл** данных имеет поле `schema_version` (целое, начинается с 1). Правила версионирования — [§8](#data-versioning).
- Строки EN хранятся как есть (апострофы прямые `'`); RU-переводы — без ударений (нормализация Unicode NFC, ударения из kaikki снимаются).
- ID сущностей — строка `[a-z0-9-]`, стабильная между релизами (на неё ссылается прогресс пользователя, см. `db://table-card_states`).

### Расположение и разбиение файлов {#data-layout}

```
data/
  schemas/          ← *.schema.json (draft-07), генерируются/поддерживаются из этой спеки (M2)
  words/            ← слова, разбивка по диапазонам частотного ранга
  phrases/          ← грамматические фразы уроков (по рангам)
  lessons/          ← уроки (по рангам) + упражнения (по рангам)
  quotes/           ← цитаты (по тайтлам, ≤ 40–60 записей на файл)
  phrasebook/       ← диалоги разговорника (по главам-темам)
  traps.json        ← каталог ловушек русскоязычных (research/03 §4)
  raw/              ← сырьё пайплайна, в .gitignore, НЕ коммитится
```

Разбиение (файл не должен превышать ~200–300 КБ, чтобы грузился быстро):

| Каталог | Файлы | Принцип |
|---|---|---|
| `data/words/` | фиксированные диапазоны `freq_rank_ngsl`: `words-0001-0500.json`, `words-0501-1000.json`, `words-1001-1500.json`, `words-1501-2000.json`, `words-2001-2400.json`, `words-2401-2809.json` + `words-spoken-only.json` (леммы только NGSL-Spoken с sentinel-рангом); субтитровая полоса M11 — `words-2810-4000.json` + `words-4001-5000.json` (по `freq_rank_sub`, курация форм/джанка — ревью M11) | по диапазону ранга; имена файлов стабильны при пересборках |
| `data/phrases/` | `phrases-e.json`, `phrases-d.json`, … | по рангу |
| `data/lessons/` | `lessons-e.json`, `exercises-e.json`, … | уроки и упражнения отдельно, по рангу |
| `data/quotes/` | `supernatural.json`, `game-of-thrones.json`, … | по тайтлу, ≤ 40–60 цитат в файле |
| `data/phrasebook/` | `airport.json`, `hotel.json`, … | по теме-главе |

Каждый файл — **обёртка-конверт** (в отличие от «голого» массива в `research/data/quotes-ru-merged.json`, который является промежуточным источником):

```json
{ "schema_version": 1, "kind": "words", "items": [ "..." ] }
```

Соответствие ловушек: ЛТ-01…ЛТ-25 (01) ↔ slug `trap-*` (05) — таблица соответствия в `data/traps.json` при наполнении.

`kind` ∈ `words | phrases | lessons | exercises | quotes | phrasebook | traps`. Элементы `items` валидируются схемой соответствующей сущности.

---

## 1. word — словарное слово {#schema-word} (URI: `data://schema-word`)

Одна запись = **одна часть речи** одного лемм. Если слово — и глагол, и существительное (`take`), это две записи с id `take-verb` и `take-noun` (карточки FSRS строятся на запись).

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | всегда `лемма-POS`, напр. `house-noun`, `take-verb` (id не зависит от набора POS в исходнике — стабильность card_id; смена id = мажорная версия по §7) |
| `lemma` | string | ✅ | словарная форма, lowercase |
| `translation_ru` | string[] (1–3) | ✅ | главные переводы, сгруппированы по значению (kaikki → ручная курация; CURATED-слой build_words для функциональных лемм) |
| `part_of_speech` | enum | ✅ | `noun, verb, adjective, adverb, preposition, pronoun, conjunction, interjection, determiner, phrase` |
| `cefr_level` | enum \| null | ✅ | `A1…C2` или `null`; в M3 выводится **только из частотного ранга** (1–500 A1, 501–1000 A2, 1001–2000 B1, 2001+ B2); Oxford-разметка не публикуется (Watch out в WAL) |
| `freq_rank_ngsl` | integer ≥ 1 | ✅/— | ранг по `NGSL_12_stats.csv`; у spoken-only лемм — sentinel `100000+freq_rank_spoken` (сортировать по `freq_rank_spoken`). **Обязателен, если нет `freq_rank_sub`** (M11) |
| `freq_rank_sub` | integer ≥ 1 | — | субтитровый ранг (FrequencyWords en_50k, порядок частоты среди лемм вне NGSL/NGSL-Spoken) — у слов субтитровой полосы 2810–5000 (M11, решение M11#5: best effort; CEFR полосы — A1 только базовые местоимения, прочее B2 — ревью M11); взаимоисключим с `freq_rank_ngsl` |
| `freq_rank_spoken` | integer ≥ 1 | — | ранг по NGSL-Spoken (если слово входит в разговорные 719) |
| `tags` | string[] | ✅ | напр. `ngsl`, `subtitles` (полоса 2807–5000, M11), `spoken-top719`, `irregular-verb`, `phrasal-have` (M5+), `trap:to-home` |
| `example_en` / `example_ru` | string | ✅ | фраза-пример (Tatoeba / урок / цитата); EN и RU заполняются парой |
| `audio` | object | ✅ | `{ "en_gb": "<путь>" }` — путь в `audio/`, формат `audio/words/cori/<id>.opus` |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:word:v1",
  "title": "word",
  "type": "object",
  "required": ["id", "lemma", "translation_ru", "part_of_speech", "cefr_level",
               "tags", "example_en", "example_ru", "audio"],
  "additionalProperties": false,
  "allOf": [
    { "if": { "required": ["freq_rank_sub"] },
      "then": { "not": { "required": ["freq_rank_ngsl"] } } },
    { "if": { "not": { "required": ["freq_rank_sub"] } },
      "then": { "required": ["freq_rank_ngsl"] } }
  ],
  "properties": {
    "id":    { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "lemma": { "type": "string", "minLength": 1 },
    "translation_ru": { "type": "array", "minItems": 1, "maxItems": 3, "items": { "type": "string" } },
    "part_of_speech": { "enum": ["noun", "verb", "adjective", "adverb", "preposition",
                                 "pronoun", "conjunction", "interjection", "determiner", "phrase"] },
    "cefr_level": { "enum": ["A1", "A2", "B1", "B2", "C1", "C2", null] },
    "freq_rank_ngsl":   { "type": "integer", "minimum": 1 },
    "freq_rank_sub":    { "type": "integer", "minimum": 1 },
    "freq_rank_spoken": { "type": "integer", "minimum": 1 },
    "tags": { "type": "array", "items": { "type": "string" } },
    "example_en": { "type": "string", "minLength": 1 },
    "example_ru": { "type": "string", "minLength": 1 },
    "audio": {
      "type": "object",
      "required": ["en_gb"],
      "additionalProperties": false,
      "properties": { "en_gb": { "type": "string", "pattern": "^audio/" } }
    }
  }
}
```

Живой пример (числа частот иллюстративные):

```json
{
  "id": "house-noun",
  "lemma": "house",
  "translation_ru": ["дом", "палата", "династия"],
  "part_of_speech": "noun",
  "cefr_level": "A1",
  "freq_rank_ngsl": 217,
  "freq_rank_spoken": 312,
  "tags": ["ngsl", "spoken-top719"],
  "example_en": "The house is big.",
  "example_ru": "Дом большой.",
  "audio": { "en_gb": "audio/words/cori/house-noun.opus" }
}
```

---

## 2. phrase — грамматическая фраза урока {#schema-phrase} (URI: `data://schema-phrase`)

Единица построения RU→EN (метод Бебриса) и материал диктанта/shadowing. Хранится в `data/phrases/`.

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | `ph-<ранг>-<номер>`, напр. `ph-e-0042` |
| `text_en` | string | ✅ | эталонная фраза (тоже входит в `variants`) |
| `translation_ru` | string | ✅ | задание для перевода RU→EN |
| `grammar_point_id` | string \| null | ✅ | ссылка на грамматическую точку урока (`gp-e-03`); `null` для лексических фраз |
| `variants` | string[] (≥ 1) | ✅ | все допустимые EN-варианты ответа, включая `text_en` (§3 проверка) |
| `chunk_slot` | string | — | слово-слот чанк-шаблона (план {#teaching-quality} Q2.2): обязано присутствовать в `text_en`; фраза получает chunk-карточку SRS (фронт `___`, specs/03 {#interleaving-policy}) |
| `audio` | object | — | `{ "en_gb": "audio/phrases/cori/ph-e-0042.opus" }` |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:phrase:v1",
  "title": "phrase",
  "type": "object",
  "required": ["id", "text_en", "translation_ru", "grammar_point_id", "variants"],
  "additionalProperties": false,
  "properties": {
    "id":  { "type": "string", "pattern": "^ph-(e|d|c|b|a|s)-[0-9]{4}$" },
    "text_en": { "type": "string", "minLength": 1 },
    "translation_ru": { "type": "string", "minLength": 1 },
    "grammar_point_id": { "type": ["string", "null"] },
    "variants": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "audio": {
      "type": "object", "required": ["en_gb"], "additionalProperties": false,
      "properties": { "en_gb": { "type": "string", "pattern": "^audio/" } }
    }
  }
}
```

Живой пример:

```json
{
  "id": "ph-e-0042",
  "text_en": "Do you have a reservation?",
  "translation_ru": "У вас есть бронь?",
  "grammar_point_id": "gp-e-03",
  "variants": ["Do you have a reservation?", "Have you got a reservation?"],
  "audio": { "en_gb": "audio/phrases/cori/ph-e-0042.opus" }
}
```

---

## 3. exercise — упражнение {#schema-exercise} (URI: `data://schema-exercise`)

Каталог из 14 типов — `research/03 §2`. Упражнения хранятся отдельно от уроков (`data/lessons/exercises-<ранг>.json`), урок ссылается по id.

| # | `type` | Упражнение | Навык |
|---|---|---|---|
| 1 | `card` | карточка EN→RU (оценка Again/Hard/Good/Easy) | SRS — живёт только в колоде, в уроках не используется |
| 2 | `translate` | переведи фразу RU→EN текстом | production |
| 3 | `speak` | скажи фразу RU→EN голосом | говорение |
| 4 | `word_bank` | собери фразу из слов | порядок слов |
| 5 | `dictation` | диктант: послушай и напиши | слух, орфография |
| 6 | `shadowing` | повтори за диктором в микрофон | произношение |
| 7 | `cloze` | заполни пропуск (в т.ч. в цитате) | грамматика в контексте |
| 8 | `choose_translation` | выбери перевод из 3–4 | recognition |
| 9 | `match_pairs` | найди пары EN↔RU | recognition |
| 10 | `find_error` | найди и исправь ошибку | ловушки |
| 11 | `answer_question` | ответь на вопрос голосом | output; B-27 «на скорости» + info-gap-сцены Q1.3 (specs/02 {#scenes-tbl}): реплика собеседника разговорника (`situation_ru` + `audio`) + `free_form`-самопроверка, эталоны в `answer.accepted` |
| 12 | `dialog` | диалог-сценка из разговорника | разговор в ситуации |
| 13 | `verb_tense` | поставь глагол в нужное время по маркеру | времена |
| 14 | `transform` | трансформация (утверждение → вопрос → отрицание → прошедшее) | drill |

Общие поля: `id` (`ex-<ранг>-<номер>`), `type`, `payload` (свой по типу; начинается с дискриминатора `"kind"` = `type`), `answer` (правила проверки), `meta` (`{ "skill": "words|grammar|listening|speaking", "xp": 5 }`).

**Правила `answer` (общие, из research/03 §3):**

- `accepted: string[]` — эталон и варианты; сравнение после нормализации.
- `normalization` всегда: регистр, лишние пробелы, конечная пунктуация, типографские кавычки; сокращения эквивалентны (`I'm = I am`, `don't = do not`, `can't = cannot`).
- `typo`: `"allow"` — Левенштейн ≤ 1 для слов 4–7 букв, ≤ 2 для 8+, опечатка подсвечивается; `"exact"` — для слов, где опечатка меняет смысл (`a/an/the`, `in/on/at`, `is/are/was`, `he/she`).
- `speech_threshold: 0.85` — доля совпавших слов для распознанной речи (0.80–0.85).
- Кнопка **«Я был прав»** есть у всех типов с автопроверкой: ответ помечается для правки `variants` (фидбек в контент).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:exercise:v1",
  "title": "exercise",
  "type": "object",
  "required": ["id", "type", "payload", "answer", "meta"],
  "additionalProperties": false,
  "properties": {
    "id":   { "type": "string", "pattern": "^ex-(e|d|c|b|a|s)-[0-9]{4}$" },
    "type": { "enum": ["card", "translate", "speak", "word_bank", "dictation", "shadowing",
                       "cloze", "choose_translation", "match_pairs", "find_error",
                       "answer_question", "dialog", "verb_tense", "transform"] },
    "payload": { "oneOf": [
      { "$comment": "2 translate",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "prompt_ru", "phrase_id"],
        "properties": {
          "kind": { "const": "translate" },
          "prompt_ru": { "type": "string" },
          "phrase_id": { "type": "string", "pattern": "^ph-" } } },
      { "$comment": "3 speak",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "prompt_ru", "phrase_id"],
        "properties": {
          "kind": { "const": "speak" },
          "prompt_ru": { "type": "string" },
          "phrase_id": { "type": "string", "pattern": "^ph-" } } },
      { "$comment": "4 word_bank",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "prompt_ru", "phrase_id", "tokens"],
        "properties": {
          "kind": { "const": "word_bank" },
          "prompt_ru": { "type": "string" },
          "phrase_id": { "type": "string" },
          "tokens": { "type": "array", "minItems": 3, "items": { "type": "string" },
                      "description": "слова фразы + 0–2 дистрактора, перемешаны" } } },
      { "$comment": "5 dictation",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "phrase_id"],
        "properties": { "kind": { "const": "dictation" },
                        "phrase_id": { "type": "string" } } },
      { "$comment": "6 shadowing",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "phrase_id"],
        "properties": { "kind": { "const": "shadowing" },
                        "phrase_id": { "type": "string" } } },
      { "$comment": "7 cloze (в т.ч. в цитате)",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "text_with_gap", "gap_answers"],
        "properties": {
          "kind": { "const": "cloze" },
          "text_with_gap": { "type": "string", "description": "пропуск обозначается ___" },
          "gap_answers":   { "type": "array", "minItems": 1, "items": { "type": "string" } },
          "quote": { "type": "object", "additionalProperties": false, "required": ["title", "season_episode"],
                     "properties": { "title": { "type": "string" }, "season_episode": { "type": "string" } } },
          "audio": { "type": "string", "pattern": "^audio/" } } },
      { "$comment": "8 choose_translation",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "prompt", "options", "correct"],
        "properties": {
          "kind": { "const": "choose_translation" },
          "prompt": { "type": "string" },
          "options": { "type": "array", "minItems": 3, "maxItems": 4, "items": { "type": "string" } },
          "correct": { "type": "integer", "minimum": 0, "maximum": 3 } } },
      { "$comment": "9 match_pairs",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "pairs"],
        "properties": { "kind": { "const": "match_pairs" },
                        "pairs": { "type": "array", "minItems": 4, "maxItems": 6,
                                   "items": { "type": "object", "required": ["en", "ru"],
                                              "additionalProperties": false,
                                              "properties": { "en": { "type": "string" }, "ru": { "type": "string" } } } } } },
      { "$comment": "10 find_error",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "wrong_en", "hint_ru", "phrase_id"],
        "properties": {
          "kind": { "const": "find_error" },
          "wrong_en":  { "type": "string" },
          "hint_ru":   { "type": "string" },
          "phrase_id": { "type": "string", "description": "правильная фраза-эталон" },
          "trap_id":   { "type": "string" } } },
      { "$comment": "11 answer_question",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "question_en"],
        "properties": {
          "kind": { "const": "answer_question" },
          "question_en": { "type": "string" },
          "phrase_id":   { "type": "string", "description": "эталонный ответ (phrase); для сценок разговорника (B-27) не задаётся — ответы в answer.accepted" },
          "situation_ru": { "type": "string", "description": "сценка: подпись над репликой собеседника — ситуация + «Задача: …» + «Исход: …» (info-gap/неязыковой исход, план {#teaching-quality} Q1.3, specs/02 {#scenes-tbl})" },
          "free_output": {
            "type": "object", "additionalProperties": false,
            "required": ["seconds", "checklist_ru"],
            "description": "free-output промпт (план {#teaching-quality} Q1.5): монолог без сверки, expected[] не проверяется, исход self_reported",
            "properties": {
              "seconds":     { "type": "integer", "minimum": 30, "maximum": 300 },
              "checklist_ru": { "type": "array", "minItems": 2, "maxItems": 5,
                                "items": { "type": "string", "minLength": 1 } }
            }
          },
          "audio":       { "type": "string", "pattern": "^audio/", "description": "предзаписанная реплика собеседника (audio/phrasebook/…)" },
          "free_form":   { "type": "boolean", "description": "самопроверка «Сказал своими словами» сразу — свобода важнее точности (B-27)" } } },
      { "$comment": "12 dialog",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "dialog_id"],
        "properties": { "kind": { "const": "dialog" },
                        "dialog_id": { "type": "string", "pattern": "^pb-" } } },
      { "$comment": "13 verb_tense",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "sentence_with_gap", "marker", "gap_answers"],
        "properties": {
          "kind": { "const": "verb_tense" },
          "sentence_with_gap": { "type": "string" },
          "marker":  { "type": "string", "description": "маркер времени: yesterday / already / now" },
          "gap_answers": { "type": "array", "minItems": 1, "items": { "type": "string" } } } },
      { "$comment": "14 transform",
        "type": "object", "additionalProperties": false,
        "required": ["kind", "source_phrase_id", "steps"],
        "properties": {
          "kind": { "const": "transform" },
          "source_phrase_id": { "type": "string" },
          "steps": { "type": "array", "minItems": 1, "items": {
            "type": "object", "additionalProperties": false,
            "required": ["task", "phrase_id"],
            "properties": {
              "task": { "enum": ["question", "negative", "past", "future"] },
              "phrase_id": { "type": "string" } } } } } }
    ] },
    "answer": {
      "type": "object", "additionalProperties": false,
      "required": ["normalization", "typo"],
      "properties": {
        "accepted": { "type": "array", "items": { "type": "string" },
                      "description": "если не задано — берётся из variants фразы/поля payload" },
        "normalization": { "enum": ["default"] },
        "typo": { "enum": ["allow", "exact"] },
        "speech_threshold": { "type": "number", "minimum": 0.5, "maximum": 1 },
        "hint_ru": { "type": "string" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false,
      "required": ["skill", "xp"],
      "properties": {
        "skill": { "enum": ["words", "grammar", "listening", "speaking"] },
        "xp": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

Живой пример (`translate`, тип 2):

```json
{
  "id": "ex-e-0017",
  "type": "translate",
  "payload": { "kind": "translate", "prompt_ru": "У вас есть бронь?", "phrase_id": "ph-e-0042" },
  "answer": { "normalization": "default", "typo": "allow" },
  "meta": { "skill": "grammar", "xp": 3 }
}
```

Живой пример (`cloze` в цитате, тип 7):

```json
{
  "id": "ex-e-0031",
  "type": "cloze",
  "payload": {
    "kind": "cloze",
    "text_with_gap": "I ___ do this alone.",
    "gap_answers": ["can't", "cannot", "can not"],
    "quote": { "title": "Supernatural", "season_episode": "S01E01 «Pilot»" },
    "audio": "audio/quotes/cori/q-0001.opus"
  },
  "answer": { "normalization": "default", "typo": "exact",
              "hint_ru": "can't = cannot", "speech_threshold": 0.85 },
  "meta": { "skill": "grammar", "xp": 2 }
}
```

---

## 4. lesson — урок {#schema-lesson} (URI: `data://schema-lesson`)

Структура урока — research/03 §9: правило → разогрев → построение → слух → речь → из сериала → в колоду. Хранится в `data/lessons/lessons-<ранг>.json`.

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | `les-<ранг>-<номер>`, напр. `les-e-01`; **стабилен при переносах** (v2: урок может сменить ранг, id и маршрут — нет) |
| `rank` | enum | ✅ | `E…S` (ранг охотника = CEFR) |
| `order` | integer | — | порядок внутри ранга (программа v2, plan://curriculum-review#V.5): плотная последовательность 1..N; отсутствие поля = фолбэк на номер из id (синтетика в тестах) |
| `module` | string | ✅ | id модуля курса, напр. `mod-e-1` (программа курса — план://M1#course-map) |
| `title` | string | ✅ | название по-русски |
| `grammar_point` | object | ✅ | `{ id, title_ru, rule_md, phrase_ids[], trap_id? }` — короткое правило + фразы точки |
| `vocab_band` | object \| null | ✅ | `{ "list": "ngsl-spoken|ngsl|subtitles", "from": N, "to": M }` — полоса новых слов урока |
| `phrasebook_topic` | string \| null | ✅ | id темы разговорника (`hotel`), если урок связан с ней |
| `trap_id` | string \| null | ✅ | id ловушки из `data/traps.json` (`trap-to-home`) |
| `quotes_topic` | string \| null | ✅ | тег темы для подбора цитат (`family`, `hotel`) |
| `exercises` | array | ✅ | `[{ "id": "ex-e-0017" }]` — упорядоченные ссылки; порядок = порядок в уроке |
| `curiosity` | object | ✅ | `{ hook, cliffhanger }` — curiosity-петля (план {#teaching-quality} Q1.2): `hook` — «любопытная» первая строка шага правила (интрига до чтения `rule_md`), `cliffhanger` — тизер следующей темы на шаге 7 «В колоду» |
| `bebris_video` | object \| null | ✅ | `{ lesson, playlist_index, youtube_id, title }` — «видео по теме» (карта research/04, `youtube_id` из research/04); url собирается при рендере |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:lesson:v1",
  "title": "lesson",
  "type": "object",
  "required": ["id", "rank", "module", "title", "grammar_point", "vocab_band",
               "phrasebook_topic", "trap_id", "quotes_topic", "exercises", "bebris_video",
               "curiosity"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^les-(e|d|c|b|a|s)-[0-9]{2}$" },
    "rank": { "enum": ["E", "D", "C", "B", "A", "S"] },
    "module": { "type": "string", "pattern": "^mod-(e|d|c|b|a|s)-[0-9]+$" },
    "title": { "type": "string", "minLength": 1 },
    "grammar_point": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "title_ru", "rule_md", "phrase_ids"],
      "properties": {
        "id": { "type": "string", "pattern": "^gp-" },
        "title_ru": { "type": "string" },
        "rule_md": { "type": "string", "description": "1 экран по-русски, markdown" },
        "phrase_ids": { "type": "array", "minItems": 3, "items": { "type": "string", "pattern": "^ph-" } },
        "trap_id": { "type": ["string", "null"] }
      }
    },
    "vocab_band": {
      "oneOf": [
        { "type": "null" },
        { "type": "object", "additionalProperties": false,
          "required": ["list", "from", "to"],
          "properties": {
            "list": { "enum": ["ngsl-spoken", "ngsl", "subtitles"] },
            "from": { "type": "integer", "minimum": 1 },
            "to":   { "type": "integer", "minimum": 1 } } }
      ]
    },
    "phrasebook_topic": { "type": ["string", "null"] },
    "trap_id":         { "type": ["string", "null"] },
    "quotes_topic":    { "type": ["string", "null"] },
    "exercises": {
      "type": "array", "minItems": 5,
      "items": { "type": "object", "additionalProperties": false, "required": ["id"],
                 "properties": { "id": { "type": "string", "pattern": "^ex-" } } }
    },
    "bebris_video": {
      "oneOf": [
        { "type": "null" },
        { "type": "object", "additionalProperties": false,
          "required": ["lesson", "playlist_index", "youtube_id", "title"],
          "properties": {
            "lesson": { "type": "string" },
            "playlist_index": { "type": ["integer", "null"] },
            "youtube_id": { "type": ["string", "null"] },
            "title": { "type": ["string", "null"] } } }
      ]
    },
    "curiosity": {
      "type": "object", "additionalProperties": false,
      "required": ["hook", "cliffhanger"],
      "description": "Curiosity-петля (план {#teaching-quality} Q1.2)",
      "properties": {
        "hook": { "type": "string", "minLength": 1, "description": "любопытная первая строка шага правила" },
        "cliffhanger": { "type": "string", "minLength": 1, "description": "тизер следующей темы на шаге 7" }
      }
    }
  }
}
```

Живой пример (фрагмент урока E-ранга):

```json
{
  "id": "les-e-01",
  "rank": "E",
  "module": "mod-e-1",
  "title": "to be: am / is / are. Знакомство",
  "grammar_point": {
    "id": "gp-e-01",
    "title_ru": "Глагол to be в настоящем времени",
    "rule_md": "**I am** Ivan. — Я Иван. **She is** from Japan. — Она из Японии. … (формат Q-фазы: пример до термина, формула, контраст с русским, «Проверь себя»)",
    "phrase_ids": ["ph-e-0001", "ph-e-0002", "ph-e-0003", "ph-e-0004", "ph-e-0005"],
    "trap_id": "trap-no-to-be"
  },
  "vocab_band": { "list": "ngsl-spoken", "from": 1, "to": 50 },
  "phrasebook_topic": null,
  "trap_id": "trap-no-to-be",
  "quotes_topic": "family",
  "exercises": [
    { "id": "ex-e-0001" }, { "id": "ex-e-0002" }, { "id": "ex-e-0003" },
    { "id": "ex-e-0004" }, { "id": "ex-e-0005" }, { "id": "ex-e-0006" }
  ],
  "bebris_video": { "lesson": "1.26", "playlist_index": null, "youtube_id": null, "title": null },
  "curiosity": {
    "hook": "В «я — Иван» русского глагола нет. Английский без глагола обойтись не может — и это меняет всё.",
    "cliffhanger": "Дальше: как одним словом «a» превратить «человека» в «человека вообще» — и почему это слышно."
  }
}
```

(`youtube_id` — из research/04; `url` видео собирается при рендере.)

---

## 5. quote — цитата {#schema-quote} (URI: `data://schema-quote`)

Поля **точно повторяют** `research/data/quotes-ru-merged.json` (274 записи; все поля кроме `note`/`translation_ru` присутствуют у каждой записи) + добавляются `id` и опциональные `link_playphrase` / `audio`. Правила отбора: короткие реплики, источник обязателен, ≤ 40–60 на тайтл, только текст (без видео/аудио/песен) — research/05.

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | `q-<тайтл>-<номер>`, напр. `q-supernatural-0007`; нумерация сквозная по тайтлу, правило **append-only**: новые цитаты добавляются в конец тайтла, существующие номера не переиспользуются и не сдвигаются (на id опирается прогресс M4) |
| `title` | string | ✅ | тайтл («Supernatural») |
| `source_url` | string (uri) | ✅ | Wikiquote / IMDb / подборка |
| `season_episode` | string | ✅ | `S01E01 «Pilot»` |
| `speaker` | string | ✅ | персонаж |
| `text` | string | ✅ | реплика EN |
| `translation_ru` | string | ✅* | перевод; обязателен в `data/quotes/` — M3 дозаполняет 148 записей (в merged-файле есть у 126/274) |
| `grammar_tags` | string[] | ✅ | `can/can't`, `Present Simple (negative)`… |
| `est_rank` | enum | ✅ | `E…S` (ручная проверка авто-оценки, теггер ошибается в 10–20%) |
| `auto_vocab` | object | ✅ | `{ "top1000": 0.0–1.0 }` — доля слов из топ-1000, показ цитаты при ≥ 0.9; `null` у 94/274 — M3 дозаполняет |
| `confidence` | string | ✅ | фактические значения: `verbatim (Wikiquote)`, `verbatim (parallel research) — needs source check`, `verbatim (IMDb)`, `Polygon`, `KYM`; значение `fragment` появится после курации |
| `note` | string | — | комментарий курации (уже встречается в merged-файле, 69 шт.) |
| `link_playphrase` | string (uri) | — | «послушать в оригинале»: поиск фразы на PlayPhrase.me — короткий клип с моментом сцены (кнопка 🎬 на /#/listen, план M.1) |
| `link_image` | string | — | кадр/GIF сцены к фразе (план M.3): путь `media/scenes/<тайтл>/<id>.webp` — файлы лежат в `public/media/scenes/` **вне git** (авторские права: в публичный прод не попадают); при отсутствии файла UI скрывает блок (деградация) |
| `link_video` | string (uri) | — | YouTube-момент (`watch?v=…&t=SS`), проверяется oEmbed валидатором `npm run validate:links` (план M.1; пока не заполнено) |
| `audio` | object | — | `{ "en_gb": "<путь>" }` — путь в `audio/` |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:quote:v1",
  "title": "quote",
  "type": "object",
  "required": ["id", "title", "source_url", "season_episode", "speaker", "text", "translation_ru",
               "grammar_tags", "est_rank", "auto_vocab", "confidence"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^q-[a-z0-9-]+$" },
    "title": { "type": "string", "minLength": 1 },
    "source_url": { "type": "string", "format": "uri" },
    "season_episode": { "type": "string", "minLength": 1 },
    "speaker": { "type": "string", "minLength": 1 },
    "text": { "type": "string", "minLength": 1 },
    "translation_ru": { "type": "string", "minLength": 1 },
    "grammar_tags": { "type": "array", "items": { "type": "string" } },
    "est_rank": { "enum": ["E", "D", "C", "B", "A", "S"] },
    "auto_vocab": {
      "type": "object", "additionalProperties": false,
      "required": ["top1000"],
      "properties": { "top1000": { "type": "number", "minimum": 0, "maximum": 1 } }
    },
    "confidence": { "type": "string", "minLength": 1 },
    "note": { "type": "string" },
    "link_playphrase": { "type": "string", "format": "uri" },
    "audio": {
      "type": "object",
      "required": ["en_gb"],
      "additionalProperties": false,
      "properties": { "en_gb": { "type": "string", "pattern": "^audio/" } }
    }
  }
}
```

Живой пример (запись №1 merged-файла + новые поля; перевод иллюстративный до курации M3):

```json
{
  "id": "q-supernatural-0007",
  "title": "Supernatural",
  "source_url": "https://en.wikiquote.org/wiki/Supernatural_(season_1)",
  "season_episode": "S01E01 «Pilot»",
  "speaker": "Dean",
  "text": "I can't do this alone.",
  "translation_ru": "Я не могу делать это один.",
  "grammar_tags": ["can/can't"],
  "est_rank": "E",
  "auto_vocab": { "top1000": 1.0 },
  "confidence": "verbatim (Wikiquote)",
  "link_playphrase": "https://www.playphrase.me/#/search?q=I%20can%27t%20do%20this%20alone"
}
```

---

## 6. phrasebook_dialog — диалог разговорника {#schema-phrasebook-dialog} (URI: `data://schema-phrasebook-dialog`)

Сценка «ты в ситуации» (research/02 §4: аэропорт → … → экстренные ситуации; диалоги A1–B1). Реплики собеседника озвучены, пользователь отвечает (упражнение `dialog`, тип 12).

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | `pb-<тема>-<номер>` |
| `rank` | enum | ✅ | ранг, с которого доступна |
| `topic` | string | ✅ | глава (`airport`, `hotel`) = имя файла в `data/phrasebook/` |
| `situation_ru` | string | ✅ | «Регистрация на рейс: ты на стойке» |
| `user_role` | string | ✅ | роль пользователя (`passenger`) |
| `lines` | array | ✅ | реплики по порядку |

Реплика: `{ "role": "npc|passenger", "text_en", "translation_ru", "accepted?" }`; для реплик пользователя (`role = user_role`) поле `accepted: string[]` (≥ 1 вариант) обязательно — по нему идёт проверка (нормализация + `typo: "allow"`, распознанная речь — `speech_threshold`). Опциональное `chunk_slot` у реплик пользователя — чанк-разметка Q2.2 (как у phrase, §2).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:phrasebook-dialog:v1",
  "title": "phrasebook_dialog",
  "type": "object",
  "required": ["id", "rank", "topic", "situation_ru", "user_role", "lines"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^pb-[a-z]+-[0-9]{2}$" },
    "rank": { "enum": ["E", "D", "C", "B", "A", "S"] },
    "topic": { "type": "string", "pattern": "^[a-z-]+$" },
    "situation_ru": { "type": "string", "minLength": 1 },
    "user_role": { "type": "string", "minLength": 1 },
    "lines": {
      "type": "array", "minItems": 3,
      "items": {
        "type": "object",
        "required": ["role", "text_en", "translation_ru"],
        "additionalProperties": false,
        "properties": {
          "role": { "type": "string" },
          "text_en": { "type": "string", "minLength": 1 },
          "translation_ru": { "type": "string", "minLength": 1 },
          "accepted": { "type": "array", "minItems": 1, "items": { "type": "string" } }
        }
      }
    }
  }
}
```

Живой пример (фрагмент):

```json
{
  "id": "pb-hotel-01",
  "rank": "D",
  "topic": "hotel",
  "situation_ru": "Регистрация в отеле: ты у стойки",
  "user_role": "guest",
  "lines": [
    { "role": "receptionist", "text_en": "Good evening. Do you have a reservation?",
      "translation_ru": "Добрый вечер. У вас есть бронь?" },
    { "role": "guest", "text_en": "Yes, I have a reservation. My name is Ivan.",
      "translation_ru": "Да, у меня бронь. Меня зовут Иван.",
      "accepted": ["Yes, I have a reservation. My name is Ivan.",
                   "Yes, I do. My name is Ivan.", "Yes. I have a booking. My name is Ivan."] },
    { "role": "receptionist", "text_en": "Perfect. Room 204, here is your key card.",
      "translation_ru": "Отлично. Комната 204, вот ваша ключ-карта." }
  ]
}
```

---

## 6.5. trap — ловушка русскоязычного {#schema-trap} (URI: `data://schema-trap`)

Запись каталога ловушек `data/traps.json` (`kind: traps`; номера каталога — `research/03 §4`, соответствие ЛТ ↔ slug — [§0](#data-common)). На ловушку ссылаются уроки (`lesson.trap_id`, `grammar_point.trap_id`) и упражнение `find_error` (`payload.trap_id`).

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `id` | string | ✅ | slug `trap-<основа>`, напр. `trap-no-to-be` |
| `lt_id` | string | ✅ | номер каталога из research/03 §4, напр. `ЛТ-01` |
| `title_ru` | string | ✅ | короткое название ловушки по-русски |
| `wrong_en` | string | ✅ | типичная ошибка |
| `right_en` | string | ✅ | правильный вариант |
| `explanation_ru` | string | ✅ | короткое объяснение по-русски |
| `tags` | string[] | ✅ | теги темы (`to-be`, `preposition`, …) |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:hunter-english:data:trap:v1",
  "title": "trap",
  "type": "object",
  "required": ["id", "lt_id", "title_ru", "wrong_en", "right_en", "explanation_ru", "tags"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^trap-[a-z0-9-]+$" },
    "lt_id": { "type": "string", "pattern": "^ЛТ-[0-9]{2}$", "description": "номер ловушки в каталоге research/03 §4" },
    "title_ru": { "type": "string", "minLength": 1 },
    "wrong_en": { "type": "string", "description": "типичная ошибка" },
    "right_en": { "type": "string", "description": "правильный вариант" },
    "explanation_ru": { "type": "string", "description": "короткое объяснение по-русски" },
    "tags": { "type": "array", "items": { "type": "string" } }
  }
}
```

Живой пример:

```json
{
  "id": "trap-no-to-be",
  "lt_id": "ЛТ-01",
  "title_ru": "Пропуск to be",
  "wrong_en": "I hungry.",
  "right_en": "I'm hungry.",
  "explanation_ru": "В английском нельзя сказать «я голоден» без глагола-связки: в настоящем времени нужен am/is/are.",
  "tags": ["to-be"]
}
```

---

## 7. Версионирование данных {#data-versioning}

- `schema_version: <int>` — в **каждом** файле данных (в обёртке, [§0](#data-common)). Старт — `1`.
- **Мажорный** шаг (`1 → 2`): несовместимое изменение схемы (удалено/переименовано поле, сменён формат id). Требует миграции прогресса (card_id стабильны — менять только с конверсией в Dexie и на сервере) и обновления всех файлов разом.
- **Минорные** изменения (новое опциональное поле, новые элементы) версию схемы файла **не** поднимают — схемы данных аддитивны.
- Правило совместимости приложения: код поддерживает текущую и предыдущую мажорные версии; файл с неизвестной версией → предупреждение и отказ от загрузки (не молча).
- Контентные правки (перевод, новая цитата, новый урок) — просто новые коммиты в `data/`, версия не меняется; откат — средствами git.
- `content_version: <int>` — в `data/manifest.json` (с генератора `build_manifest.py`): маркер **эпохи программы**. v2 = Past Simple в D / going to → will / ранг A с консолидации (plan://curriculum-review#V.5; в эпоху v2 же добавлен урок B-27, ранг B = 30); v1 — исходная раскладка. На миграцию прогресса не влияет (id стабильны) — это семафор для кэшей и ревью.
- Манифест сборки (`data/manifest.json`, генерируется пайплайном M3): список файлов, их `schema_version`, количество записей, дата сборки — по нему приложение понимает, что докэшировать (PWA).

## 8. Пайплайн подготовки (M3) {#data-pipeline}

Детализация и код — план://M3 (M3: Пайплайн данных). Здесь — контракт: что подаётся на вход, что выходит.

```
NGSL-Spoken (719) ─┐
NGSL 1.2 (2809)  ──┼→ target_words_full.txt (union, build_target_words.py --full) → kaikki (Wiktionary, CC BY-SA)
FrequencyWords   ──┘        │                       │
                             ▼                       ▼
                    авто-отбор 1–3 переводов   ручная курация (топ-1000 — всё вручную)
                             └──────────┬──────────┘
                                        ▼
                     data/words/*.json (schema 05 §1) + примеры из Tatoeba/цитат/уроков
                                        ▼
                     аудио: Piper cori + Kokoro bm_george → audio/ (Opus, ~75 МБ)
```

Уже скачано в `data/raw/` (в git не попадает):

| Файл | Что | Статус |
|---|---|---|
| `raw/ngsl/NGSL_12_stats.csv` | NGSL 1.2, 2 809 лемм с частотным рангом (в тексте проекта исторически фигурирует 2806 — канон по CSV) | ✅ |
| `raw/ngsl/NGSL-Spoken_12_stats.csv` | NGSL-Spoken, 719 лемм | ✅ |
| `raw/frequencywords/en_50k.txt` | субтитры OpenSubtitles, 50k (MIT) | ✅ |
| `raw/oxford/full-word.json` | Oxford 5000 (word, POS, CEFR, mp3) — **только локально, © OUP, не публиковать** | ✅ |
| `raw/kaikki/target_words.txt` | 1 800 целевых слов для перевода | ✅ |
| `raw/kaikki/words/*.jsonl` | ответы kaikki по слову (лог `fetch.log`) | 🔄 качается (~180/1800 на 2026-09-27) |

Этапы (реализация M3, `research/tools/`): автоотбор переводов kaikki → CURATED-слой ручной курации (`build_words.py`: функциональные леммы — одна запись с главной POS, ручные переводы/примеры; топ-1000 покрывается курацией) → сборка файлов `data/words/` фиксированными диапазонами → примеры (Tatoeba CC BY 2.0 FR, цитаты) → **CEFR выводится только из частотного ранга** (Oxford-разметка не используется и не публикуется — Watch out в WAL) → генерация аудио (Piper cori, гейт длительности 0.3–2.5 с) → `manifest.json` (с sha256 файлов). Атрибуция всех источников — `CREDITS.md`; производные словарные данные — CC BY-SA 4.0 (требование ShareAlike Wiktionary/NGSL).

Цитаты: из `research/data/quotes-ru-merged.json` (274, источник) → досев и курация до ~300 для MVP → разбивка по тайтлам в `data/quotes/`, дозаполнение `translation_ru`, добавление `link_playphrase`, ручная сверка `est_rank`.

## 9. Валидация перед коммитом {#data-validation}

- **Инструмент:** ajv (draft-07), скрипт `scripts/validate-data.mjs` + `npm run validate:data` — **код появляется в M2** (там же ajv попадает в devDependencies). До M2 валидация — прогон схем из этой спеки вручную/разово.
- Что проверяет (два слоя):
  1. **Схемы (ajv):** каждый файл `data/**/*.json` — против обёртки ([§0](#data-common)); каждый элемент `items` — против схемы своего `kind` (§1–§6). Формат `format: "uri"` — с ajv-formats.
  2. **Кросс-ссылки (свой код в скрипте, ajv это не умеет):** `lesson.exercises[].id` существуют в `exercises-*.json`; `grammar_point.phrase_ids` и `payload.phrase_id` существуют в `phrases-*.json`; `trap_id` есть в `traps.json`; `audio.*` файлы существуют на диске; `quotes_topic`/`phrasebook_topic` известны (при появлении lessons/phrasebook — M5/M8); у каждой цитаты `auto_vocab.top1000 ≥ 0.9` — информативная отметка готовности к показу. Проверки манифеста и уникальности id по всем сущностям — реализованы (M3).
- **CI:** шаг `npm run validate:data` в GitHub Actions до деплоя; падение валидации = коммит в `data/` не проходит PR. Pre-commit hook — тот же скрипт только по изменённым файлам (не реализован; правки data/ проходят через CI-шаг в PR).
- Exit code ≠ 0 + список ошибок с путями `файл#/items/3/translation_ru` — без «warnings, которые можно игнорировать».

---

## Открытые вопросы {#data-open-questions}

1. ~~`translation_ru` цитаты~~ — ЗАКРЫТО в M3: все 274 записи имеют перевод; 148 дозаполненных помечены `note: "translation needs review"` (сверка при курации M8/M11).
2. `link_playphrase`: hash-URL поиска PlayPhrase не документирован — проверить стабильность ссылок; возможен фолбэк на getyarn.io.
3. Формат `vocab_band`: объект `{list, from, to}` vs строковый id полосы — финализируется в программе курса (plan://M1#course-map).
4. ~~Слова вне NGSL-Spoken~~ — ЗАКРЫТО в M3: `freq_rank_spoken` отсутствует у не-spoken слов; у spoken-only лемм (без ранга NGSL) `freq_rank_ngsl` = sentinel `100000+spoken_rank`, файл `words-spoken-only.json`; сортировка в UI — по `freq_rank_spoken ?? freq_rank_ngsl`.
5. ~~Разбивка `data/words/`~~ — ЗАКРЫТО в M3: фиксированные диапазоны `freq_rank_ngsl` (см. §0), имена файлов стабильны при пересборках.
6. ~~Каталог `traps.json`~~ — ЗАКРЫТО в M3: полная схема §6.5.
7. Аудио для цитат/фраз: слова — в репо (`audio/words/cori`, ~17 МБ на 4 тыс. записей); при росте (цитаты/фразы в M6+) — GitHub Releases; валидатору заложить режим `VALIDATE_AUDIO=local|remote|off` до переезда.
