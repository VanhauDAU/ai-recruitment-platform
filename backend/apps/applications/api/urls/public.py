from django.urls import path

from apps.applications.api.views.applications import ApplicationRulesView

from ..views.reviews import (
    PublicApplicationReviewView,
)

urlpatterns = [
    path('applications/rules/', ApplicationRulesView.as_view(), name='application-rules'),
    path(
        'application-reviews/<str:token>/',
        PublicApplicationReviewView.as_view(),
        name='public-application-review',
    ),
]
