#!/usr/bin/env python3
"""Сборка data/vocab/travel.json — мини-словарь путешественника (plan://travel-vocab#V.1).

Источник: research/data/travel-vocab-draft.json (черновик из внешнего ресёрча
study_eng, 487 слов / 9 тем). Слова связываются с датасетом data/words/*.json
по лемме: совпадение → готовое аудио audio/words/cori/<id>.opus; многословные
и несовпавшие записи остаются без audio (экран озвучит их Web Speech).
Запуск из корня репозитория: python3 research/tools/vocab/build_travel_vocab.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DRAFT = ROOT / "research/data/travel-vocab-draft.json"
WORDS = ROOT / "data/words"
OUT = ROOT / "data/vocab/travel.json"


def lemma_index():
    """lemma.lower() → (id, rank); при повторах леммы побеждает частотный ранг."""
    best: dict[str, tuple[str, int]] = {}
    for path in sorted(WORDS.glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            key = item["lemma"].casefold()
            rank = item.get("freq_rank_ngsl") or item.get("freq_rank_spoken") or 10**9
            if key not in best or rank < best[key][1]:
                best[key] = (item["id"], rank)
    return best


def main():
    draft = json.loads(DRAFT.read_text(encoding="utf-8"))
    index = lemma_index()
    items, matched = [], 0
    for topic in draft["topics"]:
        for word in topic["words"]:
            # варианты «lift/elevator» озвучиваем по первому — читается то же слово
            candidate = word["en"].split("/")[0].strip().casefold()
            hit = index.get(candidate)
            entry = {"topic": topic["id"], "en": word["en"], "ru": word["ru"]}
            if hit:
                entry["audio"] = f"audio/words/cori/{hit[0]}.opus"
                matched += 1
            items.append(entry)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"schema_version": 1, "kind": "vocab", "items": items},
                   ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    total = len(items)
    print(f"записей: {total}, с аудио: {matched} ({matched * 100 // total}%), без аудио (TTS): {total - matched}")
    unmatched = sorted({w['en'] for w in items if 'audio' not in w})[:20]
    print("примеры без аудио:", ", ".join(unmatched))


if __name__ == "__main__":
    main()
