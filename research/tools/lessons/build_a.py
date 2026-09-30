#!/usr/bin/env python3
"""Сборка контента ранга A — модуль A1+A2, план M16#16.1–16.2. specs/01 §9."""
from build_a_pools import LESSONS_A1_A2
from build_e1 import build_rank

if __name__ == "__main__":
    build_rank(LESSONS_A1_A2, rank="A", stem="a", seed=20261002)
