#!/usr/bin/env python3
"""Генерация всего аудио курса голосом Kokoro (решение 2026-10-07: мягкий
женский bf_emma вместо Piper cori — «не робот»).

Отличие от gen_audio.py (Piper): Kokoro детерминирован (нет retry-вариаций
noise_scale), голос/скорость стабильны; модель та же, что в одобренных
образцах data/raw/voice-samples/ (kokoro-v1.0.onnx, fp32).

Источник заданий — сами данные: все строки вида audio/<kind>/cori/<id>.opus
в data/**/*.json. Текст для синтеза — по типу файла:
words→lemma, phrases→text_en, quotes→text, phrasebook→lines[].text_en,
vocab→en. Выход: тот же путь с cori→<voice> ( audio/…/emma/… ).

Резюмируемость: существующий .opus (>1 КБ) пропускается.
Параллель: N процессов (--workers, по умолчанию 6), модель грузится в каждом.

Запуск из корня: python3 research/tools/audio/gen_audio_kokoro.py [--workers 6]
После: switch_voice.py (пути в данных) + build_manifest.py + validate:data.
"""
import argparse
import glob
import json
import subprocess
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"
MODEL = REPO / "data/raw/models/kokoro/kokoro-v1.0.onnx"
VOICES = REPO / "data/raw/models/kokoro/voices-v1.0.bin"
FFMPEG = "ffmpeg"
MIN_OPUS_BYTES = 1024
MIN_SEC, MAX_SEC = 0.3, 8.0

_worker = {}


def _init(voice: str, speed: float) -> None:
    from kokoro_onnx import Kokoro

    _worker["kokoro"] = Kokoro(str(MODEL), str(VOICES))
    _worker["voice"] = voice
    _worker["speed"] = speed


def synth_one(job: tuple[str, str, str]) -> tuple[str, str, float]:
    """job = (name, text, out_opus). Возвращает (name, status, duration)."""
    name, text, out = job
    kokoro = _worker["kokoro"]
    audio, sr = kokoro.create(text, voice=_worker["voice"], speed=_worker["speed"], lang="en-gb")
    duration = len(audio) / sr
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    try:
        import soundfile as sf

        sf.write(str(wav_path), audio, sr)
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(wav_path), "-ac", "1", "-ar", "24000",
             "-c:a", "libopus", "-b:a", "24k", out],
            check=True,
        )
    finally:
        wav_path.unlink(missing_ok=True)
    status = "ok" if MIN_SEC <= duration <= MAX_SEC else "outlier"
    return name, status, duration


def collect_jobs(dir_name: str | None) -> list[tuple[str, str, str]]:
    """Аудио-ссылки audio/<kind>/<voice>/<file>.opus → задания.

    Голосовой сегмент любой ([a-z0-9_-]+): задания собираются по ТЕКУЩИМ
    путям в данных. dir_name=None — пути как есть (голос уже назначен в
    данных, напр. assign_voices.py); иначе сегмент заменяется на dir_name
    (полная смена голоса одним набором).
    """
    import re

    voice_re = re.compile(r"^(audio/(?:words|phrases|quotes|phrasebook|vocab)/)[a-z0-9_-]+(/.+\.opus)$")
    jobs: list[tuple[str, str, str]] = []
    seen: set[str] = set()

    def add(out: str, text: str, ref: str | None = None) -> None:
        if out in seen or not text:
            return
        seen.add(out)
        jobs.append((Path(out).stem, text, out if ref is None else f"{REPO}/{ref}"))

    for path in sorted((DATA / "words").glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            a = item.get("audio", {}).get("en_gb", "")
            m = a and voice_re.match(a)
            if m:
                add(f"{REPO}/{m.group(1)}{dir_name}{m.group(2)}", item["lemma"], ref=m.group(0) if dir_name is None else None)

    for path in sorted((DATA / "phrases").glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            a = item.get("audio", {}).get("en_gb", "")
            m = a and voice_re.match(a)
            if m:
                add(f"{REPO}/{m.group(1)}{dir_name}{m.group(2)}", item["text_en"], ref=m.group(0) if dir_name is None else None)

    for path in sorted((DATA / "quotes").glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            a = item.get("audio", {}).get("en_gb", "")
            m = a and voice_re.match(a)
            if m:
                add(f"{REPO}/{m.group(1)}{dir_name}{m.group(2)}", item["text"], ref=m.group(0) if dir_name is None else None)

    for path in sorted((DATA / "phrasebook").glob("*.json")):
        for dialog in json.loads(path.read_text(encoding="utf-8"))["items"]:
            for line in dialog["lines"]:
                a = line.get("audio", "")
                m = a and voice_re.match(a)
                if m:
                    add(f"{REPO}/{m.group(1)}{dir_name}{m.group(2)}", line["text_en"], ref=m.group(0) if dir_name is None else None)

    for path in sorted((DATA / "vocab").glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8"))["items"]:
            a = item.get("audio", "")
            m = a and voice_re.match(a)
            if m:
                add(f"{REPO}/{m.group(1)}{dir_name}{m.group(2)}", item["en"], ref=m.group(0) if dir_name is None else None)

    return jobs


def main() -> None:
    ap = argparse.ArgumentParser(description="Аудио курса: Kokoro → Opus 24k")
    ap.add_argument("--voice", default="bf_emma")
    ap.add_argument("--dir", default="emma", help="сегмент каталога (audio/<kind>/<dir>)")
    ap.add_argument("--speed", type=float, default=0.9)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0, help="смок-режим: первые N заданий")
    args = ap.parse_args()

    jobs = collect_jobs(args.dir)
    if args.limit:
        jobs = jobs[: args.limit]
    todo = [
        (n, t, o)
        for n, t, o in jobs
        if not (Path(o).exists() and Path(o).stat().st_size > MIN_OPUS_BYTES)
    ]
    print(f"заданий всего {len(jobs)}, к синтезу {len(todo)}; голос {args.voice}, "
          f"speed {args.speed}, воркеров {args.workers}")
    if not todo:
        return

    t0 = time.time()
    done = outliers = 0
    with ProcessPoolExecutor(
        max_workers=args.workers, initializer=_init, initargs=(args.voice, args.speed)
    ) as pool:
        futures = {pool.submit(synth_one, job): job[0] for job in todo}
        for future in as_completed(futures):
            name, status, duration = future.result()
            done += 1
            if status == "outlier":
                outliers += 1
                print(f"OUTLIER {name}: {duration:.2f} с вне {MIN_SEC}–{MAX_SEC}")
            if done % 200 == 0:
                rate = done / (time.time() - t0)
                print(f"{done}/{len(todo)} ({rate:.1f}/с, осталось "
                      f"{(len(todo) - done) / rate / 60:.0f} мин), outliers {outliers}", flush=True)
    print(f"итог: синтез {done}, outliers {outliers}, "
          f"{(time.time() - t0) / 60:.1f} мин всего")


if __name__ == "__main__":
    main()
