#!/usr/bin/env python3
"""Сборка контента ранга A — полный ранг (A1–A4), план M16. specs/01 §9."""
from build_a_pools import LESSONS_A1_A2
from build_a_pools2 import LESSONS_A3_A4
from build_e1 import build_rank

if __name__ == "__main__":
    build_rank(LESSONS_A1_A2 + LESSONS_A3_A4, rank="A", stem="a", seed=20261002)
