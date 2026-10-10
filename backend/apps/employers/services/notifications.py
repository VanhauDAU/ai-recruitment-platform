"""Canonical, privacy-safe employer notification and activity writer."""

from __future__ import annotations

from django.db import transaction

from common.metrics import record_metric

from ..models import EmployerActivity, EmployerNotification, EmployerNotificationPreference

VERIFY_PATH = '/tuyendung/app/employer-verify'
COMPANY_PATH = '/tuyendung/app/account/settings/company'

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
}

SAFE_METADATA_KEYS = {'case_public_id', 'company_public_id', 'event_public_id', 'status'}


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
):
    """Idempotently persist notification + activity in the caller transaction."""

    if event_type not in EVENT_PRESENTATION:
        raise ValueError('EMPLOYER_EVENT_TYPE_UNSUPPORTED')
    normalized_dedupe = str(dedupe_key).strip()[:160]
    if not normalized_dedupe:
        raise ValueError('EMPLOYER_EVENT_DEDUPE_REQUIRED')
    title, action_path = EVENT_PRESENTATION[event_type]
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
