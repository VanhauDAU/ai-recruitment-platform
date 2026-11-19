from django.urls import path

from apps.applications.api.views.applications import (
    CandidateApplicationListCreateView,
    CandidateApplicationRemindView,
    CandidateApplicationWithdrawView,
)

from ..views.talent_pool import (
    CandidateTalentPoolListView,
    CandidateTalentPoolWithdrawView,
)

urlpatterns = [
    path(
        'applications/',
        CandidateApplicationListCreateView.as_view(),
        name='candidate-application-list-create',
    ),
    path(
        'applications/<str:public_id>/withdraw/',
        CandidateApplicationWithdrawView.as_view(),
        name='candidate-application-withdraw',
    ),
    path(
        'applications/<str:public_id>/remind/',
        CandidateApplicationRemindView.as_view(),
        name='candidate-application-remind',
    ),
    path(
        'talent-pools/mine/',
        CandidateTalentPoolListView.as_view(),
        name='candidate-talent-pools',
    ),
    path(
        'talent-pools/mine/<str:public_id>/withdraw/',
        CandidateTalentPoolWithdrawView.as_view(),
        name='candidate-talent-pool-withdraw',
    ),
]
