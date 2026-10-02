#!/usr/bin/env python3
"""plan://curriculum-review#V.1–V.3, V.5 — миграция программы v2 (уровень данных).

Переносы и порядок (решения 05 §7, единый релиз v2):
- V.1 Past Simple (les-c-01…c-10) + Past Continuous (les-c-24) → конец ранга D
  (52 урока без прошедшего — критично для travel-цели);
- V.2 будущее в C: be going to (c-14) ПЕРЕД will (c-11…c-13);
- V.3 ранг A открывается консолидацией («Карта всех времён» a-03 первой),
  Future Continuous/Perfect — в середину ранга (позиции 10–11);
- V.5 порядок — явное поле `order` у каждого урока; id уроков/фраз/упражнений
  и аудио СТАБИЛЬНЫ (статусы пользователя не ломаются), content_version++.

⚠️ Билдеры build_c/build_d/build_a — исторические (v1): их вывод нумерует id
по рангу файла и НЕ совместим с v2-раскладкой. Не перегенерировать lessons/
phrases/exercises рангов C/D/A без переноса v2-правок в билдеры.

Запуск однократный: python3 research/tools/lessons/v2_migrate.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
LESSONS = ROOT / "data" / "lessons"

RANKS = ["e", "d", "c", "b", "a", "s"]

# Новая раскладка: (rank-файл) → список lesson-хвостов в порядке курса.
D_ORDER = (
    [f"les-d-{i:02d}" for i in range(1, 26)]  # D1–D5 без изменений (1–25)
    + [f"les-c-{i:02d}" for i in range(1, 11)]  # V.1 Past Simple (26–35)
    + ["les-c-24"]  # V.1 Past Continuous (36)
    + ["les-d-26", "les-d-27", "les-d-28"]  # финал ранга: трансформации + Большое повторение
)
C_ORDER = (
    ["les-c-14"]  # V.2 be going to — первым
    + ["les-c-11", "les-c-12", "les-c-13"]  # will ±/? и спецвопросы
    + ["les-c-15"]  # Повторение №12
    + [f"les-c-{i:02d}" for i in range(16, 24)]  # модальные + сравнения + предлоги (c-24 ушёл в D)
    + ["les-c-25"]  # Повторение №14
    + [f"les-c-{i:02d}" for i in range(26, 31)]  # «В пути» + Большое повторение
)
A_ORDER = (
    ["les-a-03", "les-a-04", "les-a-05", "les-a-06"]  # V.3 консолидация: карта времён + пассив
    + [f"les-a-{i:02d}" for i in range(7, 12)]  # модальные в прошедшем
    + ["les-a-01", "les-a-02"]  # V.3 Future Continuous/Perfect — середина ранга
    + [f"les-a-{i:02d}" for i in range(12, 23)]  # конструкции + стиль
)

# Модули: тематические блоки v2 (метаданные; PathScreen группирует по рангу).
MODULES = {
    # D: существующие mod-d-1…5 не трогаем; прошлое = mod-d-6; финал = mod-d-7
    **{f"les-d-{i:02d}": f"mod-d-{(i - 1) // 5 + 1}" for i in range(1, 26)},
    **{f"les-c-{i:02d}": "mod-d-6" for i in range(1, 11)},
    "les-c-24": "mod-d-6",
    "les-d-26": "mod-d-7",
    "les-d-27": "mod-d-7",
    "les-d-28": "mod-d-7",
    # C: будущее = mod-c-1; модальные = mod-c-2; сравнения = mod-c-3; в пути = mod-c-4
    "les-c-14": "mod-c-1",
    **{f"les-c-{i:02d}": "mod-c-1" for i in range(11, 16)},
    **{f"les-c-{i:02d}": "mod-c-2" for i in range(16, 21)},
    **{f"les-c-{i:02d}": "mod-c-3" for i in list(range(21, 24)) + [25]},
    **{f"les-c-{i:02d}": "mod-c-4" for i in range(26, 31)},
    # A: консолидация = mod-a-1; модальные = mod-a-2; будущее = mod-a-3; конструкции = mod-a-4; стиль = mod-a-5
    **{f"les-a-{i:02d}": "mod-a-1" for i in range(3, 7)},
    **{f"les-a-{i:02d}": "mod-a-2" for i in range(7, 12)},
    "les-a-01": "mod-a-3",
    "les-a-02": "mod-a-3",
    **{f"les-a-{i:02d}": "mod-a-4" for i in range(12, 17)},
    **{f"les-a-{i:02d}": "mod-a-5" for i in range(17, 23)},
}

NEW_LAYOUT = {
    "d": D_ORDER,
    "c": C_ORDER,
    "a": A_ORDER,
}


def load(rank: str) -> dict:
    return json.loads((LESSONS / f"lessons-{rank}.json").read_text(encoding="utf-8"))


def main() -> None:
    by_id: dict[str, dict] = {}
    for rank in RANKS:
        env = load(rank)
        for item in env["items"]:
            if "order" in item:
                sys.exit(f"уже мигрировано: {item['id']} содержит order — повторный запуск запрещён")
            if item["id"] in by_id:
                sys.exit(f"дубль id: {item['id']}")
            by_id[item["id"]] = item
    counts = {r: len(load(r)["items"]) for r in RANKS}
    if counts != {"e": 24, "d": 28, "c": 30, "b": 29, "a": 22, "s": 15}:
        sys.exit(f"неожиданный состав данных v1: {counts}")

    for rank, order in NEW_LAYOUT.items():
        expected = [item["id"] for item in sorted(load(rank)["items"], key=lambda x: x["id"])]
        moved_in = [lid for lid in order if lid not in expected]
        missing = [lid for lid in order if lid not in by_id]
        if missing:
            sys.exit(f"{rank}: неизвестные уроки {missing}")
        for lid in order:
            lesson = by_id[lid]
            lesson["rank"] = rank.upper()
            if lid in MODULES:
                lesson["module"] = MODULES[lid]

    covered: set[str] = set()
    for rank in RANKS:
        if rank in NEW_LAYOUT:
            ids = NEW_LAYOUT[rank]
        else:  # E/B/S — порядок не меняется, добавляется только order
            ids = [item["id"] for item in load(rank)["items"]]
        covered.update(ids)
    if covered != set(by_id):
        sys.exit(f"раскладка покрывает не все уроки: {sorted(set(by_id) - covered)}")
    for rank in RANKS:
        ids = NEW_LAYOUT.get(rank) or [item["id"] for item in load(rank)["items"]]
        env = load(rank)
        env["items"] = []
        for position, lid in enumerate(ids, start=1):
            lesson = by_id[lid]
            lesson["order"] = position
            env["items"].append(lesson)
        path = LESSONS / f"lessons-{rank}.json"
        path.write_text(json.dumps(env, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"lessons-{rank}.json: {len(ids)} уроков (order 1…{len(ids)})")

    print(
        "итог: D=%d (Past Simple+PC в конце), C=%d (going to → will), A=%d (консолидация первой)"
        % (len(D_ORDER), len(C_ORDER), len(A_ORDER))
    )


if __name__ == "__main__":
    main()
