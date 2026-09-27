#!/usr/bin/env python3
"""Генерация data/manifest.json (specs/05 §7, план://M3#3.7).

Манифест сборки данных: список файлов (kind, schema_version, число записей,
sha256 содержимого) и дата сборки (UTC) — по ним приложение понимает, что
докэшировать (PWA) и что обновилось. Вызывается после сборки данных:
research/tools/data/build_manifest.py
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data"


def main():
    files = []
    for p in sorted(DATA.rglob("*.json")):
        rel = p.relative_to(DATA).as_posix()
        if rel == "manifest.json" or rel.startswith("schemas/") or rel.startswith("raw/"):
            continue
        raw = p.read_text(encoding="utf-8")
        try:
            env = json.loads(raw)
        except ValueError:
            sys.exit(f"битый JSON в data/: {p} — исправь или перегенерируй файл")
        files.append(
            {
                "path": rel,
                "kind": env.get("kind"),
                "schema_version": env.get("schema_version"),
                "items": len(env.get("items", [])),
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            }
        )
    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": files,
    }
    out = DATA / "manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(f["items"] for f in files)
    print(f"manifest.json: {len(files)} файлов, {total} записей")


if __name__ == "__main__":
    main()
