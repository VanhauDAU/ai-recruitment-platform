"""Canonical, privacy-safe employer notification and activity writer."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.metrics import record_metric

from ..models import EmployerActivity, EmployerNotification, EmployerNotificationPreference

VERIFY_PATH = '/tuyendung/app/employer-verify'
COMPANY_PATH = '/tuyendung/app/account/settings/company'
COMPANY_MEMBERS_PATH = f'{COMPANY_PATH}?tab=members'
COMPANY_PAGE_PATH = '/tuyendung/app/company-page'
JOBS_PATH = '/tuyendung/app/jobs'
APPLICATIONS_PATH = '/tuyendung/app/applications'
CAMPAIGNS_PATH = '/tuyendung/app/campaigns'
INTEGRATIONS_PATH = '/tuyendung/app/account/settings/integrations'

EVENT_PRESENTATION = {
    EmployerNotification.EventType.VERIFICATION_APPROVED: (
        'Hồ sơ xác thực đã được duyệt',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_CHANGES_REQUESTED: (
        'Hồ sơ xác thực cần bổ sung',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_REJECTED: (
        'Hồ sơ xác thực bị từ chối',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_REVOKED: (
        'Xác thực đã bị thu hồi',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_EXPIRED: (
        'Xác thực đã hết hiệu lực',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.DOCUMENT_CHANGES_REQUESTED: (
        'Giấy tờ xác thực cần bổ sung',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.DOCUMENT_REJECTED: (
        'Giấy tờ xác thực bị từ chối',
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_LINK_REMOVED: (
        'Liên kết công ty đã được gỡ',
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_PAGE_EDITOR_GRANTED: (
        'Bạn được cấp quyền biên tập trang công ty',
        COMPANY_PAGE_PATH,
    ),
    EmployerNotification.EventType.COMPANY_PAGE_EDITOR_REVOKED: (
        'Quyền biên tập trang công ty đã bị thu hồi',
        COMPANY_PAGE_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_RECEIVED: (
        'Có hồ sơ ứng tuyển mới',
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_REVIEW_SUBMITTED: (
        'Có đánh giá mới cho hồ sơ ứng viên',
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_WITHDRAWN: (
        'Ứng viên đã rút hồ sơ',
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_AWAITING_REPLY: (
        'Hồ sơ đang chờ phản hồi',
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.JOB_CHANGES_REQUESTED: (
        'Tin tuyển dụng cần chỉnh sửa',
        JOBS_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_REQUESTED: (
        'Có yêu cầu tham gia công ty',
        COMPANY_MEMBERS_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_APPROVED: (
        'Yêu cầu tham gia công ty đã được duyệt',
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_REJECTED: (
        'Yêu cầu tham gia công ty bị từ chối',
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_OWNERSHIP_CHANGED: (
        'Quyền quản lý công ty đã thay đổi',
        COMPANY_MEMBERS_PATH,
    ),
    EmployerNotification.EventType.JOBS_HANDED_OVER: (
        'Tin tuyển dụng được giao lại',
        JOBS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ACTIVATED: (
        'Chiến dịch đã được kích hoạt theo lịch',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ACTIVATION_FAILED: (
        'Chiến dịch chưa kích hoạt được theo lịch',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ENDING_SOON: (
        'Chiến dịch sắp đến ngày kết thúc',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_AUTO_COMPLETED: (
        'Chiến dịch đã tự kết thúc',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT: (
        'Chiến dịch cần chú ý',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_POST_FAILED: (
        'Bài đăng Fanpage không thành công',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_POST_DELETE_FAILED: (
        'Chưa gỡ được bài khỏi Fanpage',
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED: (
        'Kết nối Fanpage đã hết hạn',
        INTEGRATIONS_PATH,
    ),
}

SAFE_METADATA_KEYS = {
    'application_public_id',
    'campaign_public_id',
    'rule',
    'case_public_id',
    'company_public_id',
    'event_public_id',
    'status',
}


def new_application_email_enabled(recipient):
    value = (
        EmployerNotificationPreference.objects.filter(recipient=recipient)
        .values_list('new_application_email', flat=True)
        .first()
    )
    return True if value is None else value


def campaign_weekly_report_email_enabled(recipient):
    value = (
        EmployerNotificationPreference.objects.filter(recipient=recipient)
        .values_list('campaign_weekly_report_email', flat=True)
        .first()
    )
    return True if value is None else value


def intermediate_verification_email_enabled(recipient):
    value = (
        EmployerNotificationPreference.objects.filter(recipient=recipient)
        .values_list('intermediate_verification_email', flat=True)
        .first()
    )
    return True if value is None else value


def _safe_metadata(metadata):
    return {
        key: str(value)[:100]
        for key, value in (metadata or {}).items()
        if key in SAFE_METADATA_KEYS and value not in {None, ''}
    }


@transaction.atomic
def emit_employer_event(
    *,
    recipient,
    event_type,
    dedupe_key,
    message='',
    actor=None,
    subject_public_id='',
    metadata=None,
    action_path='',
):
    """Idempotently persist notification + activity in the caller transaction."""

    if event_type not in EVENT_PRESENTATION:
        raise ValueError('EMPLOYER_EVENT_TYPE_UNSUPPORTED')
    normalized_dedupe = str(dedupe_key).strip()[:160]
    if not normalized_dedupe:
        raise ValueError('EMPLOYER_EVENT_DEDUPE_REQUIRED')
    title, default_path = EVENT_PRESENTATION[event_type]
    # Producers may deep-link inside the event's section (one application).
    action_path = action_path if action_path.startswith(default_path) else default_path
    normalized_message = str(message or '').strip()[:2000]
    safe_metadata = _safe_metadata(metadata)
    notification, notification_created = EmployerNotification.objects.get_or_create(
        recipient=recipient,
        dedupe_key=normalized_dedupe,
        defaults={
            'event_type': event_type,
            'title': title,
            'message': normalized_message,
            'action_path': action_path,
            'metadata': safe_metadata,
        },
    )
    activity, activity_created = EmployerActivity.objects.get_or_create(
        recipient=recipient,
        dedupe_key=normalized_dedupe,
        defaults={
            'actor': actor,
            'event_type': event_type,
            'summary': title,
            'subject_public_id': str(subject_public_id or '')[:50],
            'metadata': safe_metadata,
        },
    )
    record_metric(
        'employer_notification_event',
        event=event_type,
        status=('created' if notification_created and activity_created else 'deduplicated'),
    )
    return notification, activity


def update_employer_notification_preference(user, changes):
    """Store the optional email switches; important decisions are always emailed."""
    preference, _ = EmployerNotificationPreference.objects.update_or_create(
        recipient=user, defaults=dict(changes)
    )
    return preference


@transaction.atomic
def mark_employer_notification_read(user, public_id):
    """Mark one of the user's notifications read once; ``None`` if it is not theirs."""
    notification = (
        EmployerNotification.objects.select_for_update()
        .filter(recipient=user, public_id=public_id)
        .first()
    )
    if notification is not None and notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=['read_at'])
    return notification


def mark_all_employer_notifications_read(user):
    """Mark every unread notification read; returns how many changed."""
    return EmployerNotification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now()
    )
