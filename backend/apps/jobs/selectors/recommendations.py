"""Public selector facade for deterministic CV-to-job ranking."""

from ..models.recommendation_queries import (
    MIN_RECOMMENDATION_SCORE,
    RecommendationConsentRequired,
    recommend_inline_jobs_for_candidate,
    recommend_jobs_for_candidate,
    recommend_jobs_for_cv,
    recommend_new_jobs_for_candidate_email,
    rule_scores_for_cv,
)

__all__ = [
    'MIN_RECOMMENDATION_SCORE',
    'RecommendationConsentRequired',
    'recommend_inline_jobs_for_candidate',
    'recommend_jobs_for_candidate',
    'recommend_jobs_for_cv',
    'recommend_new_jobs_for_candidate_email',
    'rule_scores_for_cv',
]
