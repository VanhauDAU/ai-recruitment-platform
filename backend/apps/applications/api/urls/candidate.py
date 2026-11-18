from django.urls import path

from ..views.talent_pool import (
    CandidateTalentPoolListView,
    CandidateTalentPoolWithdrawView,
)
from ..views.v2 import (
    CandidateApplicationRemindView,
    CandidateApplicationV2ListCreateView,
    CandidateApplicationWithdrawView,
)

urlpatterns = [
    path(
        'applications/',
        CandidateApplicationV2ListCreateView.as_view(),
        name='candidate-application-list-create-v2',
    ),
    path(
        'applications/<str:public_id>/withdraw/',
        CandidateApplicationWithdrawView.as_view(),
        name='candidate-application-withdraw-v2',
    ),
    path(
        'applications/<str:public_id>/remind/',
        CandidateApplicationRemindView.as_view(),
        name='candidate-application-remind-v2',
    ),
    path(
        'talent-pools/mine/',
        CandidateTalentPoolListView.as_view(),
        name='candidate-talent-pools-v2',
    ),
    path(
        'talent-pools/mine/<str:public_id>/withdraw/',
        CandidateTalentPoolWithdrawView.as_view(),
        name='candidate-talent-pool-withdraw-v2',
    ),
]
