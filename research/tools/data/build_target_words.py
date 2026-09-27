#!/usr/bin/env python3
"""Целевой список слов для M0.5: NGSL-Spoken (все) + NGSL до ~1800 суммарно.

Выход: data/raw/kaikki/target_words.txt (по одному слову на строку, lowercase).
"""
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


spoken = read_stats(RAW / "ngsl/NGSL-Spoken_12_stats.csv", keep_bad_rank=True)
ngsl = read_stats(RAW / "ngsl/NGSL_12_stats.csv")
spoken_set = {w for w, _ in spoken}
rest = [w for w, _ in sorted(ngsl, key=lambda x: x[1]) if w not in spoken_set]

target = [w for w, _ in spoken] + rest[: max(0, TARGET_TOTAL - len(spoken_set))]
out = RAW / "kaikki/target_words.txt"
out.write_text("\n".join(sorted(set(target))) + "\n", encoding="utf-8")
print(f"spoken: {len(spoken)}, ngsl всего: {len(ngsl)}")
print(f"цель: {len(set(target))} уникальных слов -> {out}")
