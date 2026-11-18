"""Public mutation boundary for the matching domain.

Thứ tự các bước: `extraction` (hồ sơ) → `encoder` (vector) → `documents` (lưu,
dùng lại) → `scoring` (điểm) → `explain` (tóm tắt, gợi ý) → `analyses` (vòng đời
một lần phân tích).
"""

from .analyses import (
    MatchingRequestError,
    ensure_enabled,
    execute_analysis,
    fail_analysis,
    matching_enabled,
    recover_stale_analyses,
    request_analysis,
)
from .documents import ensure_cv_document, ensure_job_document
from .encoder import get_encoder
from .skills import SkillCatalog

__all__ = [
    'MatchingRequestError',
    'SkillCatalog',
    'ensure_cv_document',
    'ensure_enabled',
    'ensure_job_document',
    'execute_analysis',
    'fail_analysis',
    'get_encoder',
    'matching_enabled',
    'recover_stale_analyses',
    'request_analysis',
]
