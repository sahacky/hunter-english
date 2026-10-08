#!/usr/bin/env python3
"""Местоименная логика в правилах выбора формы (plan://first-lessons-a0#V2,
фидбей 2026-10-08: «когда подлежащее — девочка, как понять, что это she → is?»).

Приём «замени существительное местоимением» добавляется подсписком в блок
«Формула:» каждого правила выбора формы. Идемпотентен: маркер
«Замени местоимением»/«существительное =» в rule_md урока → пропуск.

Пост-билдерная правка данных (прецедент: add_strange_dictation.py).
После: build_manifest.py + validate:data.
Запуск из корня: python3 research/tools/lessons/add_pronoun_substitution.py
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"

# якорь в текущем rule_md → вставка сразу после якоря
INSERTS: dict[str, tuple[str, str]] = {
    # les-e-01 to be: am/is/are
    "les-e-01": (
        "- I → am; he / she / it → is; you / we / they → are",
        "- Подлежащее-существительное? Замени местоимением: девочка = she, "
        "мужчина = he, окно = it, дети = they → The girl** is** here. "
        "The boy**s are** at school.",
    ),
    # les-e-11 Present Simple + (мн.ч. = they)
    "les-e-11": (
        "- I work. We live. You know. They want.",
        "- Существительное во множественном = they → My parents **live** here. "
        "The shops **open** at nine.",
    ),
    # les-e-12 he/she/it + -s
    "les-e-12": (
        "- He works in a bank. It opens at nine.",
        "- Существительное в единственном = he / she / it → девочка, город, кот: "
        "My sister work**s** here. The shop open**s** at nine.",
    ),
    # les-d-08 have got / has got
    "les-d-08": (
        "- She **has got** a phone. − : I **haven't got** money. = I **don't have** money.",
        "- Подлежащее-существительное? девочка = she → has: My sister **has got** a phone.",
    ),
    # les-c-04 was/were
    "les-c-04": (
        "- − : I wasn't at home. ?: **Were** you at the hotel?",
        "- Подлежащее-существительное? Замени местоимением: поезд = it → was, "
        "друзья = they → were: The trip **was** great. My friends **were** tired.",
    ),
    # les-e-16 Do-вопросы
    "les-e-16": (
        "- Do you work here? Do they live in London?",
        "- Существительное во множественном = they → **Do**: **Do** your friends live here?",
    ),
    # les-e-17 Does-вопросы
    "les-e-17": (
        "- Does he work here? Does she like tea?",
        "- Существительное в единственном = he / she / it → **Does**: "
        "**Does** your sister work here? **Does** the shop open at nine?",
    ),
}

MARKERS = ("Замени местоимением", "существительное =")


def main() -> None:
    changed = skipped = 0
    for path in sorted((DATA / "lessons").glob("lessons-*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        touched = False
        for lesson in doc["items"]:
            entry = INSERTS.get(lesson["id"])
            if not entry:
                continue
            anchor, insertion = entry
            rule = lesson["grammar_point"]["rule_md"]
            if any(m in rule for m in MARKERS):
                skipped += 1
                continue
            if anchor not in rule:
                raise SystemExit(f"якорь не найден в {lesson['id']}: {anchor[:50]}…")
            lesson["grammar_point"]["rule_md"] = rule.replace(anchor, anchor + "\n" + insertion, 1)
            changed += 1
            touched = True
        if touched:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"правил дополнено: {changed}, пропущено (уже есть): {skipped}")


if __name__ == "__main__":
    main()
