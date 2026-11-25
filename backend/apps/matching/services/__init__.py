"""Public mutation boundary for the matching domain.

Thứ tự các bước: `extraction` (hồ sơ) → `encoder` (vector) → `documents` (lưu,
dùng lại) → `scoring` (điểm) → `explain` (tóm tắt, gợi ý) → `analyses` (vòng đời
một lần phân tích); `application_ranking` dùng lại vòng đời đó để chấm hồ sơ ứng
tuyển cho nhà tuyển dụng.
"""

from .analyses import (
    MatchingRequestError,
    ensure_enabled,
    execute_analysis,
    fail_analysis,
    matching_enabled,
    precompute_enabled,
    recover_stale_analyses,
    request_analysis,
)
from .application_ranking import (
    application_ranking_enabled,
    applications_needing_score,
    fail_application_score,
    jobs_with_rankable_applications,
    score_application,
    snapshots_missing_profile,
    stale_application_ids,
)
from .candidate_search import ProfileFilters, candidate_search_enabled, rank_cvs_for_job
from .documents import ensure_cv_document, ensure_job_document
from .encoder import get_encoder
from .skills import SkillCatalog

__all__ = [
    'ProfileFilters',
    'candidate_search_enabled',
    'rank_cvs_for_job',
    'application_ranking_enabled',
    'applications_needing_score',
    'fail_application_score',
    'jobs_with_rankable_applications',
    'precompute_enabled',
    'score_application',
    'snapshots_missing_profile',
    'stale_application_ids',
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
