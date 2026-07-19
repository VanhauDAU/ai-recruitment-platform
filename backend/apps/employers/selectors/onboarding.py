"""Read model for recruiter onboarding and account-verification progress."""

from django.db.models import Q

from ..models import CompanyDocument, RecruiterProfile
from .company_status import has_explicit_company_link


# Những miền email công khai không được xem là email theo tên miền công ty.
# Danh sách này chỉ phục vụ việc tính cấp độ hiển thị; việc xác thực email vẫn
# dựa trên cờ `email_verified` của tài khoản.
PUBLIC_EMAIL_DOMAINS = frozenset({
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.com.vn',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'proton.me',
    'protonmail.com',
    'zoho.com',
    'mail.com',
    'example.com',
    'example.org',
    'example.net',
})


def _is_company_email(recruiter):
    """Return whether the verified user email belongs to the company domain."""
    user_domain = (recruiter.user.email or '').rsplit('@', 1)[-1].strip().lower()
    if not user_domain or '.' not in user_domain or user_domain in PUBLIC_EMAIL_DOMAINS:
        return False
    company_email = getattr(recruiter.company, 'email', '') if recruiter.company_id else ''
    company_domain = (company_email or '').rsplit('@', 1)[-1].strip().lower()
    return not company_domain or user_domain == company_domain


def build_employer_onboarding_steps(recruiter):
    """Derive every onboarding/checklist state from its canonical record."""
    company_linked = has_explicit_company_link(recruiter)
    has_business_doc = company_linked and recruiter.company.documents.filter(
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
    ).exclude(status=CompanyDocument.Status.REJECTED).exists()
    has_approved_business_doc = company_linked and recruiter.company.documents.filter(
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        status=CompanyDocument.Status.APPROVED,
    ).exists()
    candidate_dpa = Q(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        recruiter=recruiter,
    )
    if company_linked:
        # Hỗ trợ văn bản DLCN cũ được lưu trước khi contract tách theo recruiter.
        candidate_dpa |= Q(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            company=recruiter.company,
        )
    has_candidate_dpa = CompanyDocument.objects.filter(candidate_dpa).exclude(
        status=CompanyDocument.Status.REJECTED,
    ).exists()
    steps = {
        'email_verified': recruiter.user.email_verified,
        'registration_completed': recruiter.registration_completed_at is not None,
        'consulting_need_completed': recruiter.recruitment_needs.exists(),
        'phone_verified': recruiter.phone_verified_at is not None,
        'company_linked': company_linked,
        'membership_approved': company_linked and recruiter.membership_status == RecruiterProfile.MembershipStatus.APPROVED,
        'business_doc_submitted': has_business_doc,
        'business_doc_approved': has_approved_business_doc,
        'email_domain_verified': recruiter.user.email_verified and _is_company_email(recruiter),
        # Chưa có model lịch sử báo cáo tin tuyển dụng; giữ cờ tách biệt để
        # khi bổ sung workflow báo cáo chỉ cần thay nguồn dữ liệu tại đây.
        'no_report_history': True,
        'candidate_dpa_submitted': has_candidate_dpa,
        'dpa_accepted': recruiter.dpa_accepted_at is not None,
        'first_job_posted': recruiter.user.posted_jobs.exists(),
    }
    steps['account_ready'] = all([
        steps['email_verified'],
        steps['registration_completed'],
        steps['consulting_need_completed'],
    ])
    # Xác thực tài khoản hoàn tất sau năm workflow bảo mật/pháp lý đang khả
    # dụng. Đăng tin đầu tiên là bước kích hoạt sản phẩm riêng và chưa được dùng
    # để buộc một tài khoản đã xác thực quay lại checklist ở mỗi lần đăng nhập.
    steps['verification_completed'] = all([
        steps['account_ready'],
        steps['phone_verified'],
        steps['company_linked'],
        steps['membership_approved'],
        steps['business_doc_submitted'],
        steps['candidate_dpa_submitted'],
        steps['dpa_accepted'],
    ])
    steps['completed'] = steps['verification_completed'] and steps['first_job_posted']
    return steps
