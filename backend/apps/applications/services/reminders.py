"""Nudging recruiters about applications they have not answered yet.

The system reminds on its own after a few quiet days, and the candidate may
ask for a reminder too. Every nudge is recorded so the candidate sees it in
the application timeline.
"""

from collections import defaultdict
from datetime import timedelta

from django.db import transaction
from django.db.models import F, Func, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.services import lock_account_for_write
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event

from ..models import Application, ApplicationReminder
from .applications import ApplicationNotAllowed, _locked_current_application

# Days without an answer, counted from the submission, before each system nudge.
SYSTEM_REMINDER_DAYS = (3, 7)
CANDIDATE_REMINDER_AFTER = timedelta(days=3)
CANDIDATE_REMINDER_INTERVAL = timedelta(days=3)
MAX_CANDIDATE_REMINDERS = 2

APPLICATIONS_PATH = '/tuyendung/app/applications'


def _submitted_at(application):
    return application.submitted_at or application.applied_at


def candidate_reminder_available_at(application, *, now=None):
    """When the candidate may next ask for a reminder; ``None`` when never again."""
    if (
        not application.is_current
        or application.status not in Application.UNANSWERED_STATUSES
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
    earliest = _submitted_at(application) + CANDIDATE_REMINDER_AFTER
    if asked:
        earliest = max(earliest, max(asked) + CANDIDATE_REMINDER_INTERVAL)
    return earliest


def _notify(recruiter, job, applications, *, reminder_ids):
    count = len(applications)
    message = (
        f'Ứng viên đang chờ bạn phản hồi hồ sơ vị trí {job.title}.'
        if count == 1
        else f'{count} hồ sơ vị trí {job.title} đang chờ bạn phản hồi.'
    )
    emit_employer_event(
        recipient=recruiter,
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
    _notify(application.job.posted_by, application.job, [application], reminder_ids=[reminder.pk])
    return application


def send_unanswered_application_reminders(*, now=None, batch_size=500):
    """Nudge recruiters once per job about applications quiet for 3, then 7 days."""
    now = now or timezone.now()
    due_condition = Q()
    for index, days in enumerate(SYSTEM_REMINDER_DAYS):
        due_condition |= Q(system_reminders=index, base_at__lte=now - timedelta(days=days))
    due = list(
        Application.objects.filter(
            is_current=True,
            status__in=Application.UNANSWERED_STATUSES,
            job__status='active',
        )
        .alias(
            system_reminders=_system_reminder_count(),
            base_at=Coalesce('submitted_at', 'applied_at'),
        )
        .filter(due_condition)
        .select_related('job', 'job__posted_by')
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
            job = applications[0].job
            _notify(
                job.posted_by,
                job,
                applications,
                reminder_ids=[reminder.pk for reminder in reminders],
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
