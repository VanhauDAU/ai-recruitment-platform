"""Điều kiện gắn huy hiệu "đã xác thực" cho tin tuyển dụng.

Huy hiệu chỉ sáng khi nhà tuyển dụng đạt đủ năm tiêu chí; mỗi tiêu chí đọc từ
đúng một nguồn dữ liệu gốc để không phát sinh cờ trùng lặp.
"""

from datetime import timedelta

from django.utils import timezone

from apps.employers.models import CompanyDocument, RecruiterProfile
from apps.sitecontent.models import SiteSetting
from common.company_email import is_company_domain_email

from .report import JobReport

MIN_ACCOUNT_AGE_SETTING = 'employer_badge_min_account_months'
DEFAULT_MIN_ACCOUNT_AGE_MONTHS = 6
DAYS_PER_MONTH = 30

# Thứ tự cũng là thứ tự hiển thị trong tooltip trên tin đăng.
CRITERIA_LABELS = (
    ('email_domain_verified', 'Đã xác thực email tên miền công ty'),
    ('phone_verified', 'Đã xác thực số điện thoại'),
    ('business_doc_approved', 'Đã được duyệt Giấy phép kinh doanh'),
    ('account_age_reached', 'Tài khoản NTD được tạo tối thiểu {months} tháng'),
    (
        'no_report_history',
        'Chưa có tin đăng vi phạm được quản trị viên xác nhận',
    ),
)


def minimum_account_age_months():
    value = (
        SiteSetting.objects.filter(key=MIN_ACCOUNT_AGE_SETTING)
        .values_list('value', flat=True)
        .first()
    )
    try:
        months = int(value) if value is not None else DEFAULT_MIN_ACCOUNT_AGE_MONTHS
    except (TypeError, ValueError):
        months = DEFAULT_MIN_ACCOUNT_AGE_MONTHS
    return max(months, 0)


def job_badge_criteria(job):
    """Trả về năm tiêu chí của chính tài khoản đã đăng ``job``."""
    months = minimum_account_age_months()
    empty = {key: False for key, _ in CRITERIA_LABELS}
    if job is None or job.company_id is None or job.posted_by_id is None:
        return {**empty, 'verified': False, 'min_account_age_months': months}

    company = job.company
    user = job.posted_by
    try:
        recruiter = user.recruiter_profile
    except RecruiterProfile.DoesNotExist:
        recruiter = None
    recruiter_matches_company = bool(recruiter and recruiter.company_id == company.pk)

    email_domain_verified = bool(
        user and user.email_verified and is_company_domain_email(user.email, company.email)
    )
    phone_verified = bool(recruiter_matches_company and recruiter.phone_verified_at)
    business_doc_approved = CompanyDocument.objects.filter(
        company=company,
        uploaded_by=user,
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        status=CompanyDocument.Status.APPROVED,
    ).exists()
    account_age_reached = bool(
        user
        and user.date_joined
        and user.date_joined <= timezone.now() - timedelta(days=months * DAYS_PER_MONTH)
    )
    # Chỉ báo cáo đã được admin xác nhận vi phạm mới làm mất huy hiệu.
    no_report_history = not JobReport.objects.filter(
        job__posted_by=user,
        status=JobReport.Status.UPHELD,
    ).exists()

    criteria = {
        'email_domain_verified': email_domain_verified,
        'phone_verified': phone_verified,
        'business_doc_approved': business_doc_approved,
        'account_age_reached': account_age_reached,
        'no_report_history': no_report_history,
    }
    return {
        **criteria,
        'verified': all(criteria.values()),
        'min_account_age_months': months,
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

    months = minimum_account_age_months()
    threshold = timezone.now() - timedelta(days=months * DAYS_PER_MONTH)
    company_ids = {company_id for company_id, _ in keys}
    user_ids = {posted_by_id for _, posted_by_id in keys}

    recruiters = {
        (recruiter.company_id, recruiter.user_id): recruiter
        for recruiter in (
            RecruiterProfile.objects.filter(
                company_id__in=company_ids,
                user_id__in=user_ids,
            ).select_related('user', 'company')
        )
    }

    approved_docs = set(
        CompanyDocument.objects.filter(
            company_id__in=company_ids,
            uploaded_by_id__in=user_ids,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            status=CompanyDocument.Status.APPROVED,
        ).values_list('company_id', 'uploaded_by_id')
    )
    reported = set(
        JobReport.objects.filter(
            job__posted_by_id__in=user_ids,
            status=JobReport.Status.UPHELD,
        ).values_list('job__posted_by_id', flat=True)
    )

    result = {}
    for key in keys:
        company_id, user_id = key
        recruiter = recruiters.get(key)
        user = getattr(recruiter, 'user', None)
        company = getattr(recruiter, 'company', None)
        result[key] = all(
            [
                bool(
                    user
                    and company
                    and user.email_verified
                    and is_company_domain_email(user.email, company.email)
                ),
                bool(recruiter and recruiter.phone_verified_at),
                key in approved_docs,
                bool(user and user.date_joined and user.date_joined <= threshold),
                user_id not in reported,
            ]
        )
    return result


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
    """Dạng dữ liệu cho API: cờ tổng kèm danh sách tiêu chí đã dịch nhãn."""
    criteria = job_badge_criteria(job)
    months = criteria['min_account_age_months']
    return {
        'verified': criteria['verified'],
        'criteria': [
            {
                'key': key,
                'label': template.format(months=months),
                'passed': criteria[key],
            }
            for key, template in CRITERIA_LABELS
        ],
    }
