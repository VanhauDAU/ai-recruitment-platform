"""Search-visible HTML metadata for the public company page."""

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

from ...selectors import company_sitemap_rows, public_company_website_url, seo_company_by_slug

NO_INDEX = 'noindex, nofollow'


def _metadata(
    request,
    *,
    title,
    description,
    canonical_path,
    indexable,
    image='',
    structured_data=(),
):
    settings = resolved_seo_settings()
    allow_index = indexable and settings['seo_robots_index']
    return SeoMetadata(
        title=f'{title} | {settings["site_name"]}',
        description=description,
        canonical_url=absolute_url(request, canonical_path),
        site_name=settings['site_name'],
        robots='index, follow' if allow_index else NO_INDEX,
        image_url=absolute_url(
            request,
            image or settings['seo_og_image'] or settings['brand_logo_url'],
        ),
        google_site_verification=settings['seo_google_site_verification'],
        structured_data=tuple(structured_data),
    )


def _organization(request, company, canonical_url, description):
    organization = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': company.display_name,
        'url': canonical_url,
    }
    if company.company_name != company.display_name:
        organization['legalName'] = company.company_name
    if company.logo_url:
        organization['logo'] = absolute_url(
            request,
            media_url_from_value(company.logo_url, request=request),
        )
    if description:
        organization['description'] = description
    if company.founded_year:
        organization['foundingDate'] = str(company.founded_year)
    if website_url := public_company_website_url(company):
        organization['sameAs'] = website_url
    # public_headquarters is the only address allowed to leave the portals: it
    # is empty for household businesses, whose address is the owner's home.
    if headquarters := company.public_headquarters:
        organization['address'] = {
            '@type': 'PostalAddress',
            'streetAddress': headquarters,
            'addressCountry': 'VN',
        }
    return organization


def _breadcrumb(request, company, canonical_url):
    trail = (
        ('Trang chủ', absolute_url(request, '/')),
        ('Công ty', absolute_url(request, '/cong-ty')),
        (company.display_name, canonical_url),
    )
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': position, 'name': name, 'item': url}
            for position, (name, url) in enumerate(trail, start=1)
        ],
    }


class CompanySeoShellView(View):
    def get(self, request, slug):
        company = seo_company_by_slug(slug)
        if company is None:
            # Unknown and held pages answer alike: a real 404 that never indexes.
            return render_seo_shell(
                request,
                _metadata(
                    request,
                    title='Công ty không tồn tại',
                    description='Trang công ty không tồn tại hoặc đã ngừng hiển thị.',
                    canonical_path=f'/cong-ty/{slug}',
                    indexable=False,
                ),
                status=404,
            )

        canonical_url = absolute_url(request, company.public_page_path)
        about = truncate_text(rich_text_plain_text(company.description))
        description = about or f'Tìm hiểu {company.display_name} và các việc làm đang tuyển.'
        image = media_url_from_value(
            company.cover_image_url or company.logo_url,
            request=request,
        )
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=f'{company.display_name} tuyển dụng',
                description=description,
                canonical_path=company.public_page_path,
                image=image,
                indexable=company.is_indexable,
                structured_data=(
                    _organization(request, company, canonical_url, about),
                    _breadcrumb(request, company, canonical_url),
                ),
            ),
        )


class CompanySitemapView(View):
    def get(self, request):
        items = (
            {
                'loc': absolute_url(request, f'/cong-ty/{slug}'),
                'lastmod': updated_at.date().isoformat(),
            }
            for slug, updated_at in company_sitemap_rows()
        )
        return xml_response(sitemap_urlset(items))
