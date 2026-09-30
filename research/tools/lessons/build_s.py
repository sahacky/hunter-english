#!/usr/bin/env python3
"""Сборка контента ранга S — полный ранг (S1–S3), план M20. specs/01 §10."""
from build_s_pools import LESSONS_S1
from build_s_pools2 import LESSONS_S2
from build_s_pools3 import LESSONS_S3
from build_e1 import build_rank

if __name__ == "__main__":
    build_rank(LESSONS_S1 + LESSONS_S2 + LESSONS_S3, rank="S", stem="s", seed=20261001)
