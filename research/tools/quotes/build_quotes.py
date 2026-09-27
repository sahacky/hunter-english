#!/usr/bin/env python3
"""Сборка data/quotes/*.json из research/data/quotes-ru-merged.json (plan://M3#3.5).

Контракт: specs/05-data-formats.md §0 (обёртка {schema_version, kind, items}), §5 (quote), §9 (валидация).
- id: q-<slug>-NNNN, нумерация с 1 внутри тайтла в исходном порядке (NNNN — 4 знака);
- slug тайтла: lowercase, кириллица → латиница (игры → igry), не-алфанум → «-», дефисы сжимаются;
- тайтл с >60 записями делится на файлы <slug>-1.json, <slug>-2.json (≤60 в каждом);
- auto_vocab: если null — доля слов (не уникальных) реплики из топ-1000 NGSL
  (data/raw/ngsl/NGSL_12_stats.csv, колонка 1 = lemma, ранг = строка после заголовка), 2 знака;
- link_playphrase: поиск реплики на PlayPhrase.me;
- translation_ru: из записи, иначе из research/data/quotes-ru-backfill.json (ключ "<title>||<text>"),
  иначе "" (плейсхолдер; счётчик печатается). Перевод из backfill → пометка "translation needs review" в note.
Запуск из корня репозитория: python3 research/tools/quotes/build_quotes.py
"""
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "research/data/quotes-ru-merged.json"
BACKFILL = ROOT / "research/data/quotes-ru-backfill.json"
NGSL = ROOT / "data/raw/ngsl/NGSL_12_stats.csv"
OUT_DIR = ROOT / "data/quotes"

MAX_PER_FILE = 60
CYR = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}
# Страница-источник по умолчанию для записей параллельного ресёрча (source_url = null).
FALLBACK_URL = {
    "Supernatural": "https://en.wikiquote.org/wiki/Supernatural",
    "Game of Thrones": "https://en.wikiquote.org/wiki/Game_of_Thrones",
    "Breaking Bad": "https://en.wikiquote.org/wiki/Breaking_Bad",
    "Stranger Things": "https://en.wikiquote.org/wiki/Stranger_Things",
    "Black Mirror": "https://en.wikiquote.org/wiki/Black_Mirror",
    "Lord of the Rings": "https://en.wikiquote.org/wiki/The_Lord_of_the_Rings",
    "Star Wars": "https://en.wikiquote.org/wiki/Star_Wars",
    "FMA / FMA:B": "https://en.wikiquote.org/wiki/Fullmetal_Alchemist",
    "Berserk": "https://en.wikiquote.org/wiki/Berserk_(anime)",
    "Attack on Titan": "https://en.wikiquote.org/wiki/Attack_on_Titan",
    "Jujutsu Kaisen": "https://screenrant.com/best-jujutsu-kaisen-quotes/",
    "Solo Leveling": "https://screenrant.com/solo-leveling-best-jinwoo-quotes/",
    "The 100": "https://en.wikiquote.org/wiki/The_100_(TV_series)",
    "Игры": "https://www.polygon.com/best-video-game-quotes/",
    "Мемы": "https://knowyourmeme.com",
}
# Уточнённые источники для отдельных записей (мемы живут каждый на своей странице KYM).
URL_OVERRIDES = {
    "Мемы||I'm gonna do what's called a pro gamer move.":
        "https://knowyourmeme.com/memes/pro-gamer-move",
    "Мемы||Is this a pigeon?": "https://knowyourmeme.com/memes/is-this-a-pigeon",
}


def slugify(title: str) -> str:
    s = "".join(CYR.get(ch, ch) for ch in title.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-{2,}", "-", s).strip("-")


def load_top1000() -> set[str]:
    with NGSL.open(encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    return {row[0].strip().lower() for row in rows[1:1001] if row}


def auto_vocab_top1000(text: str, top: set[str]) -> float:
    words = re.findall(r"[a-z']+", text.lower())
    if not words:
        return 0.0
    return round(sum(1 for w in words if w in top) / len(words), 2)


def chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    backfill = json.loads(BACKFILL.read_text(encoding="utf-8")) if BACKFILL.exists() else {}
    top = load_top1000()

    titles: list[str] = []
    by_title: dict[str, list[dict]] = {}
    for q in data:
        if q["title"] not in by_title:
            by_title[q["title"]] = []
            titles.append(q["title"])
        by_title[q["title"]].append(q)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stats = {"files": 0, "items": 0, "ru_had": 0, "ru_backfill": 0, "ru_empty": 0,
             "vocab_filled": 0, "url_fallback": 0}

    for title in titles:
        slug = slugify(title)
        groups = chunk(by_title[title], MAX_PER_FILE)
        for gi, group in enumerate(groups, start=1):
            name = f"{slug}.json" if len(groups) == 1 else f"{slug}-{gi}.json"
            items = []
            for n, q in enumerate(group, start=1):
                had_ru = bool(q.get("translation_ru"))
                ru = q.get("translation_ru") or ""
                note = q.get("note")
                if not had_ru:
                    key = f"{title}||{q['text']}"
                    hit = backfill.get(key)
                    if hit:
                        ru = hit
                        stats["ru_backfill"] += 1
                        add = "translation needs review"
                        note = f"{note}; {add}" if note else add
                    else:
                        stats["ru_empty"] += 1
                else:
                    stats["ru_had"] += 1
                auto = q.get("auto_vocab")
                if auto is None:
                    auto = {"top1000": auto_vocab_top1000(q["text"], top)}
                    stats["vocab_filled"] += 1
                url = q.get("source_url") or URL_OVERRIDES.get(f"{title}||{q['text']}") \
                    or FALLBACK_URL.get(title)
                if not q.get("source_url"):
                    stats["url_fallback"] += 1
                item = {
                    "id": f"q-{slug}-{n:04d}",
                    "title": title,
                    "source_url": url,
                    "season_episode": q["season_episode"],
                    "speaker": q["speaker"],
                    "text": q["text"],
                    "translation_ru": ru,
                    "grammar_tags": q.get("grammar_tags", []),
                    "est_rank": q["est_rank"],
                    "auto_vocab": auto,
                    "confidence": q["confidence"],
                }
                if note:
                    item["note"] = note
                item["link_playphrase"] = f"https://www.playphrase.me/#/search?q={quote(q['text'], safe='')}"
                items.append(item)
                stats["items"] += 1
            (OUT_DIR / name).write_text(
                json.dumps({"schema_version": 1, "kind": "quotes", "items": items},
                           ensure_ascii=False, indent=1) + "\n",
                encoding="utf-8")
            stats["files"] += 1

    print(f"файлов: {stats['files']} в {OUT_DIR}/")
    print(f"записей: {stats['items']}")
    print(f"переводов: было {stats['ru_had']}, добавлено из backfill {stats['ru_backfill']}, "
          f"осталось пустыми {stats['ru_empty']}")
    print(f"auto_vocab дозаполнено: {stats['vocab_filled']}")
    print(f"source_url из фолбэка по тайтлу: {stats['url_fallback']}")
    if stats["ru_empty"]:
        print("⚠ записи без перевода — заполни research/data/quotes-ru-backfill.json и перезапусти",
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
