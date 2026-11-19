"""Lỗi HTTP riêng của luồng tạo tin bằng AI (mã máy ổn định cho frontend)."""

from http import HTTPStatus

from django.utils.translation import gettext as _
from rest_framework.exceptions import APIException


class JobAiGenerationUnavailable(APIException):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    default_code = 'JOB_AI_GENERATION_UNAVAILABLE'

    def __init__(self, code='job_ai_generation_disabled'):
        self.machine_code = code
        super().__init__({'code': code, 'detail': _('Tạo tin bằng AI hiện chưa khả dụng.')})


class JobAiGenerationQuotaExceeded(APIException):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_code = 'JOB_AI_DAILY_QUOTA_EXCEEDED'

    def __init__(self, limit, *, model=''):
        self.model = model
        super().__init__(
            {
                'code': 'JOB_AI_DAILY_QUOTA_EXCEEDED',
                'detail': _('Bạn đã dùng hết %(limit)s lượt tạo tin bằng AI hôm nay.')
                % {'limit': limit},
                'quota_remaining': 0,
            }
        )


class JobAiIdempotencyConflict(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'JOB_AI_IDEMPOTENCY_CONFLICT'

    def __init__(self):
        super().__init__(
            {
                'code': 'JOB_AI_IDEMPOTENCY_CONFLICT',
                'detail': _('Idempotency key đã được dùng cho một nội dung khác.'),
            }
        )
