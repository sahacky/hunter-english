#!/usr/bin/env python3
"""Аудио пре-урока E-00 «Азбука и первые слова» (plan://first-lessons-a0#V3).

Каталог audio/basics/<voice>/<key>.opus — голос из смеси 10 по FNV-1a хэшу
ключа (то же правило в src/content/basics.ts: fnv1a должен совпадать!).
Синтез edge-tts последовательно (анти-гонка — см. gen_audio_edge.py).

Запуск из корня: python3 research/tools/audio/gen_basics_audio.py
"""
import asyncio
import hashlib
import subprocess
import tempfile
from pathlib import Path

import edge_tts

REPO = Path(__file__).resolve().parents[3]
OUT_ROOT = REPO / "audio" / "basics"

VOICE_MAP = {
    "sonia": "en-GB-SoniaNeural",
    "libby": "en-GB-LibbyNeural",
    "maisie": "en-GB-MaisieNeural",
    "jenny": "en-US-JennyNeural",
    "aria": "en-US-AriaNeural",
    "michelle": "en-US-MichelleNeural",
    "ava": "en-US-AvaNeural",
    "emma": "en-US-EmmaNeural",
    "natasha": "en-AU-NatashaNeural",
    "emily": "en-IE-EmilyNeural",
}
VOICES = sorted(VOICE_MAP)  # порядок как в assign_voices.VOICES (a-z) + fnv

# синхронизировано с src/content/basics.ts
LETTERS = list("abcdefghijklmnopqrstuvwxyz")
WORDS = [
    "hello", "hi", "good", "morning", "day", "I", "you", "he", "she", "it",
    "we", "they", "am", "is", "are", "my", "your", "his", "her", "name",
    "girl", "boy", "man", "woman", "friend", "yes", "no", "and", "please", "thank you",
]


def fnv1a(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h = ((h ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
    return h


def voice_for(key: str) -> str:
    return VOICES[fnv1a(key) % len(VOICES)]


async def synth(key: str, text: str) -> None:
    voice_dir = voice_for(key)
    out = OUT_ROOT / voice_dir / f"{key.lower().replace(' ', '-')}.opus"
    if out.exists() and out.stat().st_size > 1024:
        return
    voice = VOICE_MAP[voice_dir]
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        mp3 = Path(tmp.name)
    try:
        await edge_tts.Communicate(text, voice).save(str(mp3))
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(mp3), "-ac", "1", "-ar", "24000",
             "-c:a", "libopus", "-b:a", "24k", str(out)],
            check=True,
        )
        print(key, "→", voice_dir)
    finally:
        mp3.unlink(missing_ok=True)


async def main() -> None:
    for letter in LETTERS:
        await synth(f"letter-{letter}", letter.upper())
    for word in WORDS:
        await synth(f"word-{word}", word)
    print("готово")


if __name__ == "__main__":
    asyncio.run(main())
