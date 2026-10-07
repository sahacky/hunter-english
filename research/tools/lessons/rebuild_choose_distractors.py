#!/usr/bin/env python3
"""Перевыбор дистракторов choose_translation в готовых exercises-*.json
(plan://distractor-quality#D3).

Проблема: билдеры берут кандидатов полосы ±50 частотного ранга — по смыслу
и написанию варианты часто чужды («Есть билеты?» → «Thanks a lot.»), выбор
тривиален. Здесь — тот же принцип, что в рантайме D1/D2: скоринг похожести
на цель (общие EN-слова, пересечение RU-перевода) внутри пула урока
(та же грамматика по построению).

Детерминизм/idемпотентность: rng = random.Random(<exercise_id>) — повторный
запуск даёт тот же результат. Пост-билдерная правка (прецедент: retell 91xx,
strange 92xx) — билдеры не перегенерируются (v2-правки).

Лучший кандидат гарантирован в тройке, двое остальных — из окна разнообразия.
После него: build_manifest.py + validate:data.
Запуск из корня: python3 research/tools/lessons/rebuild_choose_distractors.py
"""
import json
import random
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"

WINDOW = 6
MAX_WORDS = 4  # как у билдера: кандидаты-дистракторы — короткие фразы


def words_en(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-z']+", text.lower()) if len(w) >= 2}


def tokens_ru(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-zа-яё]+", text.lower()) if len(w) >= 3}


def score(target: dict, cand: dict) -> float:
    tw = words_en(target["text_en"])
    shared = sum(1 for w in re.split(r"[^a-z']+", cand["text_en"].lower()) if len(w) >= 2 and w in tw)
    s = shared * 1.5
    if tokens_ru(target["translation_ru"]) & tokens_ru(cand["translation_ru"]):
        s += 1
    return s


def main() -> None:
    lessons = []
    for path in sorted((DATA / "lessons").glob("lessons-*.json")):
        lessons.extend(json.loads(path.read_text(encoding="utf-8"))["items"])
    ex_by_lesson: dict[str, dict] = {}
    for lesson in lessons:
        for ref in lesson["exercises"]:
            ex_by_lesson[ref["id"]] = lesson

    changed = skipped = rewritten = 0
    for path in sorted((DATA / "lessons").glob("exercises-*.json")):
        rank = path.stem.rsplit("-", 1)[1]
        phrases = json.loads((DATA / "phrases" / f"phrases-{rank}.json").read_text(encoding="utf-8"))["items"]
        doc = json.loads(path.read_text(encoding="utf-8"))
        touched = False
        for item in doc["items"]:
            if item["type"] != "choose_translation":
                continue
            payload = item["payload"]
            options = payload["options"]
            correct_idx = payload["correct"]
            target_en = options[correct_idx]
            lesson = ex_by_lesson.get(item["id"])
            if lesson is None:
                skipped += 1
                continue
            pool = [p for p in phrases if p["grammar_point_id"] == lesson["grammar_point"]["id"]]
            target = next((p for p in pool if p["text_en"] == target_en), None)
            if target is None:
                skipped += 1
                continue
            cands = [
                p
                for p in pool
                if p["text_en"] != target_en
                and p["translation_ru"] != target["translation_ru"]
                and 1 <= len(p["text_en"].split()) <= MAX_WORDS
            ]
            # уникальные тексты
            seen: set[str] = set()
            uniq = []
            for p in cands:
                if p["text_en"] not in seen:
                    seen.add(p["text_en"])
                    uniq.append(p)
            if len(uniq) < 3:
                skipped += 1
                continue
            rng = random.Random(item["id"])
            ranked = sorted(uniq, key=lambda p: (-score(target, p), p["id"]))
            window = ranked[: max(3, WINDOW)]
            picked = [window.pop(0)]
            while len(picked) < 3 and window:
                picked.append(window.pop(rng.randrange(len(window))))
            new_options = [target_en] + [p["text_en"] for p in picked]
            rng.shuffle(new_options)
            if new_options == options:
                continue
            payload["options"] = new_options
            payload["correct"] = new_options.index(target_en)
            rewritten += 1
            touched = True
        if touched:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            changed += 1
    print(f"choose-дистракторы: файлов {changed}, упражнений перевыбрано {rewritten}, пропущено {skipped}")


if __name__ == "__main__":
    main()
