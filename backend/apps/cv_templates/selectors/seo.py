"""Small public projections used by CV catalogue HTML and sitemaps."""

from common.seo import SITEMAP_URL_LIMIT

from ..models import CATALOG_LANGUAGES, CvCategory, catalog_language_for_path
from .templates import published_template_detail_queryset, published_templates_in_language


def seo_catalog_context(*, catalog_path=None, category_slug=None):
    language = catalog_language_for_path(catalog_path)
    if not language:
        return None, None
    category = None
    if category_slug:
        category = CvCategory.objects.filter(slug=category_slug, is_active=True).first()
    return language, category


def seo_template_by_slug(slug, locale):
    return published_template_detail_queryset(locale=locale).filter(slug=slug).first()


def cv_template_sitemap_rows():
    """Trả `(language, template)` cho mọi mẫu đã xuất bản ở từng ngôn ngữ."""
    rows = [
        (language, template)
        for language in CATALOG_LANGUAGES
        for template in published_templates_in_language(language.code)
        .only('slug', 'updated_at')
        .order_by('-updated_at')[:SITEMAP_URL_LIMIT]
    ][:SITEMAP_URL_LIMIT]
    categories = CvCategory.objects.filter(is_active=True).order_by('sort_order')
    return rows, CATALOG_LANGUAGES, categories
