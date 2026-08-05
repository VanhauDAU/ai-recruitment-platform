"""Small public projections used by HTML SEO routes and sitemaps."""

from apps.locations.models import Location
from common.seo import SITEMAP_URL_LIMIT

from .listing import active_job_detail_queryset, active_jobs_queryset


def seo_job_by_slug(slug):
    return active_job_detail_queryset().filter(slug=slug).first()


def seo_location_by_slug(slug):
    return Location.objects.filter(
        slug=slug,
        is_active=True,
        level=Location.Level.PROVINCE,
    ).first()


def job_sitemap_rows():
    return (
        active_jobs_queryset()
        .order_by('-updated_at')
        .values_list(
            'slug',
            'updated_at',
        )[:SITEMAP_URL_LIMIT]
    )
