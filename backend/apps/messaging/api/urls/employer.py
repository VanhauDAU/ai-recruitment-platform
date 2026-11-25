from django.urls import path

from apps.accounts.api.permissions import IsEmployer

from ...domain import Role
from ..views.extras import (
    InterviewCancelView,
    InterviewCompleteView,
    InterviewCreateView,
    MessageCvExportDetailView,
    MessageCvExportDownloadView,
    MessageCvExportView,
    ShareableJobsView,
)
from ._shared import conversation_routes


def _view(view_class):
    return view_class.as_view(role=Role.RECRUITER, permission_classes=[IsEmployer])


# Route cố định đứng trước route bắt-tất-cả `conversations/<public_id>/`.
urlpatterns = [
    path(
        'conversations/shareable-jobs/',
        _view(ShareableJobsView),
        name='employer-conversation-shareable-jobs',
    ),
    *conversation_routes('employer', Role.RECRUITER, IsEmployer),
    path(
        'conversations/<str:public_id>/interviews/',
        _view(InterviewCreateView),
        name='employer-conversation-interviews',
    ),
    path(
        'conversations/<str:public_id>/messages/<str:message_id>/cv-export/',
        _view(MessageCvExportView),
        name='employer-conversation-cv-export',
    ),
    path(
        'conversations/<str:public_id>/messages/<str:message_id>/cv-export/<str:export_id>/',
        _view(MessageCvExportDetailView),
        name='employer-conversation-cv-export-detail',
    ),
    path(
        'conversations/<str:public_id>/messages/<str:message_id>/cv-export/<str:export_id>/download/',
        _view(MessageCvExportDownloadView),
        name='employer-conversation-cv-export-download',
    ),
    path(
        'interviews/<str:public_id>/cancel/',
        _view(InterviewCancelView),
        name='employer-interview-cancel',
    ),
    path(
        'interviews/<str:public_id>/complete/',
        _view(InterviewCompleteView),
        name='employer-interview-complete',
    ),
]
