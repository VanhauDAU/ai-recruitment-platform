"""Huy hiệu Sấm Chớp (ADR-0027): tự cấp, tự gỡ theo cách NTD trả lời hồ sơ.

Task chạy mỗi giờ: đo từng người đăng tin (cặp công ty, ``Job.posted_by``) trên
các hồ sơ đã quá hạn phản hồi trong cửa sổ xét, ghi ảnh chụp
``RecruiterResponsiveness`` rồi chiếu xuống ``Job.has_flash_badge``. Tin nào đang
để hồ sơ chờ quá hạn thì không mang huy hiệu dù người đăng vẫn đạt.

"Phản hồi" là quyết định của NTD (phù hợp, phỏng vấn, nhận, từ chối) đã báo ứng
viên và không hoàn tác. Mở xem CV hay hệ thống tự từ chối không tính.
"""

from django.db import transaction
from django.db.models import (
    Avg,
    Count,
    DurationField,
    Exists,
    ExpressionWrapper,
    F,
    Max,
    OuterRef,
    Q,
    Subquery,
)
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.employers.models import EmployerNotification, RecruiterProfile
from apps.employers.services import emit_employer_event
from apps.jobs.models import Job, publicly_available_job_filter
from apps.sitecontent.selectors import get_settings_map
from common.i18n import recipient_language

from ..domain.flash_badge import (
    AT_RISK_LEAD,
    SETTING_KEYS,
    is_qualified,
    lost_reason,
    parse_policy,
)
from ..models import Application, ApplicationStatusHistory, RecruiterResponsiveness

APPLICATIONS_PATH = '/tuyendung/app/applications'
DASHBOARD_PATH = '/tuyendung/app/dashboard'

SNAPSHOT_FIELDS = (
    'matured_count',
    'on_time_count',
    'avg_response_hours',
    'last_decision_at',
    'overdue_count',
    'qualified',
    'qualified_since',
    'computed_at',
)


def flash_badge_policy():
    return parse_policy(get_settings_map(SETTING_KEYS))


def _recruiter_decisions():
    """Quyết định của NTD mà ứng viên đã được báo, không tính dòng tự từ chối."""
    return ApplicationStatusHistory.objects.published().filter(
        changed_by__isnull=False, to_status__in=Application.DECISION_STATUSES
    )


def _matured_stats(policy, at):
    """``{(company_id, recruiter_id): (matured, on_time, avg_hours)}`` của cửa sổ xét."""
    deadline = F('applied_at') + policy.response_within
    first_decision = Subquery(
        _recruiter_decisions()
        .filter(application_id=OuterRef('pk'))
        .order_by('created_at', 'pk')
        .values('created_at')[:1]
    )
    # Ứng viên rút hồ sơ trước khi có quyết định và trước hạn: NTD không lỡ hẹn.
    withdrawn_early = Q(withdrawn_at__isnull=False, withdrawn_at__lt=deadline) & (
        Q(first_decision_at__isnull=True) | Q(first_decision_at__gt=F('withdrawn_at'))
    )
    rows = (
        Application.objects.filter(
            is_current=True,
            applied_at__gte=at - policy.window,
            applied_at__lte=at - policy.response_within,
        )
        .annotate(first_decision_at=first_decision)
        .exclude(withdrawn_early)
        .values('job__company_id', 'job__posted_by_id')
        .annotate(
            matured=Count('pk'),
            on_time=Count('pk', filter=Q(first_decision_at__lte=deadline)),
            avg_response=Avg(
                ExpressionWrapper(
                    F('first_decision_at') - F('applied_at'), output_field=DurationField()
                )
            ),
        )
        .order_by()
    )
    return {
        (row['job__company_id'], row['job__posted_by_id']): (
            row['matured'],
            row['on_time'],
            round(row['avg_response'].total_seconds() / 3600, 1)
            if row['avg_response'] is not None
            else None,
        )
        for row in rows
    }


def _last_decisions(policy, at):
    since = at - max(policy.window, policy.active_within)
    rows = (
        _recruiter_decisions()
        .filter(created_at__gte=since)
        .values('application__job__company_id', 'application__job__posted_by_id')
        .annotate(last=Max('created_at'))
        .order_by()
    )
    return {
        (row['application__job__company_id'], row['application__job__posted_by_id']): row['last']
        for row in rows
    }


def overdue_applications(policy, at):
    """Hồ sơ đang chờ quá hạn phản hồi trên tin còn công khai."""
    return Application.objects.filter(
        is_current=True,
        status__in=Application.UNANSWERED_STATUSES,
        applied_at__lte=at - policy.response_within,
        job__in=Job.objects.filter(publicly_available_job_filter(at=at)),
    )


def _overdue_counts(policy, at):
    rows = (
        overdue_applications(policy, at)
        .values('job__company_id', 'job__posted_by_id')
        .annotate(total=Count('pk'))
        .order_by()
    )
    return {(row['job__company_id'], row['job__posted_by_id']): row['total'] for row in rows}


def _project_on_jobs(policy, at):
    """``Job.has_flash_badge`` = người đăng đạt + tin công khai + không có hồ sơ quá hạn.

    ``update()`` chỉ chạm những dòng đổi giá trị và không đổi ``updated_at``.
    """
    earning = (
        Job.objects.filter(publicly_available_job_filter(at=at))
        .filter(
            Exists(
                RecruiterResponsiveness.objects.filter(
                    company_id=OuterRef('company_id'),
                    recruiter_id=OuterRef('posted_by_id'),
                    qualified=True,
                )
            )
        )
        .exclude(Exists(overdue_applications(policy, at).filter(job_id=OuterRef('pk'))))
        .values('pk')
    )
    granted = Job.objects.filter(has_flash_badge=False, pk__in=earning).update(has_flash_badge=True)
    revoked = (
        Job.objects.filter(has_flash_badge=True)
        .exclude(pk__in=earning)
        .update(has_flash_badge=False)
    )
    return granted, revoked


@transaction.atomic
def refresh_flash_badges(*, at=None):
    """Tính lại huy hiệu cho mọi người đăng tin; trả về số cặp đạt và số tin đổi nhãn."""
    at = at or timezone.now()
    policy = flash_badge_policy()
    if not policy.enabled:
        RecruiterResponsiveness.objects.filter(qualified=True).update(
            qualified=False, qualified_since=None, computed_at=at
        )
        revoked = Job.objects.filter(has_flash_badge=True).update(has_flash_badge=False)
        return {'qualified': 0, 'jobs_granted': 0, 'jobs_revoked': revoked}

    matured = _matured_stats(policy, at)
    last_decisions = _last_decisions(policy, at)
    overdue = _overdue_counts(policy, at)
    previous = {
        (row.company_id, row.recruiter_id): row for row in RecruiterResponsiveness.objects.all()
    }
    pairs = set(matured) | set(last_decisions) | set(overdue) | set(previous)

    snapshots, granted_pairs, lost_pairs = [], [], []
    for pair in pairs:
        matured_count, on_time_count, avg_hours = matured.get(pair, (0, 0, None))
        stats = {
            'matured_count': matured_count,
            'on_time_count': on_time_count,
            'last_decision_at': last_decisions.get(pair),
            'at': at,
        }
        qualified = is_qualified(policy, **stats)
        before = previous.get(pair)
        was_qualified = bool(before and before.qualified)
        snapshot = RecruiterResponsiveness(
            company_id=pair[0],
            recruiter_id=pair[1],
            matured_count=matured_count,
            on_time_count=on_time_count,
            avg_response_hours=avg_hours,
            last_decision_at=stats['last_decision_at'],
            overdue_count=overdue.get(pair, 0),
            qualified=qualified,
            qualified_since=(before.qualified_since if was_qualified else at)
            if qualified
            else None,
            computed_at=at,
        )
        snapshots.append(snapshot)
        if qualified and not was_qualified:
            granted_pairs.append(snapshot)
        elif was_qualified and not qualified:
            lost_pairs.append((snapshot, lost_reason(policy, **stats)))

    RecruiterResponsiveness.objects.bulk_create(
        snapshots,
        update_conflicts=True,
        unique_fields=['company', 'recruiter'],
        update_fields=list(SNAPSHOT_FIELDS),
    )
    jobs_granted, jobs_revoked = _project_on_jobs(policy, at)

    recipients = _active_recruiters(
        [(row.company_id, row.recruiter_id) for row in granted_pairs]
        + [(row.company_id, row.recruiter_id) for row, _reason in lost_pairs]
    )
    for snapshot in granted_pairs:
        recipient = recipients.get((snapshot.company_id, snapshot.recruiter_id))
        if recipient is not None:
            _notify_granted(recipient, snapshot, policy)
    for snapshot, reason in lost_pairs:
        recipient = recipients.get((snapshot.company_id, snapshot.recruiter_id))
        if recipient is not None:
            _notify_lost(recipient, snapshot, reason, policy)
    _notify_at_risk(policy, at)
    return {
        'qualified': sum(1 for snapshot in snapshots if snapshot.qualified),
        'jobs_granted': jobs_granted,
        'jobs_revoked': jobs_revoked,
    }


def _active_recruiters(pairs):
    """``{(company_id, user_id): user}`` của những người còn làm ở công ty đó."""
    if not pairs:
        return {}
    match = Q()
    for company_id, user_id in pairs:
        match |= Q(company_id=company_id, user_id=user_id)
    profiles = RecruiterProfile.objects.filter(
        match, user__is_active=True, user__is_deleted=False
    ).select_related('user')
    return {(profile.company_id, profile.user_id): profile.user for profile in profiles}


def _emit(recipient, *, event_type, dedupe_key, message, action_path):
    emit_employer_event(
        recipient=recipient,
        event_type=event_type,
        dedupe_key=dedupe_key,
        message=message,
        action_path=action_path,
    )


def _notify_granted(recipient, snapshot, policy):
    with recipient_language(recipient):
        message = _(
            'Bạn phản hồi %(rate)s%% hồ sơ trong %(hours)s giờ. Tin đăng của bạn được gắn '
            'Huy hiệu Sấm Chớp và ưu tiên hiển thị với ứng viên.'
        ) % {'rate': snapshot.response_rate, 'hours': policy.response_hours}
    _emit(
        recipient,
        event_type=EmployerNotification.EventType.FLASH_BADGE_GRANTED,
        dedupe_key=(
            f'flash-badge-granted:{snapshot.company_id}:{snapshot.recruiter_id}:'
            f'{snapshot.qualified_since:%Y%m%d%H%M}'
        ),
        message=message,
        action_path=DASHBOARD_PATH,
    )


def _lost_message(reason, snapshot, policy):
    if reason == 'enough_applications':
        return _('Chưa đủ %(count)s hồ sơ đến hạn phản hồi trong %(days)s ngày gần nhất.') % {
            'count': policy.min_applications,
            'days': policy.window.days,
        }
    if reason == 'response_rate':
        return _(
            'Tỷ lệ hồ sơ được phản hồi trong %(hours)s giờ còn %(rate)s%%, dưới mức %(target)s%%.'
        ) % {
            'hours': policy.response_hours,
            'rate': snapshot.response_rate or 0,
            'target': policy.min_response_rate,
        }
    return _('Bạn chưa đưa ra quyết định nào cho hồ sơ trong %(days)s ngày gần nhất.') % {
        'days': policy.active_within.days
    }


def _notify_lost(recipient, snapshot, reason, policy):
    with recipient_language(recipient):
        message = _lost_message(reason, snapshot, policy)
    _emit(
        recipient,
        event_type=EmployerNotification.EventType.FLASH_BADGE_LOST,
        dedupe_key=(
            f'flash-badge-lost:{snapshot.company_id}:{snapshot.recruiter_id}:'
            f'{snapshot.computed_at:%Y%m%d%H%M}'
        ),
        message=message,
        action_path=DASHBOARD_PATH,
    )


def _notify_at_risk(policy, at):
    """Người đang đạt có hồ sơ sẽ quá hạn trong 24 giờ tới: nhắc tối đa một lần mỗi ngày."""
    soon = at - policy.response_within
    rows = (
        Application.objects.filter(
            is_current=True,
            status__in=Application.UNANSWERED_STATUSES,
            applied_at__gt=soon,
            applied_at__lte=soon + AT_RISK_LEAD,
            job__in=Job.objects.filter(publicly_available_job_filter(at=at)),
        )
        .filter(
            Exists(
                RecruiterResponsiveness.objects.filter(
                    company_id=OuterRef('job__company_id'),
                    recruiter_id=OuterRef('job__posted_by_id'),
                    qualified=True,
                )
            )
        )
        .values('job__company_id', 'job__posted_by_id')
        .annotate(total=Count('pk'))
        .order_by()
    )
    counts = {(row['job__company_id'], row['job__posted_by_id']): row['total'] for row in rows}
    today = timezone.localdate(at)
    for pair, recipient in _active_recruiters(list(counts)).items():
        with recipient_language(recipient):
            message = _(
                '%(count)s hồ sơ sẽ quá hạn %(hours)s giờ trong 24 giờ tới. Hãy phản hồi để giữ '
                'Huy hiệu Sấm Chớp.'
            ) % {'count': counts[pair], 'hours': policy.response_hours}
        _emit(
            recipient,
            event_type=EmployerNotification.EventType.FLASH_BADGE_AT_RISK,
            dedupe_key=f'flash-badge-at-risk:{pair[0]}:{pair[1]}:{today:%Y%m%d}',
            message=message,
            action_path=APPLICATIONS_PATH,
        )
