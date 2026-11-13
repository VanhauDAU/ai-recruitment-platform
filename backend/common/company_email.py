"""Tên miền email: tách phần tên miền và danh sách miền email công khai.

Đặt ở `common` vì là quy tắc thuần trên chuỗi, dùng cho onboarding và xác minh
tên miền doanh nghiệp mà không tạo phụ thuộc chéo giữa các app.
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
