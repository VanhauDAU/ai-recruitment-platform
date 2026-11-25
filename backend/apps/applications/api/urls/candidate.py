from django.urls import path

from apps.applications.api.views.applications import (
    CandidateApplicationListCreateView,
    CandidateApplicationRemindView,
    CandidateApplicationWithdrawView,
)

from ..views.candidate_search import (
    CandidateSearchInvitationListView,
    CandidateSearchInvitationRespondView,
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
        'connection-invitations/',
        CandidateSearchInvitationListView.as_view(),
        name='candidate-connection-invitations',
    ),
    path(
        'connection-invitations/<str:public_id>/respond/',
        CandidateSearchInvitationRespondView.as_view(),
        name='candidate-connection-invitation-respond',
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
