"""Xác định email của nhà tuyển dụng có thuộc tên miền công ty hay không.

Đặt ở `common` vì cả `apps.employers` (checklist onboarding) lẫn `apps.jobs`
(huy hiệu xác thực trên tin đăng) đều cần đúng một quy tắc; hàm ở đây chỉ nhận
chuỗi nên không tạo phụ thuộc chéo giữa hai app.
"""

# Những miền email công khai không bao giờ được xem là tên miền công ty.
PUBLIC_EMAIL_DOMAINS = frozenset(
    {
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
    }
)


def email_domain(value):
    """Phần tên miền đã chuẩn hoá của một địa chỉ email, rỗng nếu không hợp lệ."""
    domain = (value or '').rsplit('@', 1)[-1].strip().lower()
    return domain if '@' in (value or '') and '.' in domain else ''


def is_public_email_domain(value):
    return email_domain(value) in PUBLIC_EMAIL_DOMAINS


def is_company_domain_email(user_email, company_email):
    """Email người dùng có cùng tên miền với email doanh nghiệp hay không.

    Quy tắc chặt: công ty chưa khai email doanh nghiệp thì tiêu chí coi như chưa
    đạt. Bản cũ trả True cho mọi tên miền không công khai khi thiếu email công
    ty, nên bất kỳ ai dùng `hr@ten-mien-bat-ky.com` cũng vượt qua được.
    """
    user_domain = email_domain(user_email)
    if not user_domain or user_domain in PUBLIC_EMAIL_DOMAINS:
        return False
    return user_domain == email_domain(company_email)
