#!/usr/bin/env python3
"""Переключение голоса в путях данных: audio/<kind>/<старый-голос>/… → <новый>.

Сырая regex-замена подстрок в JSON-файлах данных (сохраняет форматирование
файла байт-в-байт). Проходит ВСЕ data/**/*.json (raw/ и schemas/ минус) —
включая payload.audio упражнений-сценок и word-ссылки в vocab.

Перед запуском: новое аудио уже сгенерировано (gen_audio_kokoro.py /
gen_audio_edge.py). После: build_manifest.py + validate:data.
Запуск из корня: python3 research/tools/audio/switch_voice.py sonia
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VOICE_RE = re.compile(r"(audio/(?:words|phrases|quotes|phrasebook|vocab)/)[a-z0-9_-]+(/)")

if len(sys.argv) != 2:
    sys.exit("использование: switch_voice.py <новый-сегмент-каталога> (например: sonia)")
NEW = sys.argv[1]

total = 0
for path in sorted(REPO.glob("data/**/*.json")):
    rel = path.relative_to(REPO).as_posix()
    if rel.startswith(("data/raw/", "data/schemas/", "data/manifest")):
        continue
    text = path.read_text(encoding="utf-8")
    updated, n = VOICE_RE.subn(rf"\g<1>{NEW}\g<2>", text)
    if n:
        path.write_text(updated, encoding="utf-8")
        total += n
        print(f"{rel}: {n} путей → {NEW}")
print(f"итого заменено путей: {total}")
