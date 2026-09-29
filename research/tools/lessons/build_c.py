#!/usr/bin/env python3
"""Сборка контента ранга C — модули C1 «Прошлое» (C-01…C-10) и C2 «Будущее»
(C-11…C-15), plan://M14#14.1–14.3. Паттерн build_d (движок build_e1.build_rank).
"""
from build_c_pools import LESSONS_C1_C2
from build_c_pools2 import LESSONS_C3_C5
from build_e1 import build_rank

if __name__ == "__main__":
    # Полный ранг C: C1+C2 (этап 1) + C3/C4/C5 (этап 2, план M14#14.7)
    build_rank(LESSONS_C1_C2 + LESSONS_C3_C5, rank="C", stem="c", seed=20260930)
