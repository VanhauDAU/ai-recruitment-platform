from django.urls import path

from ..views.reviews import (
    PublicApplicationReviewView,
)
from ..views.v2 import (
    ApplicationRulesView,
)

urlpatterns = [
    path('applications/rules/', ApplicationRulesView.as_view(), name='application-rules-v2'),
    path(
        'application-reviews/<str:token>/',
        PublicApplicationReviewView.as_view(),
        name='public-application-review-v2',
    ),
]
