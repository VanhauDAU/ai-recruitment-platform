from .admin import (
    CvBackgroundAdminSerializer,
    CvCategoryAdminSerializer,
    CvColorAdminSerializer,
    CvSampleContentAdminSerializer,
    CvTemplateAdminSerializer,
    CvTemplateVersionAdminSerializer,
)
from .v2 import (
    CvCategorySerializer,
    CvPositionOptionSerializer,
    CvSampleContentCardSerializer,
    CvTemplateCardSerializer,
    CvTemplateDetailSerializer,
)

__all__ = [
    'CvBackgroundAdminSerializer',
    'CvCategoryAdminSerializer',
    'CvCategorySerializer',
    'CvColorAdminSerializer',
    'CvPositionOptionSerializer',
    'CvSampleContentAdminSerializer',
    'CvSampleContentCardSerializer',
    'CvTemplateAdminSerializer',
    'CvTemplateCardSerializer',
    'CvTemplateDetailSerializer',
    'CvTemplateVersionAdminSerializer',
]
