from apps.cv_templates.api.views.catalog import (
    CvCategoryCatalogListView,
    CvPositionDetailsView,
    CvPositionOptionListView,
    CvPositionPreviewView,
    CvSampleContentCatalogListView,
    CvTemplateCatalogDetailView,
    CvTemplateCatalogListView,
    CvTemplateRelatedListView,
)

from .admin import (
    AdminCvBackgroundViewSet,
    AdminCvCategoryViewSet,
    AdminCvColorViewSet,
    AdminCvPositionFieldViewSet,
    AdminCvPositionViewSet,
    AdminCvSampleContentViewSet,
    AdminCvSampleGenerationViewSet,
    AdminCvTemplateViewSet,
    AdminModelViewSet,
)

__all__ = [
    'AdminCvBackgroundViewSet',
    'AdminCvCategoryViewSet',
    'AdminCvColorViewSet',
    'AdminCvPositionFieldViewSet',
    'AdminCvPositionViewSet',
    'AdminCvSampleContentViewSet',
    'AdminCvSampleGenerationViewSet',
    'AdminCvTemplateViewSet',
    'AdminModelViewSet',
    'CvCategoryCatalogListView',
    'CvPositionDetailsView',
    'CvPositionOptionListView',
    'CvPositionPreviewView',
    'CvSampleContentCatalogListView',
    'CvTemplateCatalogDetailView',
    'CvTemplateCatalogListView',
    'CvTemplateRelatedListView',
]
