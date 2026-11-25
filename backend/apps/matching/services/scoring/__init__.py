"""Chấm điểm một cặp CV–tin (công thức ``hybrid-v2``); chi tiết ở ``engine``."""

from ...domain import SCORING_VERSION
from .engine import (
    ABLATIONS,
    GENERIC_CRITERIA,
    LANGUAGE_REQUIRED_CAP,
    LEVELS,
    SKILL_EXCLUDED_SECTIONS,
    WEIGHTS,
    ScoringError,
    score_match,
)

__all__ = [
    'ABLATIONS',
    'GENERIC_CRITERIA',
    'LANGUAGE_REQUIRED_CAP',
    'LEVELS',
    'SCORING_VERSION',
    'SKILL_EXCLUDED_SECTIONS',
    'ScoringError',
    'WEIGHTS',
    'score_match',
]
