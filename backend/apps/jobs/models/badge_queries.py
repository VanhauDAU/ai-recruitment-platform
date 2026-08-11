"""Huy hiệu xác thực của đúng nhà tuyển dụng đã đăng tin.

Tên field HTTP ``company_verified``/``company_verification`` được giữ để tương
thích với client hiện tại. Nguồn sự thật là hồ sơ ``EmployerVerificationCase``
của recruiter, không phải trạng thái hay giấy tờ dùng chung của công ty.
"""

from django.db.models import F

from apps.employers.models import EmployerVerificationCase

CRITERIA_LABELS = (
    (
        'employer_verification_approved',
        'Hồ sơ nhà tuyển dụng của người đăng tin đã được quản trị viên duyệt',
    ),
)


def job_badge_criteria(job):
    """Trả trạng thái duyệt của recruiter gắn với đúng công ty trên ``job``."""
    if job is None or job.company_id is None or job.posted_by_id is None:
        return {'employer_verification_approved': False, 'verified': False}

    approved = EmployerVerificationCase.objects.filter(
        recruiter__user_id=job.posted_by_id,
        recruiter__company_id=job.company_id,
        company_id=job.company_id,
        status=EmployerVerificationCase.Status.APPROVED,
    ).exists()
    return {
        'employer_verification_approved': approved,
        'verified': approved,
    }


def badge_verified_map(badge_keys):
    """Cờ huy hiệu cho nhiều cặp ``(company_id, posted_by_id)`` bằng query cố định.

    Serializer danh sách gọi hàm này một lần cho cả trang; tính từng tài khoản sẽ
    thành N+1 và phá vỡ ngân sách truy vấn của endpoint list.
    """
    keys = {
        (company_id, posted_by_id)
        for company_id, posted_by_id in badge_keys
        if company_id and posted_by_id
    }
    if not keys:
        return {}

    company_ids = {company_id for company_id, _ in keys}
    user_ids = {posted_by_id for _, posted_by_id in keys}

    approved = set(
        EmployerVerificationCase.objects.filter(
            company_id__in=company_ids,
            recruiter__company_id__in=company_ids,
            recruiter__user_id__in=user_ids,
            company_id=F('recruiter__company_id'),
            status=EmployerVerificationCase.Status.APPROVED,
        ).values_list('company_id', 'recruiter__user_id')
    )
    return {key: key in approved for key in keys}


BADGE_CACHE_KEY = '_job_badge_cache'


def prime_badge_cache(context, badge_keys):
    """Nạp cờ huy hiệu vào cache dùng chung cho cả một response.

    Một response có thể chứa nhiều danh sách tin (kết quả, gợi ý, vị trí liên
    quan); nếu mỗi danh sách tự truy vấn thì số query nhân lên theo số danh
    sách chứ không chỉ theo số dòng.
    """
    cache = context.setdefault(BADGE_CACHE_KEY, {})
    missing = {key for key in badge_keys if all(key) and key not in cache}
    if missing:
        cache.update(badge_verified_map(missing))
    return cache


def badge_criteria_payload(job):
    """Dạng dữ liệu legacy cho API, với nội dung recruiter-scoped rõ ràng."""
    criteria = job_badge_criteria(job)
    return {
        'verified': criteria['verified'],
        'criteria': [
            {
                'key': key,
                'label': label,
                'passed': criteria[key],
            }
            for key, label in CRITERIA_LABELS
        ],
    }
