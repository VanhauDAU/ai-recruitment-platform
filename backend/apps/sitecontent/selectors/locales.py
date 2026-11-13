from ..models import Locale

TECHNICAL_FALLBACK_LOCALE = 'vi-VN'
# CV catalogue chỉ hỗ trợ tiếng Việt và tiếng Anh (CVT-0). Locale khác trong
# bảng bị bỏ qua dù đang bật, để admin không bật lại được ngôn ngữ đã gỡ.
SUPPORTED_LOCALE_CODES = ('vi-VN', 'en-US')


def active_locales():
    return Locale.objects.filter(is_active=True, code__in=SUPPORTED_LOCALE_CODES).order_by(
        'sort_order', 'label_vi', 'code'
    )


def active_locale_codes():
    return active_locales().values_list('code', flat=True)


def is_active_locale(code):
    return code in SUPPORTED_LOCALE_CODES and active_locales().filter(code=code).exists()


def default_locale_code():
    return (
        active_locales().filter(is_default=True).values_list('code', flat=True).first()
        or active_locales().values_list('code', flat=True).first()
        or TECHNICAL_FALLBACK_LOCALE
    )
