#!/usr/bin/env python3
"""Генерация всего аудио курса голосом Microsoft Edge Online Voices
(решение 2026-10-07, вторая смена: Kokoro плохо тянет одиночные слова —
на повторениях звучит «электронно»; edge-tts даёт самый стандартный
живой женский нейро-голос. Выбор: en-GB-SoniaNeural).

Список заданий и резюмируемость — общие с gen_audio_kokoro.py
(collect_jobs). Синтез требует интернет (сервис Edge), на выходе те же
opus 24 кГц mono — рантайм офлайн-first не меняется.

Параллель: asyncio + семафор (--concurrency, по умолчанию 5), ретраи
с бэкоффом на сетевых сбоях/тротлинге.

Запуск из корня: python3 research/tools/audio/gen_audio_edge.py
После: switch_voice.py sonia + build_manifest.py + validate:data.
"""
import argparse
import asyncio
import subprocess
import tempfile
import time
from pathlib import Path

import edge_tts

from gen_audio_kokoro import MIN_OPUS_BYTES, collect_jobs

REPO = Path(__file__).resolve().parents[3]
VOICE = "en-GB-SoniaNeural"


async def synth_one(sem: asyncio.Semaphore, name: str, text: str, out: str) -> tuple[str, str]:
    """Один клип: mp3 во временный файл → ffmpeg → opus. Ретраи с бэкоффом."""
    for attempt in range(5):
        try:
            async with sem:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    mp3_path = Path(tmp.name)
                try:
                    communicate = edge_tts.Communicate(text, VOICE)
                    await communicate.save(str(mp3_path))
                    if mp3_path.stat().st_size < 512:
                        raise RuntimeError("пустой mp3 от сервиса")
                    Path(out).parent.mkdir(parents=True, exist_ok=True)
                    subprocess.run(
                        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                         "-i", str(mp3_path), "-ac", "1", "-ar", "24000",
                         "-c:a", "libopus", "-b:a", "24k", out],
                        check=True,
                    )
                    return name, "ok"
                finally:
                    mp3_path.unlink(missing_ok=True)
        except Exception as e:  # noqa: BLE001 — сетевые сбои: ретрай с бэкоффом
            if attempt == 4:
                print(f"FAIL {name}: {e}")
                return name, "fail"
            await asyncio.sleep(2 ** attempt)

    return name, "fail"  # недостижимо (гарды выше), для линтера


async def main_async(args: argparse.Namespace) -> None:
    jobs = collect_jobs(args.dir)
    if args.limit:
        jobs = jobs[: args.limit]
    todo = [
        (n, t, o)
        for n, t, o in jobs
        if not (Path(o).exists() and Path(o).stat().st_size > MIN_OPUS_BYTES)
    ]
    print(f"заданий всего {len(jobs)}, к синтезу {len(todo)}; голос {VOICE}, "
          f"каталог {args.dir}, параллель {args.concurrency}", flush=True)
    if not todo:
        return
    sem = asyncio.Semaphore(args.concurrency)
    t0 = time.time()
    done = fails = 0
    for coro in asyncio.as_completed(
        [synth_one(sem, n, t, o) for n, t, o in todo]
    ):
        _, status = await coro
        done += 1
        fails += status == "fail"
        if done % 200 == 0:
            rate = done / (time.time() - t0)
            print(f"{done}/{len(todo)} ({rate:.1f}/с, осталось "
                  f"{(len(todo) - done) / rate / 60:.0f} мин), ошибок {fails}", flush=True)
    print(f"итог: синтез {done}, ошибок {fails}, {(time.time() - t0) / 60:.1f} мин всего")


def main() -> None:
    ap = argparse.ArgumentParser(description="Аудио курса: edge-tts → Opus 24k")
    ap.add_argument("--dir", default="sonia", help="сегмент каталога (audio/<kind>/<dir>)")
    ap.add_argument("--concurrency", type=int, default=5)
    ap.add_argument("--limit", type=int, default=0, help="смок-режим: первые N заданий")
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
