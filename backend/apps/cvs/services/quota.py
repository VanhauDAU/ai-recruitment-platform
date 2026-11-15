"""Per-account CV quota, configured by admins through `candidate_max_cvs`."""

from http import HTTPStatus

from rest_framework.exceptions import APIException

from apps.sitecontent.selectors import get_int_setting

from ..models import UserCv

MAX_CVS_SETTING = 'candidate_max_cvs'
DEFAULT_MAX_CVS = 6


class CvQuotaExceeded(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'CV_LIMIT_REACHED'

    def __init__(self, limit):
        super().__init__(
            detail={
                'code': self.default_code,
                'message': f'Hiện tại tài khoản của bạn chỉ hỗ trợ tạo {limit} CV!',
                'limit': limit,
            },
            code=self.default_code,
        )


def ensure_cv_quota(actor):
    """Raise before creating another CV once the owner reached the admin limit.

    Archived CVs still count, otherwise archive + restore would bypass the
    limit. The owner row lock serialises concurrent creates; call inside a
    transaction. A limit of 0 or less disables the check.
    """
    actor.__class__.objects.select_for_update().get(pk=actor.pk)
    limit = get_int_setting(MAX_CVS_SETTING, DEFAULT_MAX_CVS)
    if limit > 0 and UserCv.objects.filter(user=actor).count() >= limit:
        raise CvQuotaExceeded(limit)
