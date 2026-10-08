#!/usr/bin/env python3
"""Генерация аудио курса голосами Microsoft Edge Online Voices.

Решение 2026-10-08: 10 женских голосов вперемешку (assign_voices.py) —
голос каждого клипа определяется сегментом пути audio/<kind>/<voice>/.

КРИТИЧНО: edge-tts портит файлы при конкурентных save() в одном event loop
(инцидент 2026-10-08: весь батч — клипы ровно 1.88 с битого звука). Поэтому
параллель — ТОЛЬКО процессами: каждый воркер держит собственный event loop
и обрабатывает задания строго последовательно.

Список заданий — общий сборщик (gen_audio_kokoro.collect_jobs): по текущим
аудио-путям в data/. Резюмируемость: готовый .opus (>1 КБ) пропускается.
Синтез требует интернет; выход — opus 24 кГц mono (рантайм офлайн-first).

Запуск из корня: python3 research/tools/audio/gen_audio_edge.py [--workers 6]
"""
import argparse
import asyncio
import subprocess
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from gen_audio_kokoro import MIN_OPUS_BYTES, collect_jobs

REPO = Path(__file__).resolve().parents[3]

# сегмент пути → имя голоса edge-tts (должен совпадать с assign_voices.VOICES)
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

_worker: dict[str, object] = {}


def _init() -> None:
    import edge_tts

    _worker["edge_tts"] = edge_tts
    _worker["loop"] = asyncio.new_event_loop()


def _run_coro(coro):
    return _worker["loop"].run_until_complete(coro)


async def _synth_mp3(edge_tts, text: str, voice: str, mp3_path: Path) -> None:
    await edge_tts.Communicate(text, voice).save(str(mp3_path))
    if mp3_path.stat().st_size < 512:
        raise RuntimeError("пустой mp3 от сервиса")


def synth_one(job: tuple[str, str, str]) -> tuple[str, str]:
    """job = (name, text, out_opus). Возвращает (name, status). Один процесс —
    последовательные задания (анти-гонка edge-tts), ретраи с бэкоффом."""
    name, text, out = job
    voice = VOICE_MAP[Path(out).parts[-2]]
    edge_tts = _worker["edge_tts"]
    for attempt in range(5):
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                mp3_path = Path(tmp.name)
            try:
                _run_coro(_synth_mp3(edge_tts, text, voice, mp3_path))
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
        except Exception as e:  # noqa: BLE001 — сеть/сервис: ретрай с бэкоффом
            if attempt == 4:
                print(f"FAIL {name}: {e}", flush=True)
                return name, "fail"
            time.sleep(2 ** attempt)
    return name, "fail"  # недостижимо, для линтера


def main() -> None:
    ap = argparse.ArgumentParser(description="Аудио курса: edge-tts (10 голосов) → Opus 24k")
    ap.add_argument("--workers", type=int, default=6, help="ПРОЦЕССОВ (не потоков!)")
    ap.add_argument("--limit", type=int, default=0, help="смок-режим: первые N заданий")
    args = ap.parse_args()

    jobs = collect_jobs(None)  # голос уже назначен в данных (assign_voices)
    if args.limit:
        jobs = jobs[: args.limit]
    todo = [
        (n, t, o)
        for n, t, o in jobs
        if not (Path(o).exists() and Path(o).stat().st_size > MIN_OPUS_BYTES)
    ]
    from collections import Counter

    voices = Counter(Path(o).parts[-2] for _, _, o in todo)
    print(f"заданий всего {len(jobs)}, к синтезу {len(todo)}; процессов {args.workers}; "
          f"по голосам: {dict(voices)}", flush=True)
    if not todo:
        return
    t0 = time.time()
    done = fails = 0
    with ProcessPoolExecutor(max_workers=args.workers, initializer=_init) as pool:
        futures = {pool.submit(synth_one, job): job[0] for job in todo}
        for future in as_completed(futures):
            _, status = future.result()
            done += 1
            fails += status == "fail"
            if done % 200 == 0:
                rate = done / (time.time() - t0)
                print(f"{done}/{len(todo)} ({rate:.1f}/с, осталось "
                      f"{(len(todo) - done) / rate / 60:.0f} мин), ошибок {fails}", flush=True)
    print(f"итог: синтез {done}, ошибок {fails}, {(time.time() - t0) / 60:.1f} мин всего")


if __name__ == "__main__":
    main()
