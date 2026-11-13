"""Danh tính minh họa cho ảnh và preview catalogue.

Nội dung mẫu cố ý không chứa tên hay liên hệ để không bao giờ lẫn vào CV của ứng
viên. Ảnh catalogue và preview cho khách chưa đăng nhập vẫn cần trông như một CV
thật, nên danh tính minh họa chỉ được thêm lúc hiển thị và không ghi vào DB.
Người đã đăng nhập thấy danh tính của chính họ (``overlay_actor_identity``).
"""

from copy import deepcopy

from .models import CATALOG_LANGUAGES, CvLanguage

DEMO_IDENTITY = {
    CvLanguage.VI: {
        'full_name': 'Nguyễn Minh Anh',
        'email': 'minhanh@example.com',
        'phone': '0901 234 567',
        'address': 'Quận 1, TP. Hồ Chí Minh',
    },
    CvLanguage.EN: {
        'full_name': 'Alex Nguyen',
        'email': 'alex.nguyen@example.com',
        'phone': '+84 901 234 567',
        'address': 'Ho Chi Minh City',
    },
}


def with_demo_identity(content_json, locale):
    """Điền danh tính minh họa vào các trường còn trống của một bản sao nội dung."""
    content = deepcopy(content_json)
    personal_info = content.setdefault('personal_info', {})
    identity = DEMO_IDENTITY.get(locale, DEMO_IDENTITY[CATALOG_LANGUAGES[0].code])
    for field, value in identity.items():
        personal_info[field] = personal_info.get(field) or value
    return content
