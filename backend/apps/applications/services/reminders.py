"""Nudging recruiters about applications they have not answered yet.

The system reminds on its own after a few quiet days, and the candidate may
ask for a reminder too. Every nudge is recorded so the candidate sees it in
the application timeline.
"""

from collections import defaultdict
from datetime import timedelta

from django.db import transaction
from django.db.models import Exists, F, Func, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.services import lock_account_for_write
from apps.employers.models import EmployerNotification, RecruiterProfile
from apps.employers.services import company_owners, emit_employer_event
from apps.jobs.models import Job, publicly_available_job_filter

from ..models import Application, ApplicationReminder
from .applications import ApplicationNotAllowed, _locked_current_application

# Days without an answer, counted from the submission, before each system nudge.
SYSTEM_REMINDER_DAYS = (3, 7)
CANDIDATE_REMINDER_AFTER = timedelta(days=3)
# A system nudge right after the candidate's own one would remind twice in a day.
SYSTEM_REMINDER_SKIP_AFTER_CANDIDATE = timedelta(hours=24)
CANDIDATE_REMINDER_INTERVAL = timedelta(days=3)
MAX_CANDIDATE_REMINDERS = 2

APPLICATIONS_PATH = '/tuyendung/app/applications'


def candidate_reminder_available_at(application, *, now=None, visible_status=None):
    """When the candidate may next ask for a reminder; ``None`` when never again.

    Reads the status the candidate has been told, so a decision inside its undo
    window does not make the button disappear early.
    """
    visible_status = visible_status or application.candidate_visible_status()
    if (
        not application.is_current
        or visible_status not in Application.UNANSWERED_STATUSES
        or application.job.stopped_at is not None
    ):
        return None
    asked = [
        item.created_at
        for item in application.reminders.all()
        if item.source == ApplicationReminder.Source.CANDIDATE
    ]
    if len(asked) >= MAX_CANDIDATE_REMINDERS:
        return None
    earliest = application.applied_at + CANDIDATE_REMINDER_AFTER
    if asked:
        earliest = max(earliest, max(asked) + CANDIDATE_REMINDER_INTERVAL)
    return earliest


def reminder_recipients(job):
    """The poster while still at the job's company; otherwise its verified owners."""
    if RecruiterProfile.objects.filter(
        user_id=job.posted_by_id, company_id=job.company_id
    ).exists():
        return [job.posted_by]
    return [owner.user for owner in company_owners(job.company)]


def _notify(job, applications, *, reminder_ids):
    count = len(applications)
    message = (
        f'Ứng viên đang chờ bạn phản hồi hồ sơ vị trí {job.title}.'
        if count == 1
        else f'{count} hồ sơ vị trí {job.title} đang chờ bạn phản hồi.'
    )
    for recipient in reminder_recipients(job):
        emit_employer_event(
            recipient=recipient,
            event_type=EmployerNotification.EventType.APPLICATION_AWAITING_REPLY,
            dedupe_key=f'application-awaiting-reply:{min(reminder_ids)}:{max(reminder_ids)}',
            message=message,
            subject_public_id=applications[0].public_id if count == 1 else job.public_id,
            metadata={'application_public_id': applications[0].public_id} if count == 1 else {},
            action_path=f'{APPLICATIONS_PATH}?job={job.public_id}',
        )


@transaction.atomic
def request_recruiter_reminder(*, candidate, public_id):
    """The candidate asks ProCV to remind the recruiter about one application."""
    candidate = lock_account_for_write(candidate)
    application = _locked_current_application(candidate, public_id)
    available_at = candidate_reminder_available_at(application)
    if available_at is None:
        raise ApplicationNotAllowed('Không thể nhắc nhà tuyển dụng cho hồ sơ này nữa.')
    if available_at > timezone.now():
        raise ApplicationNotAllowed(
            f'Bạn có thể nhắc nhà tuyển dụng từ {timezone.localtime(available_at):%H:%M %d/%m/%Y}.'
        )
    reminder = ApplicationReminder.objects.create(
        application=application, source=ApplicationReminder.Source.CANDIDATE
    )
    # Already decided but not yet told: keep the candidate's timeline honest
    # without nudging a recruiter about something they answered.
    if application.status in Application.UNANSWERED_STATUSES:
        _notify(application.job, [application], reminder_ids=[reminder.pk])
    return application


def send_unanswered_application_reminders(*, now=None, batch_size=500):
    """Nudge recruiters once per job about applications quiet for 3, then 7 days.

    Counted from the submission, only while the job still takes applications.
    A milestone right after the candidate's own reminder is recorded silently.
    """
    now = now or timezone.now()
    due_condition = Q()
    for index, days in enumerate(SYSTEM_REMINDER_DAYS):
        due_condition |= Q(system_reminders=index, applied_at__lte=now - timedelta(days=days))
    recruiting = Job.objects.filter(publicly_available_job_filter()).values('pk')
    due = list(
        Application.objects.filter(
            is_current=True,
            status__in=Application.UNANSWERED_STATUSES,
            job_id__in=recruiting,
        )
        .alias(system_reminders=_system_reminder_count())
        .filter(due_condition)
        .annotate(
            candidate_reminded_recently=Exists(
                ApplicationReminder.objects.filter(
                    application_id=OuterRef('pk'),
                    source=ApplicationReminder.Source.CANDIDATE,
                    created_at__gte=now - SYSTEM_REMINDER_SKIP_AFTER_CANDIDATE,
                )
            )
        )
        .select_related('job', 'job__posted_by', 'job__company')
        .order_by('job_id', 'pk')[:batch_size]
    )
    by_job = defaultdict(list)
    for application in due:
        by_job[application.job_id].append(application)
    for applications in by_job.values():
        with transaction.atomic():
            reminders = ApplicationReminder.objects.bulk_create(
                [
                    ApplicationReminder(
                        application=application, source=ApplicationReminder.Source.SYSTEM
                    )
                    for application in applications
                ]
            )
            to_notify = [
                (application, reminder)
                for application, reminder in zip(applications, reminders, strict=True)
                if not application.candidate_reminded_recently
            ]
            if to_notify:
                _notify(
                    applications[0].job,
                    [application for application, _ in to_notify],
                    reminder_ids=[reminder.pk for _, reminder in to_notify],
                )
    return len(due)


def _system_reminder_count():
    reminders = (
        ApplicationReminder.objects.filter(
            application_id=OuterRef('pk'), source=ApplicationReminder.Source.SYSTEM
        )
        .order_by()
        .annotate(total=Func(F('id'), function='COUNT'))
        .values('total')
    )
    return Coalesce(Subquery(reminders, output_field=IntegerField()), 0)
