from django.urls import path

from .api.views import (
    PublicCompanyDetailView,
    PublicCompanyJobFacetsView,
    PublicCompanyListView,
    PublicCompanySimilarView,
)

urlpatterns = [
    path('', PublicCompanyListView.as_view(), name='public-company-list'),
    path(
        '<str:public_id>/similar/',
        PublicCompanySimilarView.as_view(),
        name='public-company-similar',
    ),
    path(
        '<str:public_id>/job-facets/',
        PublicCompanyJobFacetsView.as_view(),
        name='public-company-job-facets',
    ),
    path('<slug:slug>/', PublicCompanyDetailView.as_view(), name='public-company-detail'),
]
