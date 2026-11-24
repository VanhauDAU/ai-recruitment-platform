"""Canonical, privacy-safe employer notification and activity writer."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy

from common.i18n import recipient_language
from common.metrics import record_metric

from ..models import EmployerActivity, EmployerNotification, EmployerNotificationPreference

VERIFY_PATH = '/tuyendung/app/employer-verify'
COMPANY_PATH = '/tuyendung/app/account/settings/company'
COMPANY_MEMBERS_PATH = f'{COMPANY_PATH}?tab=members'
COMPANY_PAGE_PATH = '/tuyendung/app/company-page'
JOBS_PATH = '/tuyendung/app/jobs'
APPLICATIONS_PATH = '/tuyendung/app/applications'
DASHBOARD_PATH = '/tuyendung/app/dashboard'
CAMPAIGNS_PATH = '/tuyendung/app/campaigns'
INTEGRATIONS_PATH = '/tuyendung/app/account/settings/integrations'

EVENT_PRESENTATION = {
    EmployerNotification.EventType.VERIFICATION_APPROVED: (
        gettext_lazy('Hồ sơ xác thực đã được duyệt'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_CHANGES_REQUESTED: (
        gettext_lazy('Hồ sơ xác thực cần bổ sung'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_REJECTED: (
        gettext_lazy('Hồ sơ xác thực bị từ chối'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_REVOKED: (
        gettext_lazy('Xác thực đã bị thu hồi'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.VERIFICATION_EXPIRED: (
        gettext_lazy('Xác thực đã hết hiệu lực'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.DOCUMENT_CHANGES_REQUESTED: (
        gettext_lazy('Giấy tờ xác thực cần bổ sung'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.DOCUMENT_REJECTED: (
        gettext_lazy('Giấy tờ xác thực bị từ chối'),
        VERIFY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_LINK_REMOVED: (
        gettext_lazy('Liên kết công ty đã được gỡ'),
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_PAGE_EDITOR_GRANTED: (
        gettext_lazy('Bạn được cấp quyền biên tập trang công ty'),
        COMPANY_PAGE_PATH,
    ),
    EmployerNotification.EventType.COMPANY_PAGE_EDITOR_REVOKED: (
        gettext_lazy('Quyền biên tập trang công ty đã bị thu hồi'),
        COMPANY_PAGE_PATH,
    ),
    EmployerNotification.EventType.COMPANY_CONTENT_REVERTED: (
        gettext_lazy('Nội dung trang công ty đã bị hoàn tác'),
        COMPANY_PAGE_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_RECEIVED: (
        gettext_lazy('Có hồ sơ ứng tuyển mới'),
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_REVIEW_SUBMITTED: (
        gettext_lazy('Có đánh giá mới cho hồ sơ ứng viên'),
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_WITHDRAWN: (
        gettext_lazy('Ứng viên đã rút hồ sơ'),
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.APPLICATION_AWAITING_REPLY: (
        gettext_lazy('Hồ sơ đang chờ phản hồi'),
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.FLASH_BADGE_GRANTED: (
        gettext_lazy('Bạn đã đạt Huy hiệu Sấm Chớp'),
        DASHBOARD_PATH,
    ),
    EmployerNotification.EventType.FLASH_BADGE_LOST: (
        gettext_lazy('Bạn đã mất Huy hiệu Sấm Chớp'),
        DASHBOARD_PATH,
    ),
    EmployerNotification.EventType.FLASH_BADGE_AT_RISK: (
        gettext_lazy('Huy hiệu Sấm Chớp sắp bị gỡ'),
        APPLICATIONS_PATH,
    ),
    EmployerNotification.EventType.JOB_CHANGES_REQUESTED: (
        gettext_lazy('Tin tuyển dụng cần chỉnh sửa'),
        JOBS_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_REQUESTED: (
        gettext_lazy('Có yêu cầu tham gia công ty'),
        COMPANY_MEMBERS_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_APPROVED: (
        gettext_lazy('Yêu cầu tham gia công ty đã được duyệt'),
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_JOIN_REJECTED: (
        gettext_lazy('Yêu cầu tham gia công ty bị từ chối'),
        COMPANY_PATH,
    ),
    EmployerNotification.EventType.COMPANY_OWNERSHIP_CHANGED: (
        gettext_lazy('Quyền quản lý công ty đã thay đổi'),
        COMPANY_MEMBERS_PATH,
    ),
    EmployerNotification.EventType.JOBS_HANDED_OVER: (
        gettext_lazy('Tin tuyển dụng được giao lại'),
        JOBS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ACTIVATED: (
        gettext_lazy('Chiến dịch đã được kích hoạt theo lịch'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ACTIVATION_FAILED: (
        gettext_lazy('Chiến dịch chưa kích hoạt được theo lịch'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_ENDING_SOON: (
        gettext_lazy('Chiến dịch sắp đến ngày kết thúc'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_AUTO_COMPLETED: (
        gettext_lazy('Chiến dịch đã tự kết thúc'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT: (
        gettext_lazy('Chiến dịch cần chú ý'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_POST_FAILED: (
        gettext_lazy('Tự đăng bài không thành công'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_POST_DELETE_FAILED: (
        gettext_lazy('Cần tự gỡ bài trên mạng xã hội'),
        CAMPAIGNS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED: (
        gettext_lazy('Kết nối mạng xã hội đã hết hạn'),
        INTEGRATIONS_PATH,
    ),
    EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRING: (
        gettext_lazy('Kết nối mạng xã hội sắp hết hạn'),
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
    # Stored text is rendered once, in the recipient's language (ADR-0023).
    with recipient_language(recipient):
        title = str(title)
        normalized_message = str(message or '').strip()[:2000]
    # Producers may deep-link inside the event's section (one application).
    action_path = action_path if action_path.startswith(default_path) else default_path
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
