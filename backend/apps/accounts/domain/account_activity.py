"""Vocabulary and pagination rules for the per-account activity timeline.

The timeline merges several append-only tables (sessions, admin audit,
status transitions, verification/company/recruitment events). Everything
here is pure so the labels, categories and cursor maths are unit-testable
without a database; the selector owns the queries.
"""

import base64
import heapq
import json
from datetime import datetime
from itertools import islice

SECURITY = 'security'
ACCOUNT = 'account'
VERIFICATION = 'verification'
COMPANY = 'company'
RECRUITMENT = 'recruitment'
CATEGORIES = (SECURITY, ACCOUNT, VERIFICATION, COMPANY, RECRUITMENT)

NEUTRAL = 'neutral'
SUCCESS = 'success'
WARNING = 'warning'
DANGER = 'danger'

DEFAULT_LIMIT = 30
MAX_LIMIT = 100

# Admin audit rows whose target is the account itself. Status changes and the
# company unlink also write audit rows, but their own tables are the richer
# source, so they are left out here to avoid showing the same event twice.
AUDIT_ACTION_META = {
    'revoke_account_sessions': (SECURITY, 'Thu hồi phiên đăng nhập', WARNING),
    'send_account_password_reset': (SECURITY, 'Gửi email đặt lại mật khẩu', NEUTRAL),
    'resend_account_verification': (SECURITY, 'Gửi lại email xác minh', NEUTRAL),
    'change_account_email': (SECURITY, 'Đổi email đăng nhập', WARNING),
    'self_password_change': (SECURITY, 'Đổi mật khẩu', NEUTRAL),
    'self_session_revoke': (SECURITY, 'Đăng xuất một thiết bị', NEUTRAL),
    'self_session_revoke_others': (SECURITY, 'Đăng xuất các thiết bị khác', NEUTRAL),
    'update_account_profile': (ACCOUNT, 'Sửa hồ sơ tài khoản', NEUTRAL),
    'self_profile_update': (ACCOUNT, 'Cập nhật hồ sơ', NEUTRAL),
    'reveal_account_sensitive_profile': (ACCOUNT, 'Xem dữ liệu nhạy cảm', WARNING),
}
USER_TARGET_AUDIT_ACTIONS = frozenset(AUDIT_ACTION_META)

STATUS_KIND_META = {
    'suspend': ('Tạm khóa tài khoản', DANGER),
    'ban': ('Cấm tài khoản', DANGER),
    'begin_reactivation': ('Bắt đầu khôi phục tài khoản', WARNING),
    'reactivate': ('Mở lại tài khoản', SUCCESS),
    'release_resource_holds': ('Gỡ giữ tài nguyên', SUCCESS),
}
ACCOUNT_STATUS_LABELS = {
    'active': 'Đang hoạt động',
    'inactive': 'Tạm khóa',
    'banned': 'Bị cấm',
    'pending': 'Chờ kích hoạt',
}
VIOLATION_CATEGORY_LABELS = {
    'security': 'Bảo mật',
    'fraud': 'Gian lận',
    'policy': 'Vi phạm chính sách',
    'legal': 'Pháp lý',
    'other': 'Khác',
}

PORTAL_LABELS = {'employer': 'cổng NTD', 'candidate': 'cổng ứng viên', 'admin': 'cổng quản trị'}
AUTH_METHOD_LABELS = {
    'password': 'Mật khẩu',
    'oauth': 'Đăng nhập mạng xã hội',
    'registration': 'Sau khi đăng ký',
}

PHONE_EVENT_META = {
    'verified': ('Xác minh số điện thoại', SUCCESS),
    'dispatch_failed': ('Gửi mã OTP thất bại', WARNING),
}

VERIFICATION_EVENT_TITLES = {
    'submitted': 'Nộp hồ sơ xác thực',
    'review_started': 'Nhận xử lý hồ sơ xác thực',
    'document_reviewed': 'Xử lý giấy tờ xác thực',
    'document_replaced': 'Thay giấy tờ xác thực',
    'changes_requested': 'Yêu cầu bổ sung hồ sơ xác thực',
    'resubmitted': 'Nộp lại hồ sơ xác thực',
    'resubmission_unlocked': 'Mở khóa nộp lại hồ sơ',
    'approved': 'Duyệt hồ sơ xác thực',
    'rejected': 'Từ chối hồ sơ xác thực',
    'revoked': 'Thu hồi xác thực',
    'expired': 'Xác thực hết hiệu lực',
    'reapproved': 'Duyệt lại hồ sơ xác thực',
    'hold_applied': 'Áp dụng tạm giữ tuân thủ',
    'hold_released': 'Gỡ tạm giữ tuân thủ',
    'sensitive_viewed': 'Xem giấy tờ xác thực',
    'tax_lookup_refreshed': 'Tra cứu lại mã số thuế',
    'withdrawn_by_unlink': 'Rút hồ sơ do gỡ liên kết công ty',
}
COMPANY_UPDATE_EVENT_TITLES = {
    'submitted': 'Gửi yêu cầu cập nhật công ty',
    'resubmitted': 'Gửi lại yêu cầu cập nhật công ty',
    'revision_created': 'Tạo phiên bản cập nhật công ty',
    'review_started': 'Bắt đầu thẩm định cập nhật công ty',
    'document_reviewed': 'Xử lý giấy tờ cập nhật công ty',
    'changes_requested': 'Yêu cầu chỉnh sửa cập nhật công ty',
    'approved': 'Duyệt cập nhật công ty',
    'rejected': 'Từ chối cập nhật công ty',
    'withdrawn': 'Rút yêu cầu cập nhật công ty',
    'cancelled': 'Hủy yêu cầu cập nhật công ty',
}

_VERIFICATION_TONES = {
    'approved': SUCCESS,
    'reapproved': SUCCESS,
    'hold_released': SUCCESS,
    'changes_requested': WARNING,
    'expired': WARNING,
    'withdrawn_by_unlink': WARNING,
    'hold_applied': WARNING,
    'sensitive_viewed': WARNING,
    'rejected': DANGER,
    'revoked': DANGER,
}
_COMPANY_UPDATE_TONES = {
    'approved': SUCCESS,
    'changes_requested': WARNING,
    'rejected': DANGER,
}
_COMPANY_LINK_TONES = {'admin_unlinked': WARNING, 'member_removed': WARNING}
DECISION_LABELS = {
    'approved': 'Đạt',
    'changes_requested': 'Cần bổ sung',
    'rejected': 'Từ chối',
}

# Recruiter feed events already shown by a richer source are skipped.
EMPLOYER_ACTIVITY_DUPLICATES = frozenset(
    {
        'verification_approved',
        'verification_changes_requested',
        'verification_rejected',
        'verification_revoked',
        'verification_expired',
        'document_changes_requested',
        'document_rejected',
        'company_link_removed',
        'company_ownership_changed',
    }
)
EMPLOYER_ACTIVITY_COMPANY_EVENTS = frozenset(
    {
        'company_join_requested',
        'company_join_approved',
        'company_join_rejected',
        'company_page_editor_granted',
        'company_page_editor_revoked',
        'company_content_reverted',
    }
)
_EMPLOYER_ACTIVITY_TONES = {
    'company_join_rejected': WARNING,
    'company_page_editor_revoked': WARNING,
    'company_content_reverted': WARNING,
    'job_changes_requested': WARNING,
    'campaign_activation_failed': DANGER,
    'social_post_failed': DANGER,
    'social_post_delete_failed': DANGER,
    'social_connection_expired': WARNING,
    'campaign_health_alert': WARNING,
    'company_join_approved': SUCCESS,
    'company_page_editor_granted': SUCCESS,
}


def audit_meta(action):
    return AUDIT_ACTION_META.get(action, (ACCOUNT, 'Thao tác quản trị', NEUTRAL))


def verification_tone(event_type):
    return _VERIFICATION_TONES.get(event_type, NEUTRAL)


def company_update_tone(event_type):
    return _COMPANY_UPDATE_TONES.get(event_type, NEUTRAL)


def company_link_tone(event_type):
    return _COMPANY_LINK_TONES.get(event_type, NEUTRAL)


def employer_activity_category(event_type):
    return COMPANY if event_type in EMPLOYER_ACTIVITY_COMPANY_EVENTS else RECRUITMENT


def employer_activity_tone(event_type):
    return _EMPLOYER_ACTIVITY_TONES.get(event_type, NEUTRAL)


def status_change_label(before, after):
    before_label = ACCOUNT_STATUS_LABELS.get(before, before)
    after_label = ACCOUNT_STATUS_LABELS.get(after, after)
    return f'{before_label} → {after_label}'


def parse_category(value):
    value = (value or '').strip()
    return value if value in CATEGORIES else ''


def parse_limit(value):
    try:
        limit = int(value)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))


# ---------------------------------------------------------------- cursor ----
# Entries are totally ordered by (occurred_at, source rank, source pk), newest
# first. The cursor is the key of the last entry already shown; each source
# continues strictly after it, so equal timestamps are never skipped or shown
# twice.


def entry_sort_key(entry):
    return (entry['occurred_at'], entry['_rank'], entry['_pk'])


def encode_cursor(entry):
    raw = json.dumps([entry['occurred_at'].isoformat(), entry['_rank'], str(entry['_pk'])])
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip('=')


def decode_cursor(value):
    """Return ``(occurred_at, rank, pk_text)`` or ``None`` for a blank/invalid cursor."""
    if not value:
        return None
    try:
        padded = value + '=' * (-len(value) % 4)
        occurred_at, rank, pk = json.loads(base64.urlsafe_b64decode(padded.encode()))
        return datetime.fromisoformat(occurred_at), int(rank), str(pk)
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def merge_entries(sources, limit):
    """Merge newest-first source lists and return ``(page, has_more)``."""
    merged = heapq.merge(*sources, key=entry_sort_key, reverse=True)
    window = list(islice(merged, limit + 1))
    return window[:limit], len(window) > limit


def public_entry(entry):
    return {key: value for key, value in entry.items() if not key.startswith('_')}
