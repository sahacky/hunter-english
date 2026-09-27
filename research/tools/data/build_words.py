#!/usr/bin/env python3
"""Сборка data/words/*.json из сырья M3 (specs/05 §1, план://M3#3.4).

Вход (data/raw/, в git не коммитится):
  ngsl/NGSL_12_stats.csv         — NGSL 1.2: лемма → частотный ранг (2806)
  ngsl/NGSL-Spoken_12_stats.csv  — NGSL-Spoken: лемма → разговорный ранг (719)
  kaikki/words/<lemma>.jsonl     — словарные статьи Wiktionary (kaikki.org):
                                   переводы на уровне записи, поле translations
                                   (lang=Russian), ударения снимаются
  kaikki/target_words_full.txt   — union-список целевых лемм (2830)
  oxford/full-word.json          — CEFR-разметка Oxford (только внутренний
                                   пайплайн, в data/ не публикуется)
  tatoeba/examples.json          — индекс примеров lemma → {en, ru}
  ../data/quotes-ru-merged.json  — фолбэк примеров из цитат

Выход:
  data/words/words-0001-0719.json  — леммы NGSL-Spoken (по разговорному рангу)
  data/words/words-0720-2806.json  — остальные леммы NGSL (по рангу NGSL);
                                     при превышении ~300 КБ делится по рангу 1800

Правила (решения plan://M3#M3):
  - одна запись = одна часть речи; id = лемма, если у леммы одна часть речи,
    иначе "<лемма>-<pos>";
  - translation_ru: 1–3 главных перевода из kaikki (порядок статей = частотность
    значений), ударения снимаются, NFC-нормализация;
  - лемма без перевода или без примера в data/words не попадает (отчёт в логе);
  - cefr_level: из Oxford (совпадение лемма+POS, затем любая POS), иначе из
    частотного ранга (1–500 A1, 501–1000 A2, 1001–2000 A2, 2001+ B1);
  - freq_rank_ngsl у spoken-only лемм (нет в NGSL): sentinel 100000+spoken_rank,
    CEFR — по разговорному рангу;
  - теги: ngsl, spoken-top719, irregular-verb (curated-список в скрипте);
    фразовые глаголы — материал уроков M5+, тегов phrasal-* здесь нет.
"""
import csv
import json
import re
import unicodedata
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data/raw"
OUT = ROOT / "data/words"

POS_MAP = {
    "noun": "noun",
    "verb": "verb",
    "adj": "adjective",
    "adv": "adverb",
    "prep": "preposition",
    "pron": "pronoun",
    "conj": "conjunction",
    "interj": "interjection",
    "det": "determiner",
    "intj": "interjection",
    "num": "noun",
    "postp": "adverb",
    "phrase": "phrase",
}
OXFORD_TYPE_MAP = {
    "noun": "noun",
    "verb": "verb",
    "adjective": "adjective",
    "adverb": "adverb",
    "preposition": "preposition",
    "pronoun": "pronoun",
    "conjunction": "conjunction",
    "interjection": "interjection",
    "exclamation": "interjection",
    "determiner": "determiner",
    "modal verb": "verb",
    "auxiliary verb": "verb",
    "phrase": "phrase",
}
IRREGULAR_VERBS = set("""be have do say go get make know think take see come want look use
find give tell work call try ask need feel become leave put mean keep let begin seem help
talk turn start show hear play run move like live believe hold bring happen write provide
sit stand lose pay meet include continue set learn change lead understand watch follow stop
create speak read spend grow open walk win teach offer remember love consider appear buy
wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell
require report decide pull return explain hope develop carry break receive agree support hit
produce eat cover catch draw choose cause point listen realize drive argue bend bind bite
blow burn burst cling creep deal dig dive dream flee fly forbid forget forgive freeze grind
hang hide hurt kneel knit lay lend lie light ride ring rise shake shave shear shed shine
shoot shrink shut sing sink sleep slide sling slit sow speed spell spill spin spit split
spread spring steal stick sting stink strike string strive swear sweep swim swing tear
thrive throw thrust tread undergo wake wear weave wed weep wet wind wring awake beat shrink
mistake forsake overtake undertake arise awake forbid recapitulate""".split())

COMBINING_ACUTE = "\u0301"


def strip_accents_ru(s: str) -> str:
    s = unicodedata.normalize("NFC", s).replace(COMBINING_ACUTE, "")
    return unicodedata.normalize("NFC", s).strip()


def read_ranks(p: Path) -> dict:
    ranks = {}
    with p.open(encoding="utf-8-sig") as f:
        for r in csv.reader(f):
            if not r or r[0].lower() == "lemma":
                continue
            try:
                ranks[r[0].strip().lower()] = int(r[1])
            except ValueError:
                continue
    return ranks


def load_oxford():
    """word → список (pos, cefr) в порядке файла."""
    data = json.loads((RAW / "oxford/full-word.json").read_text(encoding="utf-8"))
    out = {}
    for it in data:
        v = it.get("value", {})
        w = v.get("word", "").lower()
        pos = OXFORD_TYPE_MAP.get((v.get("type") or "").lower())
        lvl = v.get("level")
        if w and pos and lvl in ("A1", "A2", "B1", "B2", "C1", "C2"):
            out.setdefault(w, []).append((pos, lvl))
    return out


def cefr_from_rank(rank: int) -> str:
    if rank <= 500:
        return "A1"
    if rank <= 1000:
        return "A2"
    if rank <= 2000:
        return "A2"
    return "B1"


def kaikki_translations(lemma: str):
    """[(pos_mapped, [переводы ru])] по всем подходящим статьям леммы."""
    p = RAW / f"kaikki/words/{lemma}.jsonl"
    if not p.exists() or p.stat().st_size == 0:
        return []
    per_pos = {}
    with p.open(encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("lang_code") != "en" and d.get("lang") != "English":
                continue
            pos = POS_MAP.get(d.get("pos", ""))
            if not pos:
                continue
            rus = []
            for t in d.get("translations", []):
                if t.get("code") == "ru" or t.get("lang") == "Russian":
                    w = strip_accents_ru(t.get("word", ""))
                    if w and w not in rus:
                        rus.append(w)
            if rus:
                per_pos.setdefault(pos, [])
                for w in rus:
                    if w not in per_pos[pos]:
                        per_pos[pos].append(w)
    return list(per_pos.items())


def load_examples():
    p = RAW / "tatoeba/examples.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def quotes_fallback_examples():
    src = ROOT / "research/data/quotes-ru-merged.json"
    if not src.exists():
        return []
    return json.loads(src.read_text(encoding="utf-8"))


def main():
    targets = (RAW / "kaikki/target_words_full.txt").read_text(encoding="utf-8").split()
    ngsl_rank = read_ranks(RAW / "ngsl/NGSL_12_stats.csv")
    spoken_rank = read_ranks(RAW / "ngsl/NGSL-Spoken_12_stats.csv")
    oxford = load_oxford()
    examples = load_examples()
    quotes = quotes_fallback_examples()

    dropped_no_tr = []
    dropped_no_ex = []
    skipped_pos = 0
    spoken_only = []
    entries = {}

    for lemma in targets:
        pairs = kaikki_translations(lemma)
        if not pairs:
            dropped_no_tr.append(lemma)
            continue
        s_rank = spoken_rank.get(lemma)
        n_rank = ngsl_rank.get(lemma)
        if n_rank is None and s_rank is not None:
            spoken_only.append(lemma)
            n_rank = 100000 + s_rank

        ex = examples.get(lemma)
        if ex:
            example_en, example_ru = ex["en"], ex["ru"]
        else:
            pat = re.compile(rf"\b{re.escape(lemma)}\b", re.IGNORECASE)
            q = next((x for x in quotes if pat.search(x.get("text", "")) and x.get("translation_ru")), None)
            if q:
                example_en, example_ru = q["text"], q["translation_ru"]
            else:
                dropped_no_ex.append(lemma)
                continue

        # CEFR: Oxford по (лемма, POS), затем любой POS, иначе из ранга
        rank_for_cefr = s_rank if (n_rank >= 100000 and s_rank) else n_rank
        ox = oxford.get(lemma, [])
        for pos, trs in pairs:
            if len(trs) > 3:
                trs = trs[:3]
            lvl = next((l for p_, l in ox if p_ == pos), None)
            if lvl is None and ox:
                lvl = ox[0][1]
            if lvl is None:
                lvl = cefr_from_rank(rank_for_cefr)
            tags = ["ngsl"]
            if s_rank is not None:
                tags.append("spoken-top719")
            if pos == "verb" and lemma in IRREGULAR_VERBS:
                tags.append("irregular-verb")
            entries[(lemma, pos)] = OrderedDict(
                lemma=lemma,
                part_of_speech=pos,
                translation_ru=trs,
                cefr_level=lvl,
                freq_rank_ngsl=n_rank,
                **({"freq_rank_spoken": s_rank} if s_rank is not None else {}),
                tags=tags,
                example_en=example_en,
                example_ru=example_ru,
            )
        if not any(k[0] == lemma for k in entries):
            skipped_pos += len(pairs)

    # id: одна часть речи → лемма, несколько → лемма-pos
    pos_counts = {}
    for lemma, pos in entries:
        pos_counts[lemma] = pos_counts.get(lemma, 0) + 1
    words = []
    for (lemma, pos), e in entries.items():
        item = OrderedDict(id=lemma if pos_counts[lemma] == 1 else f"{lemma}-{pos}", **e)
        item.move_to_end("id", last=False)
        words.append((item, lemma))

    OUT.mkdir(parents=True, exist_ok=True)
    spoken_items = sorted(
        (it for it, _ in words if it.get("freq_rank_spoken")),
        key=lambda x: x["freq_rank_spoken"],
    )
    ngsl_items = sorted(
        (it for it, _ in words if not it.get("freq_rank_spoken")),
        key=lambda x: x["freq_rank_ngsl"],
    )

    def dump(name, items):
        p = OUT / name
        p.write_text(
            json.dumps(OrderedDict(schema_version=1, kind="words", items=items), ensure_ascii=False,
                       separators=(",", ":"))
            + "\n",
            encoding="utf-8",
        )
        print(f"{name}: {len(items)} записей, {p.stat().st_size // 1024} КБ")

    if spoken_items:
        dump("words-0001-0719.json", spoken_items)
    if ngsl_items:
        # NGSL-остаток: чанки по ~260 КБ (цель спеки «~200–300 КБ»),
        # имя файла — фактический диапазон рангов внутри чанка
        chunk, chunk_min = [], None
        for it in ngsl_items:
            if chunk and chunk_min != it["freq_rank_ngsl"]:
                size = len(json.dumps(chunk, ensure_ascii=False, separators=(",", ":")))
                if size >= 235 * 1024:
                    dump(f"words-{chunk_min:04d}-{chunk[-1]['freq_rank_ngsl']:04d}.json", chunk)
                    chunk, chunk_min = [], None
            if chunk_min is None:
                chunk_min = it["freq_rank_ngsl"]
            chunk.append(it)
        if chunk:
            dump(f"words-{chunk_min:04d}-{chunk[-1]['freq_rank_ngsl']:04d}.json", chunk)

    total = len(spoken_items) + len(ngsl_items)
    print(f"ИТОГО: {total} записей слов из {len(targets)} целевых лемм")
    print(f"без перевода в kaikki: {len(dropped_no_tr)} -> {dropped_no_tr[:25]}{' ...' if len(dropped_no_tr) > 25 else ''}")
    print(f"без примера: {len(dropped_no_ex)} -> {dropped_no_ex[:25]}{' ...' if len(dropped_no_ex) > 25 else ''}")
    print(f"spoken-only (sentinel freq_rank_ngsl): {len(spoken_only)} -> {spoken_only}")
    if skipped_pos:
        print(f"записей без перевода после маппинга POS: {skipped_pos}")


if __name__ == "__main__":
    main()
