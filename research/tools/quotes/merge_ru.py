#!/usr/bin/env python3
"""Слияние: quotes-sample.json (без переводов) + цитаты с RU из параллельного ресёрча.

Выход: research/data/quotes-ru-merged.json
- к существующим записям добавляется translation_ru (по совпадению нормализованного текста);
- уникальные записи из параллельного ресёрча добавляются в конец с пометкой needs source check.
Запуск из корня репозитория: python3 research/tools/quotes/merge_ru.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if len(sys.argv) < 2:
    sys.exit("использование: python3 research/tools/quotes/merge_ru.py <путь к 05-universes-quotes.md>")
SRC_MD = Path(sys.argv[1])
SAMPLE = ROOT / "research/data/quotes-sample.json"
OUT = ROOT / "research/data/quotes-ru-merged.json"

TITLE_MAP = [
    ("Supernatural", "Supernatural"),
    ("Game of Thrones", "Game of Thrones"),
    ("Breaking Bad", "Breaking Bad"),
    ("Stranger Things", "Stranger Things"),
    ("Black Mirror", "Black Mirror"),
    ("Lord of the Rings", "Lord of the Rings"),
    ("Star Wars", "Star Wars"),
    ("Fullmetal Alchemist", "FMA / FMA:B"),
    ("Berserk", "Berserk"),
    ("Attack on Titan", "Attack on Titan"),
    ("Jujutsu Kaisen", "Jujutsu Kaisen"),
    ("Solo Leveling", "Solo Leveling"),
]
LEVEL_TO_RANK = {"A1": "E", "A2": "D", "B1": "C"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_en(s: str) -> str:
    s = s.replace("✅", "").replace("🎬", "").strip()
    # служебные пометки вида "(сокр. ориг.)", "(ru-источник: ...)"
    s = re.sub(r"\s*\((?:сокр|ru-источник|фан-вики|эпитет|команда|дубляж|ответ)[^)]*\)", "", s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s.strip()


def map_title(section: str) -> str | None:
    for key, title in TITLE_MAP:
        if key.lower() in section.lower():
            return title
    return None


def parse_md(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    section, out, in_top = None, [], False
    for ln in lines:
        m = re.match(r"^##\s+(\d+)\.\s+(.+?)\s*$", ln)
        if m:
            section = m.group(2)
            in_top = section.upper().startswith(("ТОП", "СВОДКА"))
            continue
        if section is None or in_top:
            continue
        if not ln.strip().startswith("|"):
            continue
        cols = [c.strip() for c in ln.strip().strip("|").split("|")]
        if len(cols) < 7 or cols[0] in ("#", "---", ":---:"):
            continue
        if not re.match(r"^\d+$", cols[0]):
            continue
        en = clean_en(cols[1])
        if not en or len(en) < 2:
            continue
        who = re.sub(r"[✅🎬]", "", cols[2]).strip()
        out.append({
            "title": map_title(section),
            "section": section,
            "text": en,
            "who": who,
            "translation_ru": cols[3].strip(),
            "level": cols[5].strip(),
            "grammar": cols[6].strip(),
        })
    return out


def main():
    if not SRC_MD.exists():
        sys.exit(f"нет файла {SRC_MD}")
    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))
    mine = parse_md(SRC_MD)
    print(f"распарсено из md: {len(mine)}, в sample: {len(sample)}")

    by_key = {}
    for q in sample:
        by_key.setdefault((q.get("title"), norm(q.get("text", ""))), q)

    matched, added, used = 0, 0, set()
    for q in mine:
        if not q["title"]:
            continue
        key = (q["title"], norm(q["text"]))
        hit = by_key.get(key)
        if hit is None:  # пробуем частичное совпадение (у них фрагменты)
            for (t, n), rec in by_key.items():
                if t == q["title"] and n and (n in norm(q["text"]) or norm(q["text"]) in n):
                    hit = rec
                    break
        if hit is not None:
            if "translation_ru" not in hit:
                hit["translation_ru"] = q["translation_ru"]
                matched += 1
            used.add(id(hit))
        else:
            sample.append({
                "title": q["title"],
                "source_url": None,
                "season_episode": q["who"],
                "speaker": q["who"].split("(")[0].strip() or None,
                "text": q["text"],
                "translation_ru": q["translation_ru"],
                "grammar_tags": [g.strip() for g in re.split(r"[;,]", q["grammar"]) if g.strip()],
                "est_rank": LEVEL_TO_RANK.get(q["level"], "D"),
                "auto_vocab": None,
                "confidence": "verbatim (parallel research) — needs source check",
            })
            added += 1

    with_ru = sum(1 for q in sample if q.get("translation_ru"))
    OUT.write_text(json.dumps(sample, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"переводов добавлено к существующим: {matched}")
    print(f"новых записей из параллельного ресёрча: {added}")
    print(f"итого в {OUT.name}: {len(sample)}, с переводом: {with_ru}")
    per_title: dict[str, int] = {}
    for q in sample:
        per_title[q["title"]] = per_title.get(q["title"], 0) + 1
    for t, n in sorted(per_title.items()):
        flag = " ⚠ >60" if n > 60 else ""
        print(f"  {t}: {n}{flag}")


if __name__ == "__main__":
    main()
