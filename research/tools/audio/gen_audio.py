#!/usr/bin/env python3
"""Генерация аудио слов: Piper (en_GB, голос cori) → Opus 24 кГц mono, 24k.

plan://M3#3.7 (инфраструктура озвучки, решение по голосу — research/02).

Вход (один из):
  --list  FILE   текстовый файл, строки "id<TAB>текст" (# — комментарий)
  --words GLOB   файлы data/words/*.json (envelope из specs/05 §1);
                 текст для синтеза — поле lemma, имя файла — поле id

Выход: <out-dir>/<id>.opus (libopus, mono, 24000 Hz, bitrate 24k).
Возобновляемость: если <out-dir>/<id>.opus уже существует и > 200 байт — пропуск.
Пайплайн на запись: синтез во временный WAV → ffmpeg → opus → удаление WAV.
Обработка строго последовательная; прогресс — каждые 25 слов.
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
MIN_OPUS_BYTES = 200
PROGRESS_EVERY = 25

FFMPEG = shutil.which("ffmpeg") or str(Path.home() / ".local/bin/ffmpeg")


def records_from_list(p: Path) -> list[tuple[str, str]]:
    rows = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        word_id, sep, text = line.partition("\t")
        if not sep or not word_id or not text:
            print(f"пропуск строки без TAB: {line[:60]!r}")
            continue
        rows.append((word_id.strip(), text.strip()))
    return rows


def records_from_words(glob: str) -> list[tuple[str, str]]:
    rows = []
    files = sorted(REPO.glob(glob))
    if not files:
        sys.exit(f"--words: ничего не найдено по {glob} от {REPO}")
    for fp in files:
        data = json.loads(fp.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            word_id, lemma = item.get("id"), item.get("lemma")
            if word_id and lemma:
                rows.append((word_id, lemma))
    return rows


def synth_one(voice, text: str, out_opus: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    try:
        with wave.open(str(wav_path), "wb") as wf:
            voice.synthesize_wav(text, wf)
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(wav_path),
             "-ac", "1", "-ar", "24000",
             "-c:a", "libopus", "-b:a", "24k",
             str(out_opus)],
            check=True,
        )
    finally:
        wav_path.unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Аудио слов: Piper cori → Opus")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--list", type=Path, help="файл 'id<TAB>текст'")
    src.add_argument("--words", help="glob от корня репо, напр. 'data/words/*.json'")
    ap.add_argument("--out-dir", type=Path, default=Path("audio/words/cori"))
    ap.add_argument("--model", type=Path,
                    default=REPO / "data/raw/models/piper/en_GB-cori-high.onnx")
    args = ap.parse_args()

    out_dir = args.out_dir if args.out_dir.is_absolute() else REPO / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    records = records_from_list(args.list) if args.list else records_from_words(args.words)
    print(f"записей: {len(records)}; out: {out_dir}")

    from piper import PiperVoice
    t0 = time.time()
    voice = PiperVoice.load(args.model)
    print(f"модель: {args.model.name} (загрузка {time.time() - t0:.1f} с)")

    done = skipped = errors = 0
    t_start = time.time()
    for i, (word_id, text) in enumerate(records, 1):
        out_opus = out_dir / f"{word_id}.opus"
        try:
            if out_opus.exists() and out_opus.stat().st_size > MIN_OPUS_BYTES:
                skipped += 1
            else:
                synth_one(voice, text, out_opus)
                done += 1
        except Exception as e:  # noqa: BLE001 — пишем дальше, ошибка в итогах
            errors += 1
            print(f"ОШИБКА {word_id}: {e}")
        if i % PROGRESS_EVERY == 0:
            rate = i / (time.time() - t_start)
            print(f"[{i}/{len(records)}] {rate:.1f} слов/с")
    total_time = time.time() - t_start
    new_cnt = max(done, 1)
    print(f"итог: сделано {done}, пропущено {skipped}, ошибок {errors}; "
          f"{total_time:.1f} с всего, {total_time / new_cnt:.2f} с на новое слово")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
