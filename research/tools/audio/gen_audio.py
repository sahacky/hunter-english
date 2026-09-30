#!/usr/bin/env python3
"""Генерация аудио слов: Piper (en_GB, голос cori) → Opus 24 кГц mono, 24k.

plan://M3#3.7 (инфраструктура озвучки, решение по голосу — research/02).

Вход (один из):
  --list  FILE   текстовый файл, строки "id<TAB>текст" (# — комментарий)
  --words GLOB   файлы data/words/*.json (envelope из specs/05 §1);
                 текст для синтеза — поле lemma, имя файла — поле id

Выход: <out-dir>/<id>.opus (libopus, mono, 24000 Hz, bitrate 24k).
Возобновляемость: если <out-dir>/<id>.opus уже существует и > MIN_OPUS_BYTES — пропуск.
Гейт длительности: после синтеза длительность WAV меряется модулем wave
(кадры/частота); при < 0.30 с или > 2.5 с — повторный синтез (до 3 попыток,
с вариацией noise_scale/noise_w_scale — Piper недетерминирован); если ни одна
попытка не попала в гейт — записывается последняя, а id попадает в outliers.
--gc: удалить из out-dir файлы, чей id не встречается во входных данных.
Обработка строго последовательная; прогресс — каждые 25 слов.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
# Быстрый предфильтр возобновляемости: обрыв синтеза даёт крошечный файл
# (невалидный/усечённый opus). Полный контроль качества — гейт длительности ниже.
MIN_OPUS_BYTES = 200
PROGRESS_EVERY = 25
MIN_SEC, MAX_SEC = 0.30, 2.5
ID_RE = re.compile(r"[a-z0-9-]+")
# Вариации шума для повторных попыток (Piper недетерминирован при разном seed).
ATTEMPT_CONFIGS = [
    {},
    {"noise_scale": 0.8, "noise_w_scale": 1.0},
    {"noise_scale": 0.5, "noise_w_scale": 0.6},
]

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


def synth_wav(voice, text: str, cfg: dict) -> tuple[Path, float]:
    """Синтез во временный WAV; возвращает путь и длительность в секундах."""
    from piper import SynthesisConfig

    syn_config = SynthesisConfig(**cfg) if cfg else None
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    with wave.open(str(wav_path), "wb") as wf:
        voice.synthesize_wav(text, wf, syn_config=syn_config)
    with wave.open(str(wav_path), "rb") as wf:
        duration = wf.getnframes() / wf.getframerate()
    return wav_path, duration


def wav_to_opus(wav_path: Path, out_opus: Path) -> None:
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(wav_path),
         "-ac", "1", "-ar", "24000",
         "-c:a", "libopus", "-b:a", "24k",
         str(out_opus)],
        check=True,
    )


def synth_one(voice, text: str, out_opus: Path, max_sec: float = MAX_SEC) -> bool:
    """Синтез с гейтом длительности. True — попытка попала в гейт."""
    wav_path: Path | None = None
    in_gate = False
    try:
        for cfg in ATTEMPT_CONFIGS:
            wav_path, duration = synth_wav(voice, text, cfg)
            if MIN_SEC <= duration <= max_sec:
                in_gate = True
                break
        wav_to_opus(wav_path, out_opus)
    finally:
        if wav_path is not None:
            wav_path.unlink(missing_ok=True)
    return in_gate


def main() -> int:
    ap = argparse.ArgumentParser(description="Аудио слов: Piper cori → Opus")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--list", type=Path, help="файл 'id<TAB>текст'")
    src.add_argument("--words", help="glob от корня репо, напр. 'data/words/*.json'")
    ap.add_argument("--out-dir", type=Path, default=Path("audio/words/cori"))
    ap.add_argument("--model", type=Path,
                    default=REPO / "data/raw/models/piper/en_GB-cori-high.onnx")
    ap.add_argument("--gc", action="store_true",
                    help="удалить из out-dir файлы, чей id не во входных данных")
    ap.add_argument("--max-sec", type=float, default=MAX_SEC,
                    help="верхний гейт длительности (M20: 6.0 для длинных C1-фраз)")
    args = ap.parse_args()

    out_dir = args.out_dir if args.out_dir.is_absolute() else REPO / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    records = records_from_list(args.list) if args.list else records_from_words(args.words)
    print(f"записей: {len(records)}; out: {out_dir}")

    if args.gc:
        keep = {word_id for word_id, _ in records}
        removed = 0
        for f in sorted(out_dir.glob("*.opus")):
            if f.stem not in keep:
                f.unlink()
                removed += 1
                print(f"gc: удалён {f.name}")
        print(f"gc: удалено {removed}")

    from piper import PiperVoice
    t0 = time.time()
    voice = PiperVoice.load(args.model)
    print(f"модель: {args.model.name} (загрузка {time.time() - t0:.1f} с)")

    done = skipped = errors = bad_ids = outliers = 0
    outlier_ids: list[str] = []
    t_start = time.time()
    for i, (word_id, text) in enumerate(records, 1):
        if not ID_RE.fullmatch(word_id):
            bad_ids += 1
            print(f"пропуск id мимо шаблона [a-z0-9-]+: {word_id!r}")
            continue
        out_opus = out_dir / f"{word_id}.opus"
        try:
            if out_opus.exists() and out_opus.stat().st_size > MIN_OPUS_BYTES:
                skipped += 1
            else:
                if synth_one(voice, text, out_opus, args.max_sec):
                    done += 1
                else:
                    outliers += 1
                    outlier_ids.append(word_id)
                    print(f"OUTLIER {word_id}: длительность вне {MIN_SEC}–{args.max_sec} с "
                          f"после {len(ATTEMPT_CONFIGS)} попыток")
        except Exception as e:  # noqa: BLE001 — пишем дальше, ошибка в итогах
            errors += 1
            print(f"ОШИБКА {word_id}: {e}")
        if i % PROGRESS_EVERY == 0:
            rate = i / (time.time() - t_start)
            print(f"[{i}/{len(records)}] {rate:.1f} слов/с")
    total_time = time.time() - t_start
    new_cnt = max(done + outliers, 1)
    print(f"итог: сделано {done}, пропущено {skipped}, ошибок {errors}, "
          f"id мимо шаблона {bad_ids}, outlier-ов {outliers}; "
          f"{total_time:.1f} с всего, {total_time / new_cnt:.2f} с на новое слово")
    if outlier_ids:
        print("outliers:", ", ".join(outlier_ids))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
