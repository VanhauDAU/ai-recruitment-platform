"""Publication quota: how many jobs a recruiter may make public in total."""

from django.utils.translation import gettext as _

from apps.employers.services import recruiter_job_posting_entitlement
from apps.sitecontent.selectors import get_int_setting

FREE_JOB_QUOTA = 3
VERIFIED_LEVEL_THREE_JOB_QUOTA = 100


def _free_job_quota():
    return max(get_int_setting('employer_free_job_quota', FREE_JOB_QUOTA), 0)


def _verified_level_three_job_quota():
    return max(
        get_int_setting(
            'employer_verified_level_three_job_quota',
            VERIFIED_LEVEL_THREE_JOB_QUOTA,
        ),
        0,
    )


def _posting_quota(user):
    recruiter, entitlement = recruiter_job_posting_entitlement(user)
    is_verified_level_three = entitlement['verified_job_quota_eligible']
    return (
        recruiter,
        entitlement,
        (_verified_level_three_job_quota() if is_verified_level_three else _free_job_quota()),
    )


def _quota_exhausted_message(*, verified_level_three, limit):
    if verified_level_three:
        return _('Bạn đã dùng hết %(limit)s lượt đăng tin của tài khoản Cấp 3.') % {'limit': limit}
    return _(
        'Bạn đã dùng hết %(limit)s lượt đăng tin miễn phí. '
        'Hoàn tất xác thực hồ sơ và đạt Cấp 3 để có quota 100 tin.'
    ) % {'limit': limit}
