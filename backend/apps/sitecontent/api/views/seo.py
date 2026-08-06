"""Public HTML shell, robots policy, and top-level sitemaps."""

from django.conf import settings as django_settings
from django.http import HttpResponse
from django.views import View

from common.seo import (
    SeoMetadata,
    absolute_url,
    render_seo_shell,
    sitemap_index,
    sitemap_urlset,
    xml_response,
)

from ...services import resolved_seo_settings

STATIC_PAGE_METADATA = {
    '/': (
        '',
        'Tìm việc làm, tạo CV chuyên nghiệp và phát triển sự nghiệp cùng AI.',
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
    '/tuyendung/bao-gia': (
        'Bảng giá dịch vụ tuyển dụng',
        'Tham khảo các lựa chọn dịch vụ tuyển dụng phù hợp với nhu cầu doanh nghiệp.',
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


def _title(label, settings):
    if not label:
        return settings['seo_default_title']
    return f'{label} | {settings["site_name"]}'


def _metadata(request, *, title, description, canonical_path, structured_data=()):
    settings = resolved_seo_settings()
    image = settings['seo_og_image'] or settings['brand_logo_url']
    robots = 'index, follow' if settings['seo_robots_index'] else 'noindex, nofollow'
    return SeoMetadata(
        title=_title(title, settings),
        description=description or settings['seo_default_description'],
        canonical_url=absolute_url(request, canonical_path),
        site_name=settings['site_name'],
        robots=robots,
        image_url=absolute_url(request, image),
        google_site_verification=settings['seo_google_site_verification'],
        structured_data=tuple(structured_data),
    )


class StaticSeoShellView(View):
    def get(self, request):
        path = request.path.rstrip('/') or '/'
        title, description = STATIC_PAGE_METADATA.get(
            path,
            (
                '',
                '',
            ),
        )
        structured_data = ()
        if path == '/':
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
            ),
        )


class RobotsView(View):
    def get(self, request):
        settings = resolved_seo_settings()
        if not settings['seo_robots_index']:
            lines = ['User-agent: *', 'Disallow: /']
        else:
            lines = [
                'User-agent: *',
                'Allow: /',
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
        seo_settings = resolved_seo_settings()
        urls = [
            absolute_url(request, '/sitemaps/static.xml'),
            absolute_url(request, '/sitemaps/jobs.xml'),
            absolute_url(request, '/sitemaps/blog.xml'),
            absolute_url(request, '/sitemaps/cv-templates.xml'),
        ]
        if (
            django_settings.KNOWLEDGEBASE_PUBLIC_ENABLED
            and django_settings.KNOWLEDGEBASE_SEARCH_INDEX_ENABLED
            and seo_settings['seo_robots_index']
        ):
            urls.append(absolute_url(request, '/sitemaps/knowledgebase.xml'))
        return xml_response(sitemap_index(urls))


class StaticSitemapView(View):
    def get(self, request):
        paths = [
            '/',
            '/viec-lam',
            '/blog',
            '/chinh-sach-cookie',
            '/tuyendung',
            '/tuyendung/gioi-thieu',
            '/tuyendung/dich-vu',
            '/tuyendung/bao-gia',
            '/tuyendung/lien-he',
            '/tuyendung/dieu-khoan-dich-vu',
            '/tuyendung/chinh-sach-quyen-rieng',
        ]
        return xml_response(sitemap_urlset({'loc': absolute_url(request, path)} for path in paths))
