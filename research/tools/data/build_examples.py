#!/usr/bin/env python3
"""Примеры «английская фраза + русский перевод» из Tatoeba (CC BY 2.0 FR).

Читает экспорты Tatoeba из каталога --tatoeba-dir (по умолчанию
/tmp/opencode/tatoeba; файлы sentences_detailed.csv, links.csv) и для каждой
целевой леммы из data/raw/kaikki/target_words_full.txt подбирает лучшую пару
прямых переводов eng<->rus: минимальная «сложность» — максимум слов фразы
из топ-3000 NGSL (взвешенно по рангу), затем короткость.

Выход: data/raw/tatoeba/examples.json — {"<lemma>": {"en": ..., "ru": ...,
"tatoeba_id": N}}; леммы без кандидата не включаются. Печатает статистику
покрытия по диапазонам ранга.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / "data/raw"
OUT = RAW / "tatoeba/examples.json"

TOP_N = 3000
MIN_WORDS, MAX_WORDS = 3, 12
MAX_LEN = 80

ALLOWED = re.compile(r"^[a-zA-Z0-9 ,.;:!?()\"'\u2019-]+$")


def load_ranks() -> dict[str, int]:
    ranks: dict[str, int] = {}
    for name in ("NGSL_12_stats.csv", "NGSL-Spoken_12_stats.csv"):
        with (RAW / "ngsl" / name).open(encoding="utf-8-sig") as f:
            for r in csv.reader(f):
                if not r or r[0].lower() == "lemma":
                    continue
                lemma = r[0].strip().lower()
                try:
                    rank = int(r[1])
                except ValueError:
                    continue
                cur = ranks.get(lemma)
                if cur is None or rank < cur:
                    ranks[lemma] = rank
    return ranks


def load_pairs(tatoeba: Path) -> tuple[dict[int, str], dict[int, str]]:
    """eng_id -> en text / ru text для симметричных прямых ссылок."""
    print("чтение sentences_detailed.csv ...")
    lang_text: dict[int, tuple[str, str]] = {}
    with (tatoeba / "sentences_detailed.csv").open(encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 3 or row[1] not in ("eng", "rus"):
                continue
            try:
                sid = int(row[0])
            except ValueError:
                continue
            lang_text[sid] = (row[1], row[2])

    print("чтение links.csv ...")
    links: dict[int, set[int]] = {}
    with (tatoeba / "links.csv").open(encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) != 2:
                continue
            try:
                a, b = int(row[0]), int(row[1])
            except ValueError:
                continue
            links.setdefault(a, set()).add(b)

    en, ru = {}, {}
    for a, ts in links.items():
        ta = lang_text.get(a)
        if not ta or ta[0] != "eng" or a in en:
            continue
        for b in ts:
            tb = lang_text.get(b)
            if tb and tb[0] == "rus" and a in links.get(b, ()):
                en[a] = ta[1]
                ru[a] = tb[1]
                break
    print(f"симметричных прямых пар eng<->rus: {len(en)}")
    return en, ru


def en_ok(text: str) -> bool:
    if not (MIN_WORDS <= len(text.split()) <= MAX_WORDS):
        return False
    if len(text) > MAX_LEN:
        return False
    if "{" in text or "[" in text:
        return False
    if not ALLOWED.fullmatch(text):
        return False
    letters = re.sub(r"[^A-Za-z]", "", text)
    if letters and letters.isupper():
        return False
    return True


def word_forms(lemma: str) -> set[str]:
    forms = {lemma}
    if re.fullmatch(r"[a-z]+", lemma):
        if lemma.endswith(("s", "x", "z", "ch", "sh")):
            forms.add(lemma + "es")
        elif lemma.endswith("y") and len(lemma) > 1 and lemma[-2] not in "aeiou":
            forms.add(lemma[:-1] + "ies")
        else:
            forms.add(lemma + "s")
        forms.add(lemma + "ed")
        forms.add(lemma + "ing" if not lemma.endswith("e") else lemma + "d")
    return forms


def complexity(text: str, ranks: dict[str, int]) -> tuple[float, int]:
    """Меньше = лучше: штраф за слова вне топ-3000 NGSL, затем длина."""
    score = 0.0
    for w in re.findall(r"[a-zA-Z']+", text.lower()):
        rank = ranks.get(w)
        if rank is None:
            score += 10.0
        elif rank <= TOP_N:
            score += rank / TOP_N
        else:
            score += 5.0
    return (score, len(text.split()))


def main() -> None:
    ap = argparse.ArgumentParser(description="Примеры фраз из экспортов Tatoeba")
    ap.add_argument("--tatoeba-dir", type=Path, default=Path("/tmp/opencode/tatoeba"),
                    help="каталог с sentences_detailed.csv и links.csv")
    args = ap.parse_args()

    ranks = load_ranks()
    target_path = RAW / "kaikki/target_words_full.txt"
    targets = [w.strip().lower() for w in target_path.read_text(encoding="utf-8").splitlines() if w.strip()]
    if not targets:
        sys.exit(f"пустой список целевых лемм: {target_path} — "
                 f"сначала запусти research/tools/data/build_target_words.py --full")
    print(f"целевых лемм: {len(targets)}")

    en_map, ru_map = load_pairs(args.tatoeba_dir)

    forms_index: dict[str, list[str]] = {}
    for lemma in targets:
        for form in word_forms(lemma):
            forms_index.setdefault(form, []).append(lemma)

    pattern = re.compile(
        r"(?<![a-zA-Z'])(" + "|".join(sorted(map(re.escape, forms_index), key=len, reverse=True))
        + r")(?![a-zA-Z'])"
    )

    best: dict[str, tuple[tuple[float, int], dict]] = {}
    n_scanned = 0
    for sid, en in en_map.items():
        n_scanned += 1
        if not en_ok(en):
            continue
        ru = ru_map[sid].strip()
        if not ru or ru == en:
            continue
        found = set(pattern.findall(en.lower()))
        lemmas = {l for f in found for l in forms_index.get(f, ())}
        if not lemmas:
            continue
        key = complexity(en, ranks)
        for lemma in lemmas:
            if lemma not in best or key < best[lemma][0]:
                best[lemma] = (key, {"en": en, "ru": ru, "tatoeba_id": sid})
    print(f"просмотрено en-предложений в парах: {n_scanned}")

    out = {lemma: rec for lemma, (_, rec) in best.items()}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    rank_of = {w: ranks[w] for w in targets if w in ranks}
    ranges = ((1, 719), (720, 1800), (1801, 2830))
    print(f"\nпокрыто лемм: {len(out)}/{len(targets)} ({len(out) / len(targets):.1%})")
    for lo, hi in ranges:
        total = sum(1 for w in targets if w in rank_of and lo <= rank_of[w] <= hi)
        cov = sum(1 for w in out if w in rank_of and lo <= rank_of[w] <= hi)
        name = f"{lo}–{hi}"
        print(f"  ранг {name:>10}: {cov}/{total} ({cov / total:.1%})" if total else f"  ранг {name}: 0/0")
    print(f"\nвыход: {OUT} ({OUT.stat().st_size} байт)")


if __name__ == "__main__":
    main()
