"""Read model of the public company page (ADR-0017)."""

from urllib.parse import urlsplit

from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.db.models.functions import Coalesce, Length, Trim

from apps.jobs.models import Job, JobLocation
from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text
from common.seo import SITEMAP_URL_LIMIT

from ..models import Company, CompanyIndustry, CompanyPageEvent
from ..page_registry import ACCENT_PALETTE, DEFAULT_ACCENT_KEY, MAIN_SECTIONS, SIDEBAR_SECTIONS
from .companies import legally_represented_companies_queryset


def indexable_companies_queryset():
    """Pages search engines may index (ADR-0017, decision 5).

    Visible, legally represented, with an industry, and with either a
    description or at least one publicly available job.
    """
    has_industry = CompanyIndustry.objects.filter(company_id=OuterRef('pk'))
    has_public_job = Job.publicly_available_queryset().filter(company_id=OuterRef('pk'))
    return (
        legally_represented_companies_queryset()
        .alias(
            _has_industry=Exists(has_industry),
            _description_length=Length(Trim('description')),
            _has_public_job=Exists(has_public_job),
        )
        .filter(content_policy_hold=False, _has_industry=True)
        .filter(Q(_description_length__gt=0) | Q(_has_public_job=True))
    )


def _companies_with_indexability():
    # The sitemap and every page surface share one SQL definition of
    # "indexable" so the robots tag can never disagree with the sitemap.
    indexable = indexable_companies_queryset().filter(pk=OuterRef('pk'))
    return Company.objects.annotate(is_indexable=Exists(indexable))


def company_page_queryset():
    """Companies loaded with everything ``build_public_company_profile`` reads."""
    industries = CompanyIndustry.objects.select_related('industry').order_by(
        '-is_primary', 'industry__name'
    )
    return _companies_with_indexability().prefetch_related(
        Prefetch('company_industries', queryset=industries),
        'images',
    )


def visible_company_page_by_slug(slug):
    return company_page_queryset().filter(slug=slug, content_policy_hold=False).first()


def visible_company_by_public_id(public_id):
    return Company.objects.filter(public_id=public_id, content_policy_hold=False).only('id').first()


def seo_company_by_slug(slug):
    return _companies_with_indexability().filter(slug=slug, content_policy_hold=False).first()


def company_sitemap_rows():
    return (
        indexable_companies_queryset()
        .order_by('-updated_at')
        .values_list('slug', 'updated_at')[:SITEMAP_URL_LIMIT]
    )


def public_company_website_url(company):
    """Only http(s) links may become an ``href`` on a public surface."""
    url = company.website_url.strip()
    return url if url.lower().startswith(('http://', 'https://')) else ''


def _rich_text(value):
    return {'body_html': value} if rich_text_plain_text(value) else None


def _gallery(company, request):
    items = [
        {
            'image_url': media_url_from_value(image.image_url, request=request),
            'caption': image.caption,
        }
        for image in company.images.all()
    ]
    return {'items': items} if items else None


def _offices(company):
    headquarters = company.public_headquarters
    if not headquarters:
        return None
    return {'items': [{'label': 'Trụ sở chính', 'address': headquarters}]}


def _facts(company, industries, website_url):
    facts = [
        {'key': 'company_size', 'label': 'Quy mô', 'value': company.get_company_size_display()},
        {
            'key': 'industries',
            'label': 'Lĩnh vực',
            'value': ', '.join(item['name'] for item in industries),
        },
        {
            'key': 'founded_year',
            'label': 'Năm thành lập',
            'value': str(company.founded_year or ''),
        },
        {
            'key': 'website',
            'label': 'Website',
            'value': (urlsplit(website_url).hostname or '').removeprefix('www.'),
            'href': website_url,
        },
    ]
    return [fact for fact in facts if fact['value']]


def _blocks(definitions, content):
    """Registry order decides the layout; a block without content is dropped
    unless the registry marks it always-on."""
    blocks = []
    for definition in definitions:
        payload = content.get(definition.key)
        if payload is None and not definition.always_on:
            continue
        blocks.append(
            {
                'key': definition.key,
                'type': definition.type,
                'title': definition.title,
                **(payload or {}),
            }
        )
    return blocks


def _active_public_job_count(company):
    return (
        Job.publicly_available_queryset()
        .filter(company_id=company.pk)
        .aggregate(total=Count('id', distinct=True))['total']
    )


def build_public_company_profile(company, *, request=None):
    """Public DTO of one company page.

    ``company`` must come from ``company_page_queryset()``. The public
    endpoint and the previews all call this builder, so every surface renders
    the same blocks and none of them can leak a field the others hide.
    """
    display_name = company.display_name
    website_url = public_company_website_url(company)
    industries = [
        {
            'id': item.industry_id,
            'name': item.industry.name,
            'slug': item.industry.slug,
            'is_primary': item.is_primary,
        }
        for item in company.company_industries.all()
    ]
    return {
        'public_id': company.public_id,
        'slug': company.slug,
        'canonical_path': company.public_page_path,
        'indexable': company.is_indexable,
        'identity': {
            'display_name': display_name,
            'legal_name': '' if company.company_name == display_name else company.company_name,
            'logo_url': media_url_from_value(company.logo_url, request=request),
            'cover_image_url': media_url_from_value(company.cover_image_url, request=request),
            'website_url': website_url,
            'industries': industries,
        },
        'stats': {
            'active_public_job_count': _active_public_job_count(company),
            'follower_count': company.follower_count,
            'company_size': company.company_size,
            'company_size_display': company.get_company_size_display(),
            'founded_year': company.founded_year,
        },
        'theme': {
            'accent': {'key': DEFAULT_ACCENT_KEY, **ACCENT_PALETTE[DEFAULT_ACCENT_KEY]},
        },
        'sections': _blocks(
            MAIN_SECTIONS,
            {
                'about': _rich_text(company.description),
                'benefits': _rich_text(company.employee_benefits),
                'gallery': _gallery(company, request),
            },
        ),
        'sidebar': _blocks(
            SIDEBAR_SECTIONS,
            {
                'general_info': {'items': _facts(company, industries, website_url)},
                'offices': _offices(company),
            },
        ),
    }


def public_company_job_locations(company):
    """Provinces of the company's publicly available jobs, busiest first."""
    public_jobs = Job.publicly_available_queryset().filter(company_id=company.pk)
    # A workplace is a ward (province = parent) or a legacy province-level link.
    provinces = (
        JobLocation.objects.filter(job__in=public_jobs)
        .values(
            province_id=Coalesce('location__parent_id', 'location_id'),
            province_name=Coalesce('location__parent__name', 'location__name'),
        )
        .annotate(count=Count('job_id', distinct=True))
        .order_by('-count', 'province_name')
    )
    return [
        {'id': row['province_id'], 'name': row['province_name'], 'count': row['count']}
        for row in provinces
    ]


def company_page_policy_hold(company):
    """Current hold, with the reason and actor of the event that applied it."""
    applied = None
    if company.content_policy_hold:
        applied = (
            CompanyPageEvent.objects.filter(
                company=company,
                event_type=CompanyPageEvent.EventType.POLICY_HOLD_APPLIED,
            )
            .select_related('actor')
            .first()
        )
    actor = applied.actor if applied else None
    return {
        'active': company.content_policy_hold,
        'reason': applied.payload.get('reason', '') if applied else '',
        'actor_name': (actor.full_name or actor.email) if actor else '',
        'at': applied.created_at if applied else None,
    }
