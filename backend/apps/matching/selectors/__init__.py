"""Public read boundary for the matching domain."""

from .analyses import owner_analysis, recent_owner_analyses
from .application_ranking import (
    application_match_annotations,
    application_match_detail,
    match_status,
)
from .extracted_profile import (
    OWNER,
    RECRUITER_SEARCH,
    application_cv_profile,
    cv_profile_document,
    owner_cv_profile,
    public_cv_profile,
)
from .profiles import (
    cvs_for_profile,
    latest_cv_versions,
    owner_cv_for_matching,
    public_job_for_profile,
)
from .recommendations import (
    MIN_SEMANTIC_SCORE,
    Bonus,
    RankingIntent,
    cv_document_for,
    rank_jobs_for_cv,
    recommendation_cv,
)
from .recommendations import (
    STRATEGY as SEMANTIC_STRATEGY,
)

__all__ = [
    'application_cv_profile',
    'OWNER',
    'RECRUITER_SEARCH',
    'cv_profile_document',
    'owner_cv_profile',
    'public_cv_profile',
    'application_match_annotations',
    'application_match_detail',
    'match_status',
    'MIN_SEMANTIC_SCORE',
    'SEMANTIC_STRATEGY',
    'Bonus',
    'RankingIntent',
    'cv_document_for',
    'rank_jobs_for_cv',
    'recommendation_cv',
    'cvs_for_profile',
    'latest_cv_versions',
    'owner_analysis',
    'owner_cv_for_matching',
    'public_job_for_profile',
    'recent_owner_analyses',
]
