from django.urls import path

from .api_v2_views import (
    CvCategoryCatalogListView,
    CvSampleContentCatalogDetailView,
    CvSampleContentCatalogListView,
    CvTemplateCatalogDetailView,
    CvTemplateCatalogListView,
    CvTemplateRelatedListView,
)


urlpatterns = [
    path('cv-templates/', CvTemplateCatalogListView.as_view(), name='cv-template-v2-list'),
    path('cv-templates/<slug:slug>/', CvTemplateCatalogDetailView.as_view(), name='cv-template-v2-detail'),
    path('cv-templates/<slug:slug>/related/', CvTemplateRelatedListView.as_view(), name='cv-template-v2-related'),
    path('cv-categories/', CvCategoryCatalogListView.as_view(), name='cv-category-v2-list'),
    path('cv-sample-contents/', CvSampleContentCatalogListView.as_view(), name='cv-sample-content-v2-list'),
    path('cv-sample-contents/<str:public_id>/', CvSampleContentCatalogDetailView.as_view(), name='cv-sample-content-v2-detail'),
]
