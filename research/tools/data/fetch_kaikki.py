#!/usr/bin/env python3
"""Батч-скачка переводов Wiktionary через kaikki.org (возобновляемо).

Для каждого слова из списка качает meaning-JSONL:
  https://kaikki.org/dictionary/English/meaning/<a>/<ab>/<word>.jsonl
Файлы складываются в data/raw/kaikki/words/. Существующие пропускаются,
429/5xx — экспоненциальная пауза.

Запуск: python3 research/tools/data/fetch_kaikki.py [target_list.txt]
(по умолчанию data/raw/kaikki/target_words.txt)
"""
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / "data/raw"
LIST_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else RAW / "kaikki/target_words.txt"
TARGETS = LIST_PATH.read_text(encoding="utf-8").split()
OUTDIR = RAW / "kaikki/words"
OUTDIR.mkdir(parents=True, exist_ok=True)
BASE = "https://kaikki.org/dictionary/English/meaning/{a}/{ab}/{w}.jsonl"


def fetch(word: str) -> tuple[bool, str]:
    q = urllib.parse.quote(word)
    url = BASE.format(a=word[0], ab=word[:2], w=q)
    req = urllib.request.Request(url, headers={"User-Agent": "hunter-english-data/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        return False, str(e.code)
    except Exception as e:
        return False, str(e)[:60]
    (OUTDIR / f"{word}.jsonl").write_bytes(data)
    return True, "ok"


def main():
    done = fail = 0
    for i, w in enumerate(TARGETS, 1):
        dest = OUTDIR / f"{w}.jsonl"
        if dest.exists() and dest.stat().st_size > 0:
            done += 1
            continue
        pause = 2
        info = ""
        for attempt in range(4):
            ok, info = fetch(w)
            if ok:
                done += 1
                pause = 2
                break
            if info in ("404",):
                (OUTDIR / f"{w}.miss").write_text("404", encoding="utf-8")
                fail += 1
                break
            time.sleep(pause)
            pause = min(pause * 3, 120)
        else:
            fail += 1
            with open(OUTDIR.parent / "kaikki_failures.log", "a") as f:
                f.write(f"{w} {info}\n")
        if i % 10 == 0:
            print(f"{time.strftime('%H:%M:%S')} {i}/{len(TARGETS)} ok={done} fail={fail}", flush=True)
        time.sleep(1.2)
    print(f"DONE ok={done} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
