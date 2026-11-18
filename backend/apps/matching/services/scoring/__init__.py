"""Chấm điểm một cặp CV–tin (công thức ``hybrid-v1``); chi tiết ở ``engine``."""

from .engine import (
    LANGUAGE_REQUIRED_CAP,
    LEVELS,
    SCORING_VERSION,
    SKILL_EXCLUDED_SECTIONS,
    WEIGHTS,
    ScoringError,
    score_match,
)

__all__ = [
    'LANGUAGE_REQUIRED_CAP',
    'LEVELS',
    'SCORING_VERSION',
    'SKILL_EXCLUDED_SECTIONS',
    'ScoringError',
    'WEIGHTS',
    'score_match',
]
