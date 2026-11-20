"""Xếp hạng việc làm theo luật cố định từ nhu cầu đã khai báo và CV đã lưu.

Đặt ở ``models`` vì cả selectors (trang gợi ý) lẫn services (email digest) cùng dùng.
"""

from .context import RecommendationConsentRequired
from .ranking import (
    MAX_SCORING_CANDIDATES,
    recommend_inline_jobs_for_candidate,
    recommend_jobs_for_candidate,
    recommend_jobs_for_cv,
    recommend_new_jobs_for_candidate_email,
    rule_scores_for_cv,
)
from .scoring import EXPERIENCE_RANK, MIN_RECOMMENDATION_SCORE

__all__ = [
    'EXPERIENCE_RANK',
    'MAX_SCORING_CANDIDATES',
    'MIN_RECOMMENDATION_SCORE',
    'RecommendationConsentRequired',
    'recommend_inline_jobs_for_candidate',
    'recommend_jobs_for_candidate',
    'recommend_jobs_for_cv',
    'recommend_new_jobs_for_candidate_email',
    'rule_scores_for_cv',
]
