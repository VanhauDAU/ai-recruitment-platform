from .admin import (
    CvBackgroundAdminSerializer,
    CvCategoryAdminSerializer,
    CvColorAdminSerializer,
    CvContentBlueprintAdminSerializer,
    CvSampleContentAdminSerializer,
    CvTemplateAdminSerializer,
    CvTemplateLocalizationAdminSerializer,
    CvTemplateVersionAdminSerializer,
)
from .legacy import CvTemplateSerializer
from .v2 import (
    CvCategorySerializer,
    CvPositionOptionSerializer,
    CvSampleContentCardSerializer,
    CvSampleContentDetailSerializer,
    CvTemplateCardSerializer,
    CvTemplateDetailSerializer,
)

__all__ = [
    'CvBackgroundAdminSerializer',
    'CvCategoryAdminSerializer',
    'CvCategorySerializer',
    'CvColorAdminSerializer',
    'CvContentBlueprintAdminSerializer',
    'CvPositionOptionSerializer',
    'CvSampleContentAdminSerializer',
    'CvSampleContentCardSerializer',
    'CvSampleContentDetailSerializer',
    'CvTemplateAdminSerializer',
    'CvTemplateCardSerializer',
    'CvTemplateDetailSerializer',
    'CvTemplateLocalizationAdminSerializer',
    'CvTemplateSerializer',
    'CvTemplateVersionAdminSerializer',
]
