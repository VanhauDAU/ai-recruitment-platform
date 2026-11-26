"""Public HTML shell, robots policy, and top-level sitemaps."""

from django.conf import settings as django_settings
from django.http import Http404, HttpResponse, HttpResponsePermanentRedirect
from django.views import View

from apps.sitecontent.models import Banner
from apps.sitecontent.selectors import (
    active_banners,
    get_bool_setting,
    knowledgebase_search_index_enabled,
)
from apps.sitecontent.services import resolved_seo_settings, seo_page_title
from common.portal_paths import employer_marketing_url
from common.seo import (
    SeoMetadata,
    absolute_url,
    render_seo_shell,
    sitemap_index,
    sitemap_urlset,
    xml_response,
)
from common.storage.media import media_url_from_value

STATIC_PAGE_METADATA = {
    # Trang chủ dùng seo_default_title / seo_default_description admin cấu hình.
    '/': ('', ''),
    '/cong-ty': (
        'Danh sách công ty đang tuyển dụng',
        'Khám phá danh sách công ty, tìm hiểu doanh nghiệp và các cơ hội việc làm đang tuyển dụng.',
    ),
    '/chinh-sach-cookie': (
        'Chính sách cookie',
        'Thông tin về cách ProCV sử dụng cookie và bảo vệ lựa chọn riêng tư của bạn.',
    ),
    '/tuyendung': (
        'Giải pháp tuyển dụng',
        'Giải pháp đăng tin, quản lý ứng viên và tuyển dụng hiệu quả dành cho doanh nghiệp.',
    ),
    '/tuyendung/gioi-thieu': (
        'Giới thiệu giải pháp tuyển dụng',
        'Tìm hiểu nền tảng và các giải pháp tuyển dụng dành cho doanh nghiệp trên ProCV.',
    ),
    '/tuyendung/dich-vu': (
        'Dịch vụ tuyển dụng',
        'Các dịch vụ tuyển dụng giúp doanh nghiệp tiếp cận và quản lý ứng viên hiệu quả.',
    ),
    '/tuyendung/lien-he': (
        'Liên hệ tư vấn tuyển dụng',
        'Liên hệ ProCV để được tư vấn giải pháp tuyển dụng phù hợp.',
    ),
    '/tuyendung/dieu-khoan-dich-vu': (
        'Điều khoản dịch vụ tuyển dụng',
        'Điều khoản sử dụng các dịch vụ dành cho nhà tuyển dụng trên ProCV.',
    ),
    '/tuyendung/chinh-sach-quyen-rieng': (
        'Chính sách quyền riêng tư nhà tuyển dụng',
        'Chính sách bảo vệ dữ liệu và quyền riêng tư dành cho nhà tuyển dụng trên ProCV.',
    ),
}


EMPLOYER_MARKETING_PREFIX = '/tuyendung'
# Trang giới thiệu NTD: khóa trong STATIC_PAGE_METADATA bỏ tiền tố /tuyendung.
EMPLOYER_MARKETING_PATHS = tuple(
    key[len(EMPLOYER_MARKETING_PREFIX) :] or '/'
    for key in STATIC_PAGE_METADATA
    if key == EMPLOYER_MARKETING_PREFIX or key.startswith(f'{EMPLOYER_MARKETING_PREFIX}/')
)


def _request_host(request):
    return request.get_host().split(':', 1)[0].lower()


def is_employer_host(request):
    """Request tới subdomain riêng của cổng NTD (EMPLOYER_HOST suy từ EMPLOYER_FRONTEND_URL)."""
    host = django_settings.EMPLOYER_HOST
    return bool(host) and _request_host(request) == host


def is_admin_host(request):
    host = django_settings.ADMIN_HOST
    return bool(host) and _request_host(request) == host


def _title(path, label, settings, *, employer=False):
    if path == '/' and not employer:
        return settings['seo_default_title']
    return seo_page_title(label, settings, employer=employer)


def _home_hero_preload(request):
    """Ảnh của slide đầu carousel trang chủ (LCP trên điện thoại) và media query.

    Khớp HeroSlide.jsx: slide ảnh và slide công ty phủ ảnh toàn khung; slide chữ
    chỉ hiện ảnh từ `md`; slide AI không có ảnh.
    """
    if not get_bool_setting('home_show_banner', default=True):
        return '', ''
    banner = active_banners(Banner.Placement.HOME_HERO).first()
    if banner is None or banner.kind == Banner.Kind.AI:
        return '', ''
    if banner.kind == Banner.Kind.COMPANY:
        value, media = banner.company.cover_image_url, ''
    else:
        media = '' if banner.kind == Banner.Kind.IMAGE else '(min-width: 768px)'
        value = banner.image_url
    url = media_url_from_value(value, request=request) if value else ''
    return (url, media) if url else ('', '')


def _metadata(
    request,
    *,
    title,
    description,
    canonical_path,
    structured_data=(),
    robots=None,
    preload_image=('', ''),
    employer=False,
):
    settings = resolved_seo_settings()
    image = settings['seo_og_image'] or settings['brand_logo_url']
    resolved_robots = robots or (
        'index, follow' if settings['seo_robots_index'] else 'noindex, nofollow'
    )
    return SeoMetadata(
        title=_title(canonical_path, title, settings, employer=employer),
        description=description or settings['seo_default_description'],
        canonical_url=absolute_url(request, canonical_path),
        site_name=settings['site_name'],
        robots=resolved_robots,
        image_url=absolute_url(request, image),
        google_site_verification=settings['seo_google_site_verification'],
        structured_data=tuple(structured_data),
        preload_image_url=preload_image[0],
        preload_image_media=preload_image[1],
    )


class StaticSeoShellView(View):
    def get(self, request):
        path = request.path.rstrip('/') or '/'
        if is_employer_host(request):
            return self._employer_page(request, path)
        if path != '/' and path in EMPLOYER_MARKETING_PATHS:
            raise Http404  # chỉ là route gốc trên subdomain NTD
        if django_settings.EMPLOYER_HOST and path.startswith(EMPLOYER_MARKETING_PREFIX):
            tail = path[len(EMPLOYER_MARKETING_PREFIX) :]
            return HttpResponsePermanentRedirect(employer_marketing_url(tail))
        title, description = STATIC_PAGE_METADATA.get(path, ('', ''))
        employer = path.startswith(EMPLOYER_MARKETING_PREFIX)
        structured_data = ()
        preload_image = ('', '')
        if path == '/':
            preload_image = _home_hero_preload(request)
            settings = resolved_seo_settings()
            root_url = absolute_url(request, '/')
            logo_url = absolute_url(
                request,
                settings['seo_og_image'] or settings['brand_logo_url'],
            )
            structured_data = (
                {
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    'name': settings['site_name'],
                    'url': root_url,
                    'inLanguage': 'vi-VN',
                },
                {
                    '@context': 'https://schema.org',
                    '@type': 'Organization',
                    'name': settings['site_name'],
                    'url': root_url,
                    'logo': logo_url,
                },
            )
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=title,
                description=description,
                canonical_path=path,
                structured_data=structured_data,
                preload_image=preload_image,
                employer=employer,
            ),
        )

    def _employer_page(self, request, path):
        if path not in EMPLOYER_MARKETING_PATHS:
            raise Http404
        key = EMPLOYER_MARKETING_PREFIX + ('' if path == '/' else path)
        title, description = STATIC_PAGE_METADATA[key]
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=title,
                description=description,
                canonical_path=path,
                employer=True,
            ),
        )


class CompanySearchSeoShellView(View):
    """Hydration shell for keyword search pages that must never be indexed."""

    def get(self, request):
        return render_seo_shell(
            request,
            _metadata(
                request,
                title='Tìm kiếm công ty',
                description=(
                    'Tìm kiếm thông tin doanh nghiệp và các cơ hội việc làm đang tuyển dụng.'
                ),
                canonical_path='/cong-ty',
                robots='noindex, nofollow',
            ),
        )


class RobotsView(View):
    def get(self, request):
        settings = resolved_seo_settings()
        if not settings['seo_robots_index'] or is_admin_host(request):
            lines = ['User-agent: *', 'Disallow: /']
        elif is_employer_host(request):
            lines = ['User-agent: *', 'Allow: /', 'Disallow: /app/', 'Disallow: /api/']
        else:
            lines = [
                'User-agent: *',
                'Allow: /',
                'Disallow: /quan-tri/',
                'Disallow: /admin/',
                'Disallow: /api/',
                'Disallow: /cvs/',
                'Disallow: /tai-khoan/',
                'Disallow: /tuyendung/app/',
            ]
        lines.append(f'Sitemap: {absolute_url(request, "/sitemap.xml")}')
        response = HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; charset=utf-8')
        response['Cache-Control'] = 'public, max-age=300'
        return response


class SitemapIndexView(View):
    def get(self, request):
        if is_employer_host(request):
            return xml_response(sitemap_index([absolute_url(request, '/sitemaps/static.xml')]))
        seo_settings = resolved_seo_settings()
        urls = [
            absolute_url(request, '/sitemaps/static.xml'),
            absolute_url(request, '/sitemaps/jobs.xml'),
            absolute_url(request, '/sitemaps/companies.xml'),
            absolute_url(request, '/sitemaps/blog.xml'),
            absolute_url(request, '/sitemaps/cv-templates.xml'),
        ]
        if knowledgebase_search_index_enabled() and seo_settings['seo_robots_index']:
            urls.append(absolute_url(request, '/sitemaps/knowledgebase.xml'))
        return xml_response(sitemap_index(urls))


class StaticSitemapView(View):
    def get(self, request):
        if is_employer_host(request):
            paths = list(EMPLOYER_MARKETING_PATHS)
        else:
            paths = [
                '/',
                '/cong-ty',
                '/viec-lam',
                '/viec-lam-gan-ban',
                '/blog',
                '/chinh-sach-cookie',
            ]
            # Trang giới thiệu NTD trên subdomain riêng nằm trong sitemap của subdomain đó.
            if not django_settings.EMPLOYER_HOST:
                paths += [
                    EMPLOYER_MARKETING_PREFIX + p.rstrip('/') for p in EMPLOYER_MARKETING_PATHS
                ]
        return xml_response(sitemap_urlset({'loc': absolute_url(request, path)} for path in paths))
