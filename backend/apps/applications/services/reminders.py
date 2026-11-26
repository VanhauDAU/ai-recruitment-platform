"""Nudging recruiters about applications they have not answered yet.

The system reminds on its own after a few quiet days, and the candidate may
ask for a reminder too. Every nudge is recorded so the candidate sees it in
the application timeline. After an interview the same applies to the result:
counted from when the interview ended (or the invitation, without a schedule).
"""

from collections import defaultdict
from datetime import timedelta

from django.db import transaction
from django.db.models import Exists, F, Func, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.services import lock_account_for_write
from apps.employers.models import EmployerNotification, RecruiterProfile
from apps.employers.services import company_owners, emit_employer_event
from apps.jobs.models import Job, publicly_available_job_filter
from apps.sitecontent.selectors import get_bool_setting
from common.i18n import recipient_language
from common.portal_paths import employer_app_path

from ..models import Application, ApplicationReminder
from .applications import ApplicationNotAllowed, _locked_current_application
from .policy import (
    candidate_reminder_policy,
    interview_decision_reminder_delay,
    system_reminder_days,
)

# Days without an answer, counted from the submission, before each system nudge.
# A system nudge right after the candidate's own one would remind twice in a day.
SYSTEM_REMINDER_SKIP_AFTER_CANDIDATE = timedelta(hours=24)

APPLICATIONS_PATH = employer_app_path('/ho-so-ung-tuyen')


def candidate_reminder_available_at(application, *, now=None, visible_status=None, policy=None):
    """When the candidate may next ask for a reminder; ``None`` when never again.

    Reads the status the candidate has been told, so a decision inside its undo
    window does not make the button disappear early. ``policy`` lets a list
    read the reminder settings once for every row.
    """
    visible_status = visible_status or application.candidate_visible_status()
    if not application.is_current:
        return None
    if visible_status == Application.Status.INTERVIEWED:
        # Chờ kết quả phỏng vấn: nhắc được cả khi tin đã ngừng nhận hồ sơ.
        anchor = application.decision_anchor
        if anchor is None:
            return None
        start = anchor + interview_decision_reminder_delay()
        asked = [
            item.created_at
            for item in application.reminders.all()
            if item.source == ApplicationReminder.Source.CANDIDATE and item.created_at >= anchor
        ]
    elif visible_status in Application.UNANSWERED_STATUSES and application.job.stopped_at is None:
        start = None
        asked = [
            item.created_at
            for item in application.reminders.all()
            if item.source == ApplicationReminder.Source.CANDIDATE
        ]
    else:
        return None
    policy = policy or candidate_reminder_policy()
    if len(asked) >= policy.max_count:
        return None
    earliest = start or application.applied_at + policy.after
    if asked:
        earliest = max(earliest, max(asked) + policy.interval)
    return earliest


def reminder_recipients(job):
    """Who hears about unanswered applications of ``job``.

    The poster while still at the job's company; otherwise its eligible owners;
    with none, every active recruiter left at the company, so a nudge always
    reaches someone who can answer.
    """
    if RecruiterProfile.objects.filter(
        user_id=job.posted_by_id, company_id=job.company_id
    ).exists():
        return [job.posted_by]
    owners = [owner.user for owner in company_owners(job.company)]
    if owners:
        return owners
    return [
        recruiter.user
        for recruiter in RecruiterProfile.objects.filter(
            company_id=job.company_id, user__is_active=True, user__is_deleted=False
        ).select_related('user')
    ]


def _notify(job, applications, *, reminder_ids, interview=False):
    count = len(applications)
    for recipient in reminder_recipients(job):
        with recipient_language(recipient):
            if interview:
                message = (
                    _('Ứng viên đang chờ kết quả phỏng vấn vị trí %(job)s.') % {'job': job.title}
                    if count == 1
                    else _('%(count)s ứng viên vị trí %(job)s đang chờ kết quả phỏng vấn.')
                    % {'count': count, 'job': job.title}
                )
            else:
                message = (
                    _('Ứng viên đang chờ bạn phản hồi hồ sơ vị trí %(job)s.') % {'job': job.title}
                    if count == 1
                    else _('%(count)s hồ sơ vị trí %(job)s đang chờ bạn phản hồi.')
                    % {'count': count, 'job': job.title}
                )
            emit_employer_event(
                recipient=recipient,
                event_type=EmployerNotification.EventType.APPLICATION_AWAITING_REPLY,
                dedupe_key=(
                    f'application-awaiting-{"result" if interview else "reply"}:'
                    f'{min(reminder_ids)}:{max(reminder_ids)}'
                ),
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
        raise ApplicationNotAllowed(_('Không thể nhắc nhà tuyển dụng cho hồ sơ này nữa.'))
    if available_at > timezone.now():
        raise ApplicationNotAllowed(
            _('Bạn có thể nhắc nhà tuyển dụng từ %(time)s.')
            % {'time': f'{timezone.localtime(available_at):%H:%M %d/%m/%Y}'}
        )
    reminder = ApplicationReminder.objects.create(
        application=application, source=ApplicationReminder.Source.CANDIDATE
    )
    # Already decided but not yet told: keep the candidate's timeline honest
    # without nudging a recruiter about something they answered.
    if application.status in Application.UNANSWERED_STATUSES:
        _notify(application.job, [application], reminder_ids=[reminder.pk])
    elif application.status == Application.Status.INTERVIEWED:
        _notify(application.job, [application], reminder_ids=[reminder.pk], interview=True)
    return application


def send_unanswered_application_reminders(*, now=None, batch_size=500):
    """Nudge recruiters once per job about applications quiet for 3, then 7 days.

    Counted from the submission, only while the job still takes applications.
    A milestone right after the candidate's own reminder is recorded silently.
    """
    if not get_bool_setting('recruiter_reminders_enabled', True):
        return 0
    now = now or timezone.now()
    due_condition = Q()
    for index, days in enumerate(system_reminder_days()):
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
                    reminder_ids=[reminder.pk for _item, reminder in to_notify],
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


def record_interview_end(application_id, ended_at):
    """ProCV Connect báo buổi phỏng vấn đã nhận kết thúc lúc ``ended_at`` (None: lịch bị hủy)."""
    Application.objects.filter(pk=application_id).update(
        interview_ended_at=ended_at, decision_reminder_sent_at=None
    )


def send_interview_decision_reminders(*, now=None, batch_size=500):
    """Nhắc NTD một lần khi ứng viên chờ kết quả phỏng vấn quá hạn (chuông + email).

    Mốc là lúc buổi hẹn kết thúc, không có lịch thì lúc mời phỏng vấn. Không tự từ
    chối: kết quả phỏng vấn phải do người quyết.
    """
    if not get_bool_setting('recruiter_reminders_enabled', True):
        return 0
    now = now or timezone.now()
    cutoff = now - interview_decision_reminder_delay()
    due = list(
        Application.objects.filter(
            Q(interview_ended_at__lte=cutoff)
            | Q(interview_ended_at__isnull=True, interviewed_at__lte=cutoff),
            is_current=True,
            status=Application.Status.INTERVIEWED,
            decision_reminder_sent_at__isnull=True,
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
            Application.objects.filter(pk__in=[item.pk for item in applications]).update(
                decision_reminder_sent_at=now
            )
            _notify(
                applications[0].job,
                applications,
                reminder_ids=[item.pk for item in reminders],
                interview=True,
            )
            job_id = applications[0].job_id
            ids = tuple(item.pk for item in applications)

            def enqueue(job_id=job_id, ids=ids):
                # Imported here: tasks depend on services, not the other way round.
                from ..tasks import send_interview_decision_email

                send_interview_decision_email.delay(job_id, list(ids))

            transaction.on_commit(enqueue)
    return len(due)
