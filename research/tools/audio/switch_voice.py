#!/usr/bin/env python3
"""Переключение голоса в путях данных: audio/<kind>/cori/… → audio/<kind>/<new>/…

Сырая замена подстрок в JSON-файлах данных (сохраняет форматирование файла
байт-в-байт, без json.dumps). Затрагивает: words, phrases, quotes,
phrasebook (lines[].audio), vocab (включая ссылки на аудио слов).

Перед запуском: новое аудио уже сгенерировано (gen_audio_kokoro.py).
После: build_manifest.py + validate:data (проверит существование файлов).
Запуск из корня: python3 research/tools/audio/switch_voice.py emma
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
KINDS = ["words", "phrases", "quotes", "phrasebook", "vocab"]

if len(sys.argv) != 2:
    sys.exit("использование: switch_voice.py <новый-сегмент-каталога> (например: emma)")
NEW = sys.argv[1]

total = 0
for kind in KINDS:
    for path in sorted((REPO / "data" / kind).glob("*.json")):
        text = path.read_text(encoding="utf-8")
        updated = text.replace(f"audio/{kind}/cori/", f"audio/{kind}/{NEW}/")
        if updated != text:
            n = text.count(f"audio/{kind}/cori/")
            path.write_text(updated, encoding="utf-8")
            total += n
            print(f"{path.relative_to(REPO)}: {n} путей → {NEW}")
print(f"итого заменено путей: {total}")
