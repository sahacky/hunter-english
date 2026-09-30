#!/usr/bin/env python3
"""Сборка контента ранга B — модуль B1 «Совершенное» + B2 «Если и когда»,
plan://M15#15.1–15.2. specs/01 §8.
"""
from build_b_pools import LESSONS_B1_B2
from build_b_pools2 import LESSONS_B3_B5
from build_e1 import build_rank

if __name__ == "__main__":
    build_rank(LESSONS_B1_B2 + LESSONS_B3_B5, rank="B", stem="b", seed=20261001)
