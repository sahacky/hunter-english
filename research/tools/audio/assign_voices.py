#!/usr/bin/env python3
"""Назначение голоса каждой карточке: детерминированный хэш id → один из 10
женских голосов Edge (решение разработчика «1» из 2026-10-08: вперемешку).

Идентификатор — имя файла (house-noun, ph-e-0010, pb-taxi-01-l0, …):
одно и то же слово, на которое ссылаются и words, и vocab, получает
один и тот же голос. Распределение: sha1(id) % 10 → VOICES.

Переписывает аудио-пути во всех data/**/*.json (кроме raw/schemas/manifest).
После него: gen_audio_edge.py (понимает голос из сегмента пути) →
build_manifest.py → validate:data.

Запуск из корня: python3 research/tools/audio/assign_voices.py
"""
import hashlib
import re
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

# каталог → голос edge-tts (10 вариантов со страницы /voices.html)
VOICES = [
    "sonia",  # en-GB-SoniaNeural
    "libby",  # en-GB-LibbyNeural
    "maisie",  # en-GB-MaisieNeural
    "jenny",  # en-US-JennyNeural
    "aria",  # en-US-AriaNeural
    "michelle",  # en-US-MichelleNeural
    "ava",  # en-US-AvaNeural
    "emma",  # en-US-EmmaNeural
    "natasha",  # en-AU-NatashaNeural
    "emily",  # en-IE-EmilyNeural
]

VOICE_RE = re.compile(r"(audio/(?:words|phrases|quotes|phrasebook|vocab)/)[a-z0-9_-]+(/([a-z0-9-]+)\.opus)")


def assigned(stem: str) -> str:
    return VOICES[int(hashlib.sha1(stem.encode()).hexdigest(), 16) % len(VOICES)]


def main() -> None:
    total = 0
    stats: Counter[str] = Counter()
    for path in sorted(REPO.glob("data/**/*.json")):
        rel = path.relative_to(REPO).as_posix()
        if rel.startswith(("data/raw/", "data/schemas/", "data/manifest")):
            continue
        text = path.read_text(encoding="utf-8")

        def sub(m: re.Match[str]) -> str:
            voice = assigned(m.group(3))
            stats[voice] += 1
            return f"{m.group(1)}{voice}{m.group(2)}"

        updated = VOICE_RE.sub(sub, text)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            total += len(VOICE_RE.findall(text))
    print("переписано путей:", total)
    for voice, n in stats.most_common():
        print(f"  {voice}: {n}")


if __name__ == "__main__":
    main()
