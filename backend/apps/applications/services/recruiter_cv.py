"""Recruiter access to an application's CV snapshot: view, export, download.

Every read is written to ``CvAccessLog`` so the candidate's data stays
auditable; a download also tells the candidate once per application.
"""

from django.db import transaction

from apps.candidates.models import CandidateNotification
from apps.candidates.services import emit_candidate_notification
from apps.cvs.models import CvAccessLog
from apps.cvs.services import open_snapshot_source_pdf, record_application_snapshot_access

from .status import mark_application_viewed


@transaction.atomic
def open_application_snapshot(application, *, actor, request):
    application = mark_application_viewed(application, changed_by=actor)
    record_application_snapshot_access(
        version=application.submitted_cv_version,
        actor=actor,
        request=request,
        channel=CvAccessLog.AccessChannel.APPLICATION,
    )
    return application


@transaction.atomic
def record_application_cv_download(application, *, actor, request):
    record_application_snapshot_access(
        version=application.submitted_cv_version,
        actor=actor,
        request=request,
        channel=CvAccessLog.AccessChannel.EXPORT,
    )
    emit_candidate_notification(
        recipient=application.candidate,
        event_type=CandidateNotification.EventType.APPLICATION_CV_DOWNLOADED,
        # One notice per application however often the recruiter downloads.
        dedupe_key=f'application-cv-downloaded:{application.public_id}',
        context={
            'company_name': application.job.company.company_name,
            'job_title': application.job.title,
        },
        metadata={
            'application_public_id': application.public_id,
            'job_public_id': application.job.public_id,
        },
    )


def open_application_cv_file(application):
    """The file the candidate submitted, as a PDF stream; None for a builder CV."""
    return open_snapshot_source_pdf(application.submitted_cv_version)
