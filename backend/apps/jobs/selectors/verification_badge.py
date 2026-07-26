"""Điều kiện gắn huy hiệu "đã xác thực" cho tin tuyển dụng.

Huy hiệu chỉ sáng khi nhà tuyển dụng đạt đủ năm tiêu chí; mỗi tiêu chí đọc từ
đúng một nguồn dữ liệu gốc để không phát sinh cờ trùng lặp.
"""

from datetime import timedelta

from django.utils import timezone

from apps.employers.models import CompanyDocument, RecruiterProfile
from apps.sitecontent.selectors.settings import get_int_setting
from common.company_email import is_company_domain_email

from ..models import JobReport

MIN_ACCOUNT_AGE_SETTING = 'employer_badge_min_account_months'
DEFAULT_MIN_ACCOUNT_AGE_MONTHS = 6
DAYS_PER_MONTH = 30

# Thứ tự cũng là thứ tự hiển thị trong tooltip trên tin đăng.
CRITERIA_LABELS = (
    ('email_domain_verified', 'Đã xác thực email tên miền công ty'),
    ('phone_verified', 'Đã xác thực số điện thoại'),
    ('business_doc_approved', 'Đã được duyệt Giấy phép kinh doanh'),
    ('account_age_reached', 'Tài khoản NTD được tạo tối thiểu {months} tháng'),
    ('no_report_history', 'Chưa có lịch sử bị báo cáo tin đăng'),
)


def minimum_account_age_months():
    months = get_int_setting(MIN_ACCOUNT_AGE_SETTING, DEFAULT_MIN_ACCOUNT_AGE_MONTHS)
    return max(months, 0)


def _recruiter_for(company):
    """Chủ sở hữu công ty — mốc tuổi tài khoản tính theo người tạo công ty."""
    return (
        RecruiterProfile.objects.filter(company=company)
        .select_related('user')
        .order_by('created_at', 'id')
        .first()
    )


def employer_badge_criteria(company, recruiter=None):
    """Trả về trạng thái từng tiêu chí của một công ty.

    `recruiter` truyền vào khi caller đã có sẵn hồ sơ để tránh truy vấn thừa.
    """
    months = minimum_account_age_months()
    empty = {key: False for key, _ in CRITERIA_LABELS}
    if company is None:
        return {**empty, 'verified': False, 'min_account_age_months': months}

    if recruiter is None:
        recruiter = _recruiter_for(company)
    user = getattr(recruiter, 'user', None)

    email_domain_verified = bool(
        user and user.email_verified and is_company_domain_email(user.email, company.email)
    )
    phone_verified = bool(recruiter and recruiter.phone_verified_at)
    business_doc_approved = CompanyDocument.objects.filter(
        company=company,
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
        job__company=company,
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


def badge_verified_map(company_ids):
    """Cờ huy hiệu cho nhiều công ty bằng số truy vấn cố định.

    Serializer danh sách gọi hàm này một lần cho cả trang; tính từng công ty sẽ
    thành N+1 và phá vỡ ngân sách truy vấn của endpoint list.
    """
    ids = {company_id for company_id in company_ids if company_id}
    if not ids:
        return {}

    months = minimum_account_age_months()
    threshold = timezone.now() - timedelta(days=months * DAYS_PER_MONTH)

    owners = {}
    recruiters = (
        RecruiterProfile.objects.filter(company_id__in=ids)
        .select_related('user', 'company')
        .order_by('company_id', 'created_at', 'id')
    )
    for recruiter in recruiters:
        owners.setdefault(recruiter.company_id, recruiter)

    approved_docs = set(
        CompanyDocument.objects.filter(
            company_id__in=ids,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            status=CompanyDocument.Status.APPROVED,
        ).values_list('company_id', flat=True)
    )
    reported = set(
        JobReport.objects.filter(
            job__company_id__in=ids,
            status=JobReport.Status.UPHELD,
        ).values_list('job__company_id', flat=True)
    )

    result = {}
    for company_id in ids:
        recruiter = owners.get(company_id)
        user = getattr(recruiter, 'user', None)
        company = getattr(recruiter, 'company', None)
        result[company_id] = all(
            [
                bool(
                    user
                    and company
                    and user.email_verified
                    and is_company_domain_email(user.email, company.email)
                ),
                bool(recruiter and recruiter.phone_verified_at),
                company_id in approved_docs,
                bool(user and user.date_joined and user.date_joined <= threshold),
                company_id not in reported,
            ]
        )
    return result


BADGE_CACHE_KEY = '_job_badge_cache'


def prime_badge_cache(context, company_ids):
    """Nạp cờ huy hiệu vào cache dùng chung cho cả một response.

    Một response có thể chứa nhiều danh sách tin (kết quả, gợi ý, vị trí liên
    quan); nếu mỗi danh sách tự truy vấn thì số query nhân lên theo số danh
    sách chứ không chỉ theo số dòng.
    """
    cache = context.setdefault(BADGE_CACHE_KEY, {})
    missing = {company_id for company_id in company_ids if company_id and company_id not in cache}
    if missing:
        cache.update(badge_verified_map(missing))
    return cache


def badge_criteria_payload(company, recruiter=None):
    """Dạng dữ liệu cho API: cờ tổng kèm danh sách tiêu chí đã dịch nhãn."""
    criteria = employer_badge_criteria(company, recruiter=recruiter)
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
