"""Routes của `/api/candidate/matching/`."""

from django.urls import path

from ..views import AnalysisDetailView, AnalysisListCreateView, CvProfileView

urlpatterns = [
    path('analyses/', AnalysisListCreateView.as_view(), name='matching-analyses'),
    path(
        'analyses/<str:public_id>/', AnalysisDetailView.as_view(), name='matching-analysis-detail'
    ),
    path('cv-profiles/<str:cv_public_id>/', CvProfileView.as_view(), name='matching-cv-profile'),
]
