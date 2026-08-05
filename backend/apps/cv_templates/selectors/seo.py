"""Small public projections used by CV catalogue HTML and sitemaps."""

from apps.sitecontent.models import Locale
from common.seo import SITEMAP_URL_LIMIT

from ..models import CvCategory, CvTemplate, CvTemplateLocalization
from .templates import published_template_detail_queryset


def seo_catalog_context(*, catalog_path=None, locale_code=None, category_slug=None):
    locales = Locale.objects.filter(is_active=True)
    locale = (
        locales.filter(code=locale_code).first()
        if locale_code
        else locales.filter(catalog_path=catalog_path).first()
    )
    if not locale:
        return None, None
    category = None
    if category_slug:
        category = CvCategory.objects.filter(slug=category_slug, is_active=True).first()
    return locale, category


def seo_template_by_slug(slug, locale):
    return published_template_detail_queryset(locale=locale).filter(slug=slug).first()


def cv_template_sitemap_rows():
    localizations = (
        CvTemplateLocalization.objects.filter(
            is_active=True,
            locale_ref__is_active=True,
            template__status=CvTemplate.Status.ACTIVE,
            template__lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            template__current_published_version__version_status='published',
        )
        .select_related('template', 'locale_ref')
        .order_by('-template__updated_at')[:SITEMAP_URL_LIMIT]
    )
    locales = Locale.objects.filter(is_active=True).order_by('sort_order')
    categories = CvCategory.objects.filter(is_active=True).order_by('sort_order')
    return localizations, locales, categories
