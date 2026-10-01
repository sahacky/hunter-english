#!/usr/bin/env python3
"""Голос-покрытие (plan://voice-fix V2.1–V2.3): убрать Web Speech-фолбэки.

1) Цитаты (data/quotes/*.json): полю audio.en_gb = audio/quotes/cori/<id>.opus.
2) Реплики разговорника (data/phrasebook/*.json): полю lines[i].audio =
   audio/phrasebook/cori/<dialog.id>-l<i>.opus.
3) Мини-словарь (data/vocab/travel.json): записям без аудио слов — собственное
   аудио audio/vocab/cori/<slug>.opus (slug = тема + текст, уникальный).

Скрипт идемпотентен, пишет только поля audio; списки для генератора — в
data/raw/voice-cover/<name>.list (формат «id<TAB>текст», raw не в git).
После него: research/tools/audio/gen_audio.py --list <list> --out-dir <dir>.
Запуск из корня репозитория: python3 research/tools/audio/build_voice_cover.py
"""
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
LISTS = REPO / "data/raw/voice-cover"


def slugify(text: str) -> str:
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", text.casefold())).strip("-")[:30]


def main() -> None:
    LISTS.mkdir(parents=True, exist_ok=True)
    todo: dict[str, list[tuple[str, str]]] = {"quotes": [], "phrasebook": [], "vocab": []}

    # --- 1. Цитаты ---
    quotes_changed = 0
    for path in sorted((REPO / "data/quotes").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for item in doc["items"]:
            want = {"en_gb": f"audio/quotes/cori/{item['id']}.opus"}
            if item.get("audio") != want:
                item["audio"] = want
                changed = True
            todo["quotes"].append((item["id"], item["text"]))
        if changed:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            quotes_changed += 1
    print(f"цитаты: файлов изменено {quotes_changed}, строк аудио {len(todo['quotes'])}")

    # --- 2. Разговорник ---
    pb_changed = 0
    for path in sorted((REPO / "data/phrasebook").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for dialog in doc["items"]:
            for i, line in enumerate(dialog["lines"]):
                want = f"audio/phrasebook/cori/{dialog['id']}-l{i}.opus"
                if line.get("audio") != want:
                    # audio ставим первым ключом после role — порядок в файле устойчив
                    line.pop("audio", None)
                    ordered = {"role": line["role"], "audio": want}
                    ordered.update({k: v for k, v in line.items() if k != "role"})
                    dialog["lines"][i] = ordered
                    changed = True
                todo["phrasebook"].append((f"{dialog['id']}-l{i}", line["text_en"]))
        if changed:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            pb_changed += 1
    print(f"разговорник: файлов изменено {pb_changed}, реплик {len(todo['phrasebook'])}")

    # --- 3. Мини-словарь: записи без аудио слов ---
    vocab_path = REPO / "data/vocab/travel.json"
    doc = json.loads(vocab_path.read_text(encoding="utf-8"))
    used = set()
    added = 0
    for item in doc["items"]:
        if item.get("audio"):
            continue
        base = f"{item['topic']}-{slugify(item['en'])}" or f"{item['topic']}-w"
        slug, n = base, 1
        while slug in used:
            n += 1
            slug = f"{base}-{n}"
        used.add(slug)
        item["audio"] = f"audio/vocab/cori/{slug}.opus"
        added += 1
        todo["vocab"].append((slug, item["en"]))
    vocab_path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"мини-словарь: добавлено аудио {added} (из {len(doc['items'])})")

    # порядок ключей vocab: audio последним — пересортируем entries: topic, en, ru, audio
    for item in doc["items"]:
        ordered = {k: item[k] for k in ("topic", "en", "ru") if k in item}
        if "audio" in item:
            ordered["audio"] = item["audio"]
        item.clear()
        item.update(ordered)
    vocab_path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for name, rows in todo.items():
        (LISTS / f"{name}.list").write_text(
            "".join(f"{i}\t{t}\n" for i, t in rows), encoding="utf-8")
    print(f"списки для gen_audio: {LISTS}")


if __name__ == "__main__":
    main()
