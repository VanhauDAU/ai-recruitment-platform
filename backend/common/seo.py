"""Server-rendered SEO head for the client-rendered Vite application."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from functools import lru_cache
from html import escape
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.http import HttpResponse

_DEFAULT_HEAD_PATTERN = re.compile(
    r'\s*<(?:meta|link)\b[^>]*\bdata-seo-default(?:=(?:"[^"]*"|\'[^\']*\'))?[^>]*>\s*'
    r'|\s*<title\b[^>]*\bdata-seo-default(?:=(?:"[^"]*"|\'[^\']*\'))?[^>]*>'
    r'.*?</title>\s*',
    re.IGNORECASE | re.DOTALL,
)
SITEMAP_URL_LIMIT = 50_000


@dataclass(frozen=True, slots=True)
class SeoMetadata:
    title: str
    description: str
    canonical_url: str
    site_name: str = 'ProCV'
    robots: str = 'index, follow'
    image_url: str = ''
    page_type: str = 'website'
    locale: str = 'vi_VN'
    google_site_verification: str = ''
    structured_data: tuple[dict, ...] = ()


def absolute_url(request, value):
    value = str(value or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://')):
        return value
    return request.build_absolute_uri('/' + value.lstrip('/'))


def truncate_text(value, limit=160):
    normalized = ' '.join(str(value or '').split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip(' ,.;:-') + '…'


@lru_cache(maxsize=8)
def _fetch_frontend_shell(url, _cache_bucket):
    request = Request(url, headers={'User-Agent': 'ProCV-SEO-Shell/1.0'})
    try:
        with urlopen(request, timeout=settings.FRONTEND_SHELL_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get_content_charset() or 'utf-8'
            return response.read().decode(content_type)
    except (OSError, UnicodeDecodeError, URLError) as error:
        raise RuntimeError('Frontend shell is unavailable.') from error


def load_frontend_shell():
    inline_shell = getattr(settings, 'FRONTEND_SHELL_HTML', '')
    if inline_shell:
        return inline_shell
    cache_seconds = max(settings.FRONTEND_SHELL_CACHE_SECONDS, 1)
    cache_bucket = int(time.monotonic() // cache_seconds)
    return _fetch_frontend_shell(settings.FRONTEND_SHELL_URL, cache_bucket)


def _json_ld_payload(items):
    if not items:
        return ''
    payload = (
        items[0] if len(items) == 1 else {'@context': 'https://schema.org', '@graph': list(items)}
    )
    serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    return (
        serialized.replace('&', '\\u0026')
        .replace('<', '\\u003c')
        .replace('>', '\\u003e')
        .replace('\u2028', '\\u2028')
        .replace('\u2029', '\\u2029')
    )


def _head_markup(metadata):
    title = escape(metadata.title, quote=True)
    description = escape(truncate_text(metadata.description), quote=True)
    canonical_url = escape(metadata.canonical_url, quote=True)
    site_name = escape(metadata.site_name, quote=True)
    robots = escape(metadata.robots, quote=True)
    image_url = escape(metadata.image_url, quote=True)
    page_type = escape(metadata.page_type, quote=True)
    locale = escape(metadata.locale, quote=True)

    tags = [
        f'<title data-seo-managed="server">{title}</title>',
        f'<meta data-seo-managed="server" name="description" content="{description}">',
        f'<meta data-seo-managed="server" name="robots" content="{robots}">',
        f'<link data-seo-managed="server" rel="canonical" href="{canonical_url}">',
        f'<meta data-seo-managed="server" property="og:site_name" content="{site_name}">',
        f'<meta data-seo-managed="server" property="og:locale" content="{locale}">',
        f'<meta data-seo-managed="server" property="og:type" content="{page_type}">',
        f'<meta data-seo-managed="server" property="og:title" content="{title}">',
        f'<meta data-seo-managed="server" property="og:description" content="{description}">',
        f'<meta data-seo-managed="server" property="og:url" content="{canonical_url}">',
        (
            '<meta data-seo-managed="server" name="twitter:card" '
            f'content="{"summary_large_image" if image_url else "summary"}">'
        ),
        f'<meta data-seo-managed="server" name="twitter:title" content="{title}">',
        f'<meta data-seo-managed="server" name="twitter:description" content="{description}">',
    ]
    if image_url:
        tags.extend(
            [
                f'<meta data-seo-managed="server" property="og:image" content="{image_url}">',
                f'<meta data-seo-managed="server" name="twitter:image" content="{image_url}">',
            ]
        )
    if metadata.google_site_verification:
        verification = escape(metadata.google_site_verification, quote=True)
        tags.append(
            '<meta data-seo-managed="server" name="google-site-verification" '
            f'content="{verification}">'
        )
    if payload := _json_ld_payload(metadata.structured_data):
        tags.append(
            f'<script data-seo-managed="server" type="application/ld+json">{payload}</script>'
        )
    return '\n    '.join(tags)


def render_seo_shell(request, metadata, *, status=200):
    try:
        shell = load_frontend_shell()
    except RuntimeError:
        response = HttpResponse(
            '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
            '<meta name="robots" content="noindex, nofollow">'
            '<title>Tạm thời không khả dụng</title></head><body></body></html>',
            status=503,
            content_type='text/html; charset=utf-8',
        )
        response['Retry-After'] = '30'
        response['X-Robots-Tag'] = 'noindex, nofollow'
        return response

    shell = _DEFAULT_HEAD_PATTERN.sub('\n', shell)
    markup = _head_markup(metadata)
    if '</head>' not in shell.lower():
        return HttpResponse('Invalid frontend shell.', status=503, content_type='text/plain')
    html = re.sub(
        r'</head>',
        lambda _match: f'    {markup}\n  </head>',
        shell,
        count=1,
        flags=re.IGNORECASE,
    )
    html = re.sub(
        r'<html\b([^>]*)\blang=(?:"[^"]*"|\'[^\']*\')([^>]*)>',
        r'<html\1lang="vi"\2>',
        html,
        count=1,
        flags=re.IGNORECASE,
    )
    response = HttpResponse(html, status=status, content_type='text/html; charset=utf-8')
    response['Cache-Control'] = 'public, max-age=0, must-revalidate'
    response['Content-Language'] = 'vi'
    response['Vary'] = 'Host'
    response['X-Robots-Tag'] = metadata.robots
    return response


def xml_response(content, *, cache_seconds=300):
    response = HttpResponse(content, content_type='application/xml; charset=utf-8')
    response['Cache-Control'] = f'public, max-age={cache_seconds}'
    return response


def sitemap_urlset(items):
    rows = []
    for index, item in enumerate(items):
        if index >= SITEMAP_URL_LIMIT:
            break
        location = escape(item['loc'], quote=True)
        last_modified = item.get('lastmod')
        lastmod = f'<lastmod>{escape(str(last_modified))}</lastmod>' if last_modified else ''
        rows.append(f'<url><loc>{location}</loc>{lastmod}</url>')
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(rows) + '</urlset>'
    )


def sitemap_index(urls):
    rows = ''.join(f'<sitemap><loc>{escape(url, quote=True)}</loc></sitemap>' for url in urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f'{rows}</sitemapindex>'
    )
