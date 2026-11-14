from django.urls import path

from .api.views.admin import AdminJobApplicationListView
from .api.views.cv_exports import (
    RecruiterApplicationCvExportDetailView,
    RecruiterApplicationCvExportDownloadView,
    RecruiterApplicationCvExportView,
)
from .api.views.employer import (
    EmployerApplicationAssessmentView,
    EmployerApplicationDecisionUndoView,
    EmployerApplicationDecisionView,
    EmployerApplicationExportView,
    EmployerApplicationHistoryView,
    EmployerApplicationListView,
)
from .api.views.v2 import CandidateApplicationV2ListCreateView, RecruiterApplicationSnapshotView

urlpatterns = [
    path(
        'admin/jobs/<str:job_public_id>/applications/',
        AdminJobApplicationListView.as_view(),
        name='admin-job-application-list-v2',
    ),
    path(
        'applications/',
        CandidateApplicationV2ListCreateView.as_view(),
        name='candidate-application-list-create-v2',
    ),
    path(
        'recruiter/applications/',
        EmployerApplicationListView.as_view(),
        name='recruiter-application-list-v2',
    ),
    path(
        'recruiter/applications/export/',
        EmployerApplicationExportView.as_view(),
        name='recruiter-application-export-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/',
        EmployerApplicationAssessmentView.as_view(),
        name='recruiter-application-assessment-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/status/',
        EmployerApplicationDecisionView.as_view(),
        name='recruiter-application-decision-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/status/undo/',
        EmployerApplicationDecisionUndoView.as_view(),
        name='recruiter-application-decision-undo-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/',
        RecruiterApplicationSnapshotView.as_view(),
        name='recruiter-application-snapshot-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/exports/',
        RecruiterApplicationCvExportView.as_view(),
        name='recruiter-application-cv-export-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/exports/<str:export_public_id>/',
        RecruiterApplicationCvExportDetailView.as_view(),
        name='recruiter-application-cv-export-detail-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/exports/<str:export_public_id>/download/',
        RecruiterApplicationCvExportDownloadView.as_view(),
        name='recruiter-application-cv-export-download-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/history/',
        EmployerApplicationHistoryView.as_view(),
        name='recruiter-application-history-v2',
    ),
]
