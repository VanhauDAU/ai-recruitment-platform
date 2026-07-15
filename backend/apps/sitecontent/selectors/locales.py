from ..models import Locale


TECHNICAL_FALLBACK_LOCALE = 'vi-VN'


def active_locales():
    return Locale.objects.filter(is_active=True).order_by('sort_order', 'label_vi', 'code')


def active_locale_codes():
    return active_locales().values_list('code', flat=True)


def is_active_locale(code):
    return Locale.objects.filter(code=code, is_active=True).exists()


def default_locale_code():
    return (
        Locale.objects.filter(is_default=True, is_active=True).values_list('code', flat=True).first()
        or Locale.objects.filter(is_active=True).order_by('sort_order', 'label_vi', 'code')
            .values_list('code', flat=True).first()
        or TECHNICAL_FALLBACK_LOCALE
    )
