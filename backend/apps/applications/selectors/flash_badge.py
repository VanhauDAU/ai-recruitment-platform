"""Đọc Huy hiệu Sấm Chớp (ADR-0027) cho NTD và trang chi tiết tin."""

from django.utils import timezone

from apps.jobs.models import Job, publicly_available_job_filter
from apps.sitecontent.selectors import get_settings_map

from ..domain.flash_badge import AT_RISK_LEAD, SETTING_KEYS, criteria, parse_policy
from ..models import Application, RecruiterResponsiveness


def _unanswered_on_public_jobs(company_id, user_id, at):
    return Application.objects.filter(
        is_current=True,
        status__in=Application.UNANSWERED_STATUSES,
        job__company_id=company_id,
        job__posted_by_id=user_id,
        job__in=Job.objects.filter(publicly_available_job_filter(at=at)),
    )


def recruiter_flash_badge_state(*, company_id, user_id, at=None):
    """Tiến độ huy hiệu của một người đăng tin: tiêu chí từ ảnh chụp, hồ sơ quá hạn đo trực tiếp.

    Số hồ sơ quá hạn và sắp quá hạn đọc ngay lúc gọi để NTD trả lời xong là thấy giảm,
    không phải chờ lần tính kế tiếp.
    """
    at = at or timezone.now()
    policy = parse_policy(get_settings_map(SETTING_KEYS))
    snapshot = RecruiterResponsiveness.objects.filter(
        company_id=company_id, recruiter_id=user_id
    ).first()
    due = at - policy.response_within
    unanswered = _unanswered_on_public_jobs(company_id, user_id, at)
    overdue_count = unanswered.filter(applied_at__lte=due).count()
    at_risk_count = unanswered.filter(
        applied_at__gt=due, applied_at__lte=due + AT_RISK_LEAD
    ).count()
    stats = {
        'matured_count': snapshot.matured_count if snapshot else 0,
        'on_time_count': snapshot.on_time_count if snapshot else 0,
        'last_decision_at': snapshot.last_decision_at if snapshot else None,
    }
    items = criteria(policy, at=at, **stats)
    items.append(
        {'code': 'no_overdue', 'met': overdue_count == 0, 'value': overdue_count, 'target': 0}
    )
    return {
        'enabled': policy.enabled,
        'qualified': bool(policy.enabled and snapshot and snapshot.qualified),
        'qualified_since': snapshot.qualified_since if snapshot else None,
        'response_rate': snapshot.response_rate if snapshot else None,
        'avg_response_hours': snapshot.avg_response_hours if snapshot else None,
        'criteria': items,
        'overdue_count': overdue_count,
        'at_risk_count': at_risk_count,
        'response_hours': policy.response_hours,
        'window_days': policy.window.days,
        'computed_at': snapshot.computed_at if snapshot else None,
    }


def flash_badge_stats_for_job(job):
    """Số liệu thật của người đăng cho trang chi tiết tin; ``None`` khi tin không mang huy hiệu."""
    if not job.has_flash_badge:
        return None
    snapshot = RecruiterResponsiveness.objects.filter(
        company_id=job.company_id, recruiter_id=job.posted_by_id, qualified=True
    ).first()
    if snapshot is None:
        return None
    return {
        'response_rate': snapshot.response_rate,
        'avg_response_hours': snapshot.avg_response_hours,
        'matured_count': snapshot.matured_count,
        'computed_at': snapshot.computed_at,
    }
