"""Rules a job must satisfy before and while it is public.

Deadline windows, the publication commitment and the publishable-draft check
live here so the employer form context and every workflow read the same limits.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import RecruitmentCampaign
from common.vietnam_time import vietnam_today

from ...models import Job, JobCategoryAssignment
from ..lifecycle import visibility_days_error

EXPIRED_JOB_RENEWAL_GRACE_DAYS = 30
# The commitment a recruiter accepts each time a job goes public. Change the
# version together with the text so stored acknowledgements stay attributable.
RESPONSIBILITY_STATEMENT_VERSION = '2026-11'
RESPONSIBILITY_STATEMENT_TEXT = (
    'Tôi cam kết nội dung tin tuyển dụng là đúng sự thật, tuân thủ pháp luật và quy định '
    'đăng tin của ProCV, đồng thời chịu trách nhiệm về tin đã đăng và mọi chỉnh sửa sau đó.'
)


def job_deadline_policy():
    """Return the validated deadline contract shared with employer clients."""
    maximum_days = max(settings.JOB_POSTING_MAX_DEADLINE_DAYS, 1)
    default_days = min(max(settings.JOB_POSTING_DEFAULT_DEADLINE_DAYS, 1), maximum_days)
    maximum_public_lifetime_days = max(
        settings.JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS,
        maximum_days,
    )
    return {
        'default_deadline_days': default_days,
        'max_deadline_days': maximum_days,
        'max_public_lifetime_days': maximum_public_lifetime_days,
    }


def job_deadline_error(deadline, *, required=True, today=None):
    """Return a localized validation error, keeping date rules in one place."""
    if deadline is None:
        return 'Chọn hạn nhận hồ sơ.' if required else ''
    today = today or vietnam_today()
    if deadline < today:
        return 'Hạn nhận hồ sơ phải từ hôm nay trở đi.'
    maximum_days = job_deadline_policy()['max_deadline_days']
    if deadline > today + timedelta(days=maximum_days):
        return f'Hạn nhận hồ sơ không được quá {maximum_days} ngày kể từ hôm nay.'
    return ''


def _ensure_visibility_window_open(job):
    """Refuse to publish a job whose public cycle has already ended."""
    if job.visibility_ends_at is not None and job.visibility_ends_at <= timezone.now():
        raise ValidationError(
            {
                'code': 'JOB_VISIBILITY_EXPIRED',
                'detail': 'Tin đã hết vòng đời hiển thị. Cần một lượt đăng mới để tiếp tục.',
            }
        )


def _ensure_public_lifetime(job, deadline, *, visibility_end=None):
    """Rules every renewal shares, whether the job stayed open or was closed.

    The public cycle is capped from its immutable first approval, the
    application deadline cannot outlive the visibility window, and a campaign
    job never renews past the campaign's target date.
    """
    anchor = job.first_approved_at or job.published_at
    if anchor:
        maximum_days = job_deadline_policy()['max_public_lifetime_days']
        if deadline > vietnam_today(anchor) + timedelta(days=maximum_days):
            raise ValidationError(
                {
                    'deadline': (
                        f'Tổng thời gian công khai của tin không được quá {maximum_days} ngày. '
                        'Hãy nhân bản tin để đăng một lượt mới.'
                    ),
                }
            )
    visibility_end = visibility_end or job.visibility_ends_at
    if visibility_end is not None and deadline > vietnam_today(visibility_end):
        raise ValidationError(
            {
                'deadline': (
                    'Hạn nhận hồ sơ vượt thời gian công khai của tin. '
                    'Vui lòng dùng quyền gia hạn tin trước.'
                )
            }
        )
    # A paused campaign is already refused by ``_ensure_publication_allowed``.
    if job.campaign_id and job.campaign.target_date and deadline > job.campaign.target_date:
        raise ValidationError({'deadline': 'Hạn gia hạn không được sau ngày kết thúc chiến dịch.'})


def _ensure_publication_allowed(job, publication_state):
    """Fail closed when the recruiter or the campaign may not show this job.

    Publishing makes a job public without an administrator in between, so the
    recruiter's verification, DPA and compliance state are checked here.
    """
    blockers = list(publication_state['publish_blockers'])
    if job.campaign_id and job.campaign.status != RecruitmentCampaign.Status.ACTIVE:
        blockers.append({'code': 'campaign_inactive', 'label': 'Chiến dịch hiện không hoạt động.'})
    if blockers:
        raise ValidationError(
            {
                'code': 'JOB_PUBLICATION_BLOCKED',
                'detail': 'Chưa thể đăng tin.',
                'blocked_reasons': blockers,
            }
        )


def _ensure_responsibility_accepted(accepted_statement_version):
    """Require the recruiter to have accepted the commitment currently in force."""
    if accepted_statement_version != RESPONSIBILITY_STATEMENT_VERSION:
        raise ValidationError(
            {
                'code': 'JOB_RESPONSIBILITY_REQUIRED',
                'detail': 'Xác nhận cam kết chịu trách nhiệm về nội dung tin trước khi đăng.',
            }
        )


def job_publishability_errors(job):
    """Field errors that would stop ``publish_job``; empty when the draft is complete."""
    try:
        _validate_publishable(job)
    except ValidationError as error:
        return error.detail
    return {}


def _validate_publishable(job):
    errors = {}
    today = vietnam_today()
    if not job.title.strip():
        errors['title'] = 'Nhập tiêu đề tin tuyển dụng.'
    if not job.description.strip():
        errors['description'] = 'Nhập mô tả công việc.'
    if not job.requirements.strip():
        errors['requirements'] = 'Nhập yêu cầu ứng viên.'
    if not job.benefits.strip():
        errors['benefits'] = 'Nhập quyền lợi ứng viên.'
    if not job.position_level:
        errors['position_level'] = 'Chọn cấp bậc.'
    if not job.employment_type:
        errors['employment_type'] = 'Chọn loại công việc.'
    if not (job.work_types or job.work_type):
        errors['work_types'] = 'Chọn ít nhất một hình thức làm việc.'
    if not job.education_level:
        errors['education_level'] = 'Chọn yêu cầu học vấn.'
    if not job.experience_years:
        errors['experience_years'] = 'Chọn yêu cầu kinh nghiệm.'
    if job.salary_type is None:
        errors['salary_type'] = 'Chọn loại lương và nhập đầy đủ mức lương.'
    elif job.salary_type == Job.SalaryType.RANGE:
        if job.salary_min is None and job.salary_max is None:
            errors['salary_type'] = 'Nhập ít nhất một mức lương.'
        elif (
            job.salary_min is not None
            and job.salary_max is not None
            and job.salary_max < job.salary_min
        ):
            errors['salary_max'] = 'Mức lương tối đa không được nhỏ hơn mức tối thiểu.'
    elif job.salary_type in (Job.SalaryType.FIXED, Job.SalaryType.FROM):
        if job.salary_min is None:
            errors['salary_min'] = 'Loại lương này cần mức lương tối thiểu.'
    elif job.salary_type == Job.SalaryType.UP_TO and job.salary_max is None:
        errors['salary_max'] = 'Loại lương này cần mức lương tối đa.'
    if not job.number_of_vacancies or job.number_of_vacancies < 1:
        errors['number_of_vacancies'] = 'Số lượng tuyển phải từ 1 trở lên.'
    if not job.job_locations.exists():
        errors['job_locations'] = 'Thêm ít nhất một địa điểm làm việc.'
    if not job.category_assignments.filter(
        role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
    ).exists():
        errors['category_assignments'] = 'Chọn một vị trí chuyên môn chính.'
    if deadline_error := job_deadline_error(job.deadline, today=today):
        errors['deadline'] = deadline_error
    if visibility_error := visibility_days_error(job.requested_visibility_days):
        errors['requested_visibility_days'] = visibility_error
    contact = getattr(job, 'application_contact', None)
    if contact is None:
        errors['application_contact'] = 'Nhập thông tin người nhận hồ sơ.'
    else:
        contact_errors = {}
        if not contact.recipient_name.strip():
            contact_errors['recipient_name'] = 'Nhập họ tên người nhận hồ sơ.'
        if not contact.phone.strip():
            contact_errors['phone'] = 'Nhập số điện thoại người nhận hồ sơ.'
        if not contact.emails.exists():
            contact_errors['emails'] = 'Nhập ít nhất một email nhận hồ sơ.'
        if contact_errors:
            errors['application_contact'] = contact_errors
    if errors:
        raise ValidationError(errors)
