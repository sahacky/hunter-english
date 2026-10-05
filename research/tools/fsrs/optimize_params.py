#!/usr/bin/env python3
"""Оптимизация параметров FSRS (19 весов, FSRS-4.5) на экспорте прогресса.

Хвост плана {#teaching-quality} Q3.1. В ts-fsrs (4.7.1 … 6.0-beta, проверено
2026-10-05) оптимизатора НЕТ — он живёт только в py-fsrs. Этот скрипт —
офлайн-инструмент: принимает JSON экспорта («Сохранить прогресс» на дашборде),
собирает ревью-последовательности и прогоняет оптимизатор py-fsrs.

Запуск (тяжёлые зависимости ставятся один раз, при накоплении данных):
    pip install --user "fsrs==5.1.3" torch pandas   # fsrs 5.x = FSRS-4.5 (19 весов, как наш ts-fsrs 4.7.1)
    python3 research/tools/fsrs/optimize_params.py progress.json

Гарды:
  * < 512 ревью — выход: дефолтные веса лучше переобучения на малой выборке
    (сам оптимизатор требует ≥512, практический порог ~1000+);
  * без fsrs/torch — инструкция по установке, ничего не ломает.

Результат: 19 весов для generatorParameters({ w: [...] }) в ts-fsrs
(src/domain/srs/scheduler.ts) — вшивать только при явном улучшении
(сравнить logloss до/после на своём логе) и с записью в WAL.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

MIN_REVIEWS = 512  # жёсткий порог оптимизатора py-fsrs
RECOMMENDED_REVIEWS = 1000  # практический порог против переобучения на одном пользователе


def load_review_log(export_path: Path) -> list[dict]:
    data = json.loads(export_path.read_text(encoding="utf-8"))
    if data.get("app") != "hunter-english":
        sys.exit("не похоже на экспорт Hunter English (app != hunter-english)")
    tables = data.get("tables", {})
    rl = tables.get("review_log", [])
    return sorted(rl, key=lambda r: str(r.get("reviewed_at", "")))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("использование: optimize_params.py <progress-export.json>")
    export = Path(sys.argv[1])
    if not export.is_file():
        sys.exit(f"файл не найден: {export}")

    reviews = load_review_log(export)
    cards = {r["card_id"] for r in reviews}
    print(f"ревью: {len(reviews)} (карточек: {len(cards)})")
    if len(reviews) < RECOMMENDED_REVIEWS:
        print(
            f"МАЛО ДАННЫХ: {len(reviews)} < {RECOMMENDED_REVIEWS} — дефолтные веса FSRS "
            "предпочтительнее переобучения; повтори после накопления лога"
        )
        if len(reviews) < MIN_REVIEWS:
            return
        print("продолжаем по явному запросу (порог 512 пройден)…")

    try:
        from fsrs import Rating, ReviewLog
        from fsrs.optimizer import Optimizer
    except ImportError as exc:
        sys.exit(
            "нет зависимостей оптимизатора:\n"
            '    pip install --user "fsrs==5.1.3" torch pandas\n'
            f"причина: {exc}"
        )

    logs = [
        ReviewLog(
            card_id=r["card_id"],
            rating=Rating(int(r["rating"])),
            review_datetime=datetime.fromisoformat(str(r["reviewed_at"]).replace("Z", "+00:00")),
            review_duration=int(r.get("duration_ms") or 0),
        )
        for r in reviews
    ]
    optimizer = Optimizer(logs)
    weights = optimizer.compute_optimal_parameters()
    print("\nоптимизированные w (19, FSRS-4.5):")
    print(json.dumps([round(w, 4) for w in weights]))
    print(
        "\nвшивание: generatorParameters({ w: <веса> }) в src/domain/srs/scheduler.ts;\n"
        "сравни качество на своём логе до замены и зафиксируй решение в WAL."
    )


if __name__ == "__main__":
    main()
