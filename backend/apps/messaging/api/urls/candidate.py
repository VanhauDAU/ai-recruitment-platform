from django.urls import path

from apps.accounts.api.permissions import IsCandidate

from ...domain import Role
from ..views.extras import AppliedJobsView, InterviewRespondView, ShareableCvsView
from ._shared import conversation_routes


def _view(view_class):
    return view_class.as_view(role=Role.CANDIDATE, permission_classes=[IsCandidate])


# Route cố định đứng trước route bắt-tất-cả `conversations/<public_id>/`.
urlpatterns = [
    path(
        'conversations/applied-jobs/',
        _view(AppliedJobsView),
        name='candidate-conversation-applied-jobs',
    ),
    path(
        'conversations/shareable-cvs/',
        _view(ShareableCvsView),
        name='candidate-conversation-shareable-cvs',
    ),
    path(
        'interviews/<str:public_id>/respond/',
        _view(InterviewRespondView),
        name='candidate-interview-respond',
    ),
    *conversation_routes('candidate', Role.CANDIDATE, IsCandidate),
]
