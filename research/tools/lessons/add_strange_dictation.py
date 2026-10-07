#!/usr/bin/env python3
"""Strange-фразы в диктант-микс уроков-повторений (plan://rules-revision#R5,
research/10 §2 №12: novelty-эффект — «странные» фразы запоминаются лучше).

Пост-билдерная правка данных (как build_voice_cover.py): перегенерация
билдеров затёрла бы v2-правки (order/curiosity/retell ex-91xx — v2_migrate).

На каждый целевой урок-повторения: 1 фраза (смешная/абсурдная, грамматика —
в пределах повторяемого) + 1 диктант-упражнение ex-<rank>-92xx (зона 9200+,
по аналогу retell 91xx), вставка id в exercises урока после 3-го диктанта.
14 фраз / 161 диктанта повторений ≈ 8.7% (цель 5–10%).

Идемпотентен: существующие id пропускаются. После него:
  python3 research/tools/audio/gen_audio.py --list data/raw/strange-dictation.list \
    --out-dir audio/phrases/cori
  python3 research/tools/data/build_manifest.py
Запуск из корня репозитория: python3 research/tools/lessons/add_strange_dictation.py
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"

# lesson → (phrase_id, text_en, translation_ru, exercise_id); ранговые файлы —
# по префиксу id (les-c-10 живёт в lessons-d.json, но данные — в *-c.json)
STRANGE: list[tuple[str, str, str, str, str]] = [
    ("les-e-05", "ph-e-1055", "My cat is an alien.", "Мой кот — инопланетянин.", "ex-e-9205"),
    ("les-e-15", "ph-e-1056", "My hamster doesn't believe in Mondays.",
     "Мой хомяк не верит в понедельники.", "ex-e-9215"),
    ("les-d-05", "ph-d-1251", "A ghost is drinking my coffee.",
     "Призрак пьёт мой кофе.", "ex-d-9205"),
    ("les-d-15", "ph-d-1252", "This soup has too many opinions.",
     "У этого супа слишком много мнений.", "ex-d-9215"),
    ("les-d-25", "ph-d-1253", "I'd like a table for penguins.",
     "Мне нужен столик для пингвинов.", "ex-d-9225"),
    ("les-c-10", "ph-c-1366", "The dinosaurs ate my homework.",
     "Динозавры съели мою домашку.", "ex-c-9210"),
    ("les-c-20", "ph-c-1367", "You mustn't dance with wolves.",
     "Нельзя танцевать с волками.", "ex-c-9220"),
    ("les-c-30", "ph-c-1368", "Grandma is stronger than gravity.",
     "Бабушка сильнее гравитации.", "ex-c-9230"),
    ("les-b-09", "ph-b-1378", "Somebody has stolen my shadow.",
     "Кто-то украл мою тень.", "ex-b-9209"),
    ("les-b-19", "ph-b-1379", "I enjoy talking to my fridge.",
     "Я люблю разговаривать с холодильником.", "ex-b-9219"),
    ("les-b-29", "ph-b-1380", "The car ran out of dreams.",
     "У машины закончились сны.", "ex-b-9229"),
    ("les-a-11", "ph-a-0700", "I shouldn't have eaten the map.",
     "Мне не следовало есть карту.", "ex-a-9211"),
    ("les-a-22", "ph-a-0701", "Little did the moon know.",
     "Луна и не подозревала.", "ex-a-9222"),
    ("les-s-10", "ph-s-0452", "Mistakes were made by the pizza.",
     "Ошибки были совершены пиццей.", "ex-s-9210"),
]

DICT_AFTER = 3  # вставка после 3-го диктанта урока — «в микс», не в хвост


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, doc: dict) -> None:
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> None:
    lessons_files = sorted((DATA / "lessons").glob("lessons-*.json"))
    exercises_files = sorted((DATA / "lessons").glob("exercises-*.json"))
    lessons_docs = {p: load(p) for p in lessons_files}
    exercises_docs = {p: load(p) for p in exercises_files}

    ex_type: dict[str, str] = {}
    for doc in exercises_docs.values():
        for item in doc["items"]:
            ex_type[item["id"]] = item["type"]

    phrases_doc_of: dict[str, Path] = {}
    for p in sorted((DATA / "phrases").glob("phrases-*.json")):
        rank = p.stem.rsplit("-", 1)[1]
        phrases_doc_of[rank] = p
    exercises_doc_of: dict[str, Path] = {}
    for p in exercises_files:
        rank = p.stem.rsplit("-", 1)[1]
        exercises_doc_of[rank] = p

    added_p = added_e = added_l = 0
    audio_rows: list[tuple[str, str]] = []

    for lesson_id, ph_id, text_en, ru, ex_id in STRANGE:
        rank = ph_id[3]
        phrases_doc = load(phrases_doc_of[rank])
        if any(i["id"] == ph_id for i in phrases_doc["items"]):
            pass
        else:
            gp_id = lesson_id.replace("les-", "gp-")
            phrases_doc["items"].append(
                {
                    "id": ph_id,
                    "text_en": text_en,
                    "translation_ru": ru,
                    "grammar_point_id": gp_id,
                    "variants": [text_en],
                    "audio": {"en_gb": f"audio/phrases/cori/{ph_id}.opus"},
                }
            )
            save(phrases_doc_of[rank], phrases_doc)
            added_p += 1
            audio_rows.append((ph_id, text_en))

        exercises_doc = load(exercises_doc_of[rank])
        if any(i["id"] == ex_id for i in exercises_doc["items"]):
            pass
        else:
            exercises_doc["items"].append(
                {
                    "id": ex_id,
                    "type": "dictation",
                    "payload": {"kind": "dictation", "phrase_id": ph_id},
                    "answer": {"normalization": "default", "typo": "allow"},
                    "meta": {"skill": "listening", "xp": 3},
                }
            )
            save(exercises_doc_of[rank], exercises_doc)
            added_e += 1
            ex_type[ex_id] = "dictation"

        for p, doc in lessons_docs.items():
            for lesson in doc["items"]:
                if lesson["id"] != lesson_id:
                    continue
                if any(e["id"] == ex_id for e in lesson["exercises"]):
                    continue
                dict_positions = [
                    i for i, e in enumerate(lesson["exercises"])
                    if ex_type.get(e["id"]) == "dictation"
                ]
                anchor = (
                    dict_positions[DICT_AFTER - 1]
                    if len(dict_positions) >= DICT_AFTER
                    else dict_positions[-1]
                )
                lesson["exercises"].insert(anchor + 1, {"id": ex_id})
                save(p, doc)
                added_l += 1

    if audio_rows:
        raw = DATA / "raw"
        raw.mkdir(parents=True, exist_ok=True)
        (raw / "strange-dictation.list").write_text(
            "".join(f"{i}\t{t}\n" for i, t in audio_rows), encoding="utf-8"
        )

    print(
        f"strange-диктанты: фраз +{added_p}, упражнений +{added_e}, "
        f"вставок в уроки +{added_l}; аудио-лист: data/raw/strange-dictation.list"
    )


if __name__ == "__main__":
    main()
