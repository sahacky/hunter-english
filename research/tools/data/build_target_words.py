#!/usr/bin/env python3
"""Целевой список слов для сбора переводов.

Без флага (режим M0.5): NGSL-Spoken (все) + NGSL до ~1800 суммарно,
выход data/raw/kaikki/target_words.txt.
С флагом --full: union всех лемм NGSL-Spoken и NGSL (без лимита 1800),
выход data/raw/kaikki/target_words_full.txt.

Выход: по одному слову на строку, lowercase.
"""
import argparse
import csv
import re
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / "data/raw"
TARGET_TOTAL = 1800


def read_stats(p: Path, keep_bad_rank: bool = False) -> list[tuple[str, int]]:
    rows, bad = [], 0
    with p.open(encoding="utf-8-sig") as f:
        for r in csv.reader(f):
            if not r or r[0].lower() == "lemma":
                continue
            lemma = r[0].strip()
            if not re.fullmatch(r"[a-z][a-z'-]*", lemma):
                continue
            try:
                rank = int(r[1])
            except ValueError:
                if not keep_bad_rank:
                    continue
                bad += 1
                rank = 10**6 + len(rows)
            rows.append((lemma, rank))
    if bad:
        print(f"{p.name}: слов без ранга оставлено: {bad}")
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Целевой список слов из NGSL")
    ap.add_argument("--full", action="store_true",
                    help="union всех лемм NGSL-Spoken и NGSL -> target_words_full.txt")
    ap.add_argument("--sub5000", action="store_true",
                    help="полный набор до ~5000: NGSL+Spoken плюс топ FrequencyWords "
                         "en_50k (субтитры) -> target_words_sub5000.txt (plan://M11#11.5)")
    args = ap.parse_args()

    spoken = read_stats(RAW / "ngsl/NGSL-Spoken_12_stats.csv", keep_bad_rank=True)
    ngsl = read_stats(RAW / "ngsl/NGSL_12_stats.csv")
    spoken_set = {w for w, _ in spoken}

    if args.sub5000:
        base = {w for w, _ in spoken} | {w for w, _ in ngsl}
        # en_50k: «token count» по субтитрам (не лемматизирован — best effort,
        # решение M11#5: токены без kaikki-перевода отсеются дальше по пайплайну)
        sub = []
        with (RAW / "frequencywords/en_50k.txt").open(encoding="utf-8") as f:
            for line in f:
                parts = line.split()
                if len(parts) != 2:
                    continue
                word = parts[0].lower()
                if not re.fullmatch(r"[a-z][a-z'-]*", word):
                    continue
                if word in base:
                    continue
                sub.append(word)
                base.add(word)
                if len(base) >= 5000:
                    break
        out = RAW / "kaikki/target_words_sub5000.txt"
        out.write_text("\n".join(sorted(base)) + "\n", encoding="utf-8")
        print(f"spoken: {len(spoken)}, ngsl: {len(ngsl)}, +субтитры: {len(sub)}")
        print(f"цель: {len(base)} слов -> {out}")
        return

    if args.full:
        target = {w for w, _ in spoken} | {w for w, _ in ngsl}
        out = RAW / "kaikki/target_words_full.txt"
    else:
        rest = [w for w, _ in sorted(ngsl, key=lambda x: x[1]) if w not in spoken_set]
        target = [w for w, _ in spoken] + rest[: max(0, TARGET_TOTAL - len(spoken_set))]
        out = RAW / "kaikki/target_words.txt"

    out.write_text("\n".join(sorted(set(target))) + "\n", encoding="utf-8")
    print(f"spoken: {len(spoken)}, ngsl всего: {len(ngsl)}")
    print(f"цель: {len(set(target))} уникальных слов -> {out}")


if __name__ == "__main__":
    main()
