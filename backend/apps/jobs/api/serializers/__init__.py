"""Public serializers grouped by jobs use case."""

from .catalogs import BenefitSerializer, LanguageSerializer
from .jobs import (
    EmployerJobDetailSerializer,
    EmployerJobDraftSerializer,
    EmployerJobListSerializer,
    EmployerJobWriteSerializer,
    JobDetailSerializer,
    JobSerializer,
    PublicJobListSerializer,
    PublicJobPreviewSerializer,
)
from .moderation import AdminJobModerationSerializer, AdminJobReviewSerializer
from .recommendations import (
    CandidateJobRecommendationResponseSerializer,
    CvJobRecommendationResponseSerializer,
    RecommendationPermissionDeniedSerializer,
    SavedJobRecommendationResponseSerializer,
)
from .reports import (
    AdminJobReportResolveSerializer,
    AdminJobReportSerializer,
    JobReportCreateSerializer,
)
from .saved import SavedJobSerializer
from .supporting import (
    JobApplicationContactSerializer,
    JobApplicationEmailSerializer,
    JobBenefitSerializer,
    JobCategoryAssignmentSerializer,
    JobCategoryListSerializer,
    JobCategorySerializer,
    JobLanguageRequirementSerializer,
    JobLocationSerializer,
    JobSkillSerializer,
    JobWorkScheduleSerializer,
    PublicJobBenefitSerializer,
    PublicJobLanguageRequirementSerializer,
    PublicJobLocationSerializer,
    PublicJobWorkScheduleSerializer,
)

__all__ = [
    'BenefitSerializer',
    'AdminJobModerationSerializer',
    'AdminJobReviewSerializer',
    'CandidateJobRecommendationResponseSerializer',
    'CvJobRecommendationResponseSerializer',
    'EmployerJobDetailSerializer',
    'EmployerJobDraftSerializer',
    'EmployerJobListSerializer',
    'EmployerJobWriteSerializer',
    'JobApplicationContactSerializer',
    'JobApplicationEmailSerializer',
    'JobBenefitSerializer',
    'JobCategoryAssignmentSerializer',
    'JobCategoryListSerializer',
    'JobCategorySerializer',
    'JobDetailSerializer',
    'JobLanguageRequirementSerializer',
    'JobLocationSerializer',
    'AdminJobReportResolveSerializer',
    'AdminJobReportSerializer',
    'JobReportCreateSerializer',
    'JobSerializer',
    'JobSkillSerializer',
    'JobWorkScheduleSerializer',
    'LanguageSerializer',
    'PublicJobBenefitSerializer',
    'PublicJobLanguageRequirementSerializer',
    'PublicJobListSerializer',
    'PublicJobLocationSerializer',
    'PublicJobPreviewSerializer',
    'PublicJobWorkScheduleSerializer',
    'RecommendationPermissionDeniedSerializer',
    'SavedJobRecommendationResponseSerializer',
    'SavedJobSerializer',
]
