"""Частотные ранги слов data/words и подбор дистракторов ±50 (план M12#12.2).

Используется билдерами уроков (build_e1/build_d): choose_translation-дистракторы
берутся из той же частотной полосы, что и ключевое слово цели (решение M11#6).
"""
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
WORDS_DIR = REPO / "data/words"

# эффективный ранг: NGSL-ранг; spoken-only — 100000+spoken; суб-полоса — 20000+sub
_cache: dict[str, int] | None = None
TOKEN_RE = re.compile(r"[a-z']+")


def _load() -> dict[str, int]:
    global _cache
    if _cache is not None:
        return _cache
    ranks: dict[str, int] = {}
    for path in sorted(WORDS_DIR.glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            lemma = item["lemma"].lower()
            if "freq_rank_sub" in item:
                rank = 20000 + item["freq_rank_sub"]
            else:
                rank = item["freq_rank_ngsl"]
            # минимальный ранг при нескольких POS
            if lemma not in ranks or rank < ranks[lemma]:
                ranks[lemma] = rank
    _cache = ranks
    return ranks


def key_rank(text: str) -> int | None:
    """Ранг самого редкого известного токена фразы (ключевое слово)."""
    ranks = _load()
    known = [ranks[t] for t in TOKEN_RE.findall(text.lower()) if t in ranks]
    return max(known) if known else None


def distractor_pool(target: dict, candidates: list[dict], window: int = 50) -> list[str]:
    """EN-тексты кандидатов в полосе ±window от ключевого слова цели.

    Порядок — как передано (билдер шафлит заранее); коллизии перевода и
    сам target исключены. Пустое окно расширяется вдвое (до 4 раз), затем —
    фолбэк на всех кандидатов урока (прежнее поведение).
    """
    rank = key_rank(target["text_en"])
    others = [
        p for p in candidates
        if p is not target and p["translation_ru"] != target["translation_ru"]
    ]
    if rank is None:
        return [p["text_en"] for p in others]
    win = window
    for _ in range(3):
        band = [
            p["text_en"]
            for p in others
            if (lambda r: r is not None and abs(r - rank) <= win)(key_rank(p["text_en"]))
        ]
        if len(band) >= 3:
            return band
        win *= 2
    return [p["text_en"] for p in others]
