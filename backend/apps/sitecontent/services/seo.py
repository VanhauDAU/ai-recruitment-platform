"""Public SEO configuration resolved from site-managed settings."""

from django.core.cache import cache

from common.storage.media import media_url_from_value

from ..models import SiteSetting
from .cache_keys import SEO_SETTINGS_CACHE_KEY

# Phải khớp default trong seed_data/settings.json (test hợp đồng kiểm tra).
SEO_SETTING_DEFAULTS = {
    'site_name': 'ProCV',
    'brand_logo_url': '/images/logo/logo-full.webp',
    'seo_default_title': 'ProCV - Việc làm & Tạo CV cùng AI',
    'seo_default_description': (
        'ProCV - Nền tảng tìm việc làm, tạo CV chuyên nghiệp và phát triển sự nghiệp cùng AI.'
    ),
    'seo_og_image': '',
    'seo_robots_index': True,
    'seo_google_site_verification': '',
}


_IMAGE_KEYS = ('brand_logo_url', 'seo_og_image')


def resolved_seo_settings():
    """SEO settings với ảnh đã đổi từ storage key sang URL public.

    Cache giữ storage key; URL được dựng sau khi đọc cache để đổi domain/CDN
    không bị kẹt URL cũ.
    """
    values = cache.get(SEO_SETTINGS_CACHE_KEY)
    if values is None:
        stored = dict(
            SiteSetting.objects.filter(key__in=SEO_SETTING_DEFAULTS).values_list('key', 'value')
        )
        values = {**SEO_SETTING_DEFAULTS, **stored}
        cache.set(SEO_SETTINGS_CACHE_KEY, values, 60 * 60)
    return {
        **values,
        **{key: media_url_from_value(values[key]) or '' for key in _IMAGE_KEYS},
    }


def seo_page_title(label, settings, *, employer=False):
    """Khớp `formatDocumentTitle` của frontend: "<Trang> | <Thương hiệu cổng>"."""
    brand = settings['site_name']
    if employer:
        brand = f'{brand} cho Nhà tuyển dụng'
    return f'{label} | {brand}' if label else brand
