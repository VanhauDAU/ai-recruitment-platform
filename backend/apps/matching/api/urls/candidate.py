"""Routes của `/api/candidate/matching/`."""

from django.urls import path

from ..views import AnalysisDetailView, AnalysisListCreateView

urlpatterns = [
    path('analyses/', AnalysisListCreateView.as_view(), name='matching-analyses'),
    path(
        'analyses/<str:public_id>/', AnalysisDetailView.as_view(), name='matching-analysis-detail'
    ),
]
