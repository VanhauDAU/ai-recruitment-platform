"""Search-visible HTML metadata for public job routes."""

from django.views import View

from apps.sitecontent.services import resolved_seo_settings
from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text
from common.seo import (
    SeoMetadata,
    absolute_url,
    render_seo_shell,
    sitemap_urlset,
    truncate_text,
    xml_response,
)

from ...models import Job
from ...selectors.seo import job_sitemap_rows, seo_job_by_slug, seo_location_by_slug

EMPLOYMENT_TYPE_SCHEMA = {
    Job.EmploymentType.FULL_TIME: 'FULL_TIME',
    Job.EmploymentType.PART_TIME: 'PART_TIME',
    Job.EmploymentType.CONTRACT: 'CONTRACTOR',
    Job.EmploymentType.SEASONAL: 'TEMPORARY',
    Job.EmploymentType.INTERNSHIP: 'INTERN',
    Job.EmploymentType.FREELANCE: 'CONTRACTOR',
    Job.EmploymentType.WORK_FROM_HOME: 'FULL_TIME',
    Job.EmploymentType.OTHER: 'OTHER',
}


def _title(label, settings):
    return f'{label} | {settings["site_name"]}'


def _metadata(
    request,
    *,
    title,
    description,
    canonical_path,
    image='',
    robots=None,
    structured_data=(),
):
    settings = resolved_seo_settings()
    allow_index = settings['seo_robots_index']
    return SeoMetadata(
        title=_title(title, settings),
        description=description or settings['seo_default_description'],
        canonical_url=absolute_url(request, canonical_path),
        site_name=settings['site_name'],
        robots=robots or ('index, follow' if allow_index else 'noindex, nofollow'),
        image_url=absolute_url(
            request,
            image or settings['seo_og_image'] or settings['brand_logo_url'],
        ),
        google_site_verification=settings['seo_google_site_verification'],
        structured_data=tuple(structured_data),
    )


def _postal_addresses(job):
    addresses = []
    for workplace in job.job_locations.all():
        location = workplace.location
        region = location.parent if location.parent_id else location
        address = {
            '@type': 'PostalAddress',
            'addressCountry': 'VN',
            'addressRegion': region.name,
        }
        if location.parent_id:
            address['addressLocality'] = location.name
        if workplace.address_detail:
            address['streetAddress'] = workplace.address_detail
        addresses.append({'@type': 'Place', 'address': address})
    return addresses


def _salary(job):
    if job.salary_type == Job.SalaryType.NEGOTIABLE:
        return None
    value = {'@type': 'QuantitativeValue', 'unitText': 'MONTH'}
    if job.salary_min is not None and job.salary_max is not None:
        value.update(
            {
                'minValue': float(job.salary_min),
                'maxValue': float(job.salary_max),
            }
        )
    elif job.salary_min is not None:
        value['value'] = float(job.salary_min)
    elif job.salary_max is not None:
        value['value'] = float(job.salary_max)
    else:
        return None
    return {
        '@type': 'MonetaryAmount',
        'currency': job.currency,
        'value': value,
    }


def _job_posting(request, job, canonical_url):
    company = job.company
    organization = {
        '@type': 'Organization',
        'name': company.company_name,
    }
    if company.website_url:
        organization['sameAs'] = company.website_url
    if company.logo_url:
        organization['logo'] = absolute_url(
            request,
            media_url_from_value(company.logo_url, request=request),
        )

    posting = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        'title': job.title,
        'description': rich_text_plain_text(job.description),
        'identifier': {
            '@type': 'PropertyValue',
            'name': company.company_name,
            'value': job.public_id,
        },
        'datePosted': (job.published_at or job.created_at).date().isoformat(),
        'hiringOrganization': organization,
        'employmentType': EMPLOYMENT_TYPE_SCHEMA.get(job.employment_type, 'OTHER'),
        'mainEntityOfPage': canonical_url,
        'url': canonical_url,
    }
    if job.deadline:
        posting['validThrough'] = f'{job.deadline.isoformat()}T23:59:59+07:00'
    if locations := _postal_addresses(job):
        posting['jobLocation'] = locations
    if Job.WorkType.REMOTE in (job.work_types or [job.work_type]):
        posting['jobLocationType'] = 'TELECOMMUTE'
        posting['applicantLocationRequirements'] = {
            '@type': 'Country',
            'name': 'Vietnam',
        }
    if salary := _salary(job):
        posting['baseSalary'] = salary
    return posting


def _breadcrumb(request, job, canonical_url):
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Trang chủ',
                'item': absolute_url(request, '/'),
            },
            {
                '@type': 'ListItem',
                'position': 2,
                'name': 'Việc làm',
                'item': absolute_url(request, '/viec-lam'),
            },
            {
                '@type': 'ListItem',
                'position': 3,
                'name': job.title,
                'item': canonical_url,
            },
        ],
    }


class JobListSeoShellView(View):
    def get(self, request, location_slug=None):
        title = 'Việc làm mới nhất'
        description = (
            'Tìm kiếm việc làm mới nhất, lọc theo ngành nghề, địa điểm và kinh nghiệm trên ProCV.'
        )
        canonical_path = '/viec-lam'
        if location_slug:
            location = seo_location_by_slug(location_slug)
            if not location:
                canonical_path = f'/viec-lam/tai/{location_slug}'
                return render_seo_shell(
                    request,
                    _metadata(
                        request,
                        title='Địa điểm không tồn tại',
                        description='Địa điểm tìm việc không tồn tại hoặc chưa được hỗ trợ.',
                        canonical_path=canonical_path,
                        robots='noindex, nofollow',
                    ),
                    status=404,
                )
            title = f'Việc làm tại {location.name}'
            description = (
                f'Tìm việc làm mới nhất tại {location.name}, cập nhật từ các nhà tuyển dụng.'
            )
            canonical_path = f'/viec-lam/tai/{location.slug}'
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=title,
                description=description,
                canonical_path=canonical_path,
            ),
        )


class JobDetailSeoShellView(View):
    def get(self, request, slug, company_slug=None):
        job = seo_job_by_slug(slug)
        canonical_path = f'/viec-lam/{slug}'
        if not job:
            return render_seo_shell(
                request,
                _metadata(
                    request,
                    title='Việc làm không tồn tại',
                    description='Tin tuyển dụng không tồn tại hoặc đã hết hạn.',
                    canonical_path=canonical_path,
                    robots='noindex, nofollow',
                ),
                status=404,
            )

        canonical_path = f'/viec-lam/{job.slug}'
        canonical_url = absolute_url(request, canonical_path)
        plain_description = rich_text_plain_text(job.description)
        description = truncate_text(
            f'Tuyển {job.title} tại {job.company.company_name}. {plain_description}'
        )
        logo = media_url_from_value(job.company.logo_url, request=request)
        structured_data = (
            _job_posting(request, job, canonical_url),
            _breadcrumb(request, job, canonical_url),
        )
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=f'Tuyển {job.title}',
                description=description,
                canonical_path=canonical_path,
                image=logo,
                structured_data=structured_data,
            ),
        )


class JobSitemapView(View):
    def get(self, request):
        items = (
            {
                'loc': absolute_url(request, f'/viec-lam/{slug}'),
                'lastmod': updated_at.date().isoformat(),
            }
            for slug, updated_at in job_sitemap_rows()
        )
        return xml_response(sitemap_urlset(items))
