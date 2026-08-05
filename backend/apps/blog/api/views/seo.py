"""Search-visible HTML metadata for public blog routes."""

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

from ...selectors.seo import blog_sitemap_rows, seo_category_by_slug, seo_post_by_slug


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
    page_type='website',
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
        page_type=page_type,
        google_site_verification=settings['seo_google_site_verification'],
        structured_data=tuple(structured_data),
    )


def _breadcrumb(request, post, canonical_url):
    items = [
        {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Trang chủ',
            'item': absolute_url(request, '/'),
        },
        {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Cẩm nang nghề nghiệp',
            'item': absolute_url(request, '/blog'),
        },
    ]
    if post.category:
        items.append(
            {
                '@type': 'ListItem',
                'position': 3,
                'name': post.category.name,
                'item': absolute_url(request, f'/blog/danh-muc/{post.category.slug}'),
            }
        )
    items.append(
        {
            '@type': 'ListItem',
            'position': len(items) + 1,
            'name': post.title,
            'item': canonical_url,
        }
    )
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': items,
    }


class BlogHomeSeoShellView(View):
    def get(self, request):
        return render_seo_shell(
            request,
            _metadata(
                request,
                title='Cẩm nang nghề nghiệp',
                description=(
                    'Kiến thức tìm việc, viết CV, phỏng vấn và phát triển sự nghiệp dành cho ứng viên.'
                ),
                canonical_path='/blog',
            ),
        )


class BlogCategorySeoShellView(View):
    def get(self, request, slug):
        category = seo_category_by_slug(slug)
        canonical_path = f'/blog/danh-muc/{slug}'
        if not category:
            return render_seo_shell(
                request,
                _metadata(
                    request,
                    title='Danh mục không tồn tại',
                    description='Danh mục cẩm nang nghề nghiệp không tồn tại.',
                    canonical_path=canonical_path,
                    robots='noindex, nofollow',
                ),
                status=404,
            )
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=category.seo_title or category.name,
                description=category.description,
                canonical_path=f'/blog/danh-muc/{category.slug}',
            ),
        )


class BlogDetailSeoShellView(View):
    def get(self, request, slug):
        post = seo_post_by_slug(slug)
        canonical_path = f'/blog/{slug}'
        if not post:
            return render_seo_shell(
                request,
                _metadata(
                    request,
                    title='Bài viết không tồn tại',
                    description='Bài viết không tồn tại hoặc đã được gỡ.',
                    canonical_path=canonical_path,
                    robots='noindex, nofollow',
                ),
                status=404,
            )

        canonical_path = f'/blog/{post.slug}'
        canonical_url = absolute_url(request, canonical_path)
        image = media_url_from_value(post.thumbnail_url, request=request)
        settings = resolved_seo_settings()
        publisher_logo = absolute_url(
            request,
            settings['seo_og_image'] or settings['brand_logo_url'],
        )
        article = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': post.title,
            'description': post.seo_description or post.summary,
            'datePublished': post.published_at.isoformat(),
            'dateModified': post.updated_at.isoformat(),
            'inLanguage': 'vi-VN',
            'mainEntityOfPage': canonical_url,
            'publisher': {
                '@type': 'Organization',
                'name': settings['site_name'],
                'logo': {'@type': 'ImageObject', 'url': publisher_logo},
            },
        }
        if image:
            article['image'] = absolute_url(request, image)
        description = truncate_text(
            post.seo_description or post.summary or rich_text_plain_text(post.content)
        )
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=post.seo_title or post.title,
                description=description,
                canonical_path=canonical_path,
                image=image,
                page_type='article',
                structured_data=(article, _breadcrumb(request, post, canonical_url)),
            ),
        )


class BlogSitemapView(View):
    def get(self, request):
        posts, categories = blog_sitemap_rows()
        items = [
            {
                'loc': absolute_url(request, f'/blog/{slug}'),
                'lastmod': updated_at.date().isoformat(),
            }
            for slug, updated_at in posts
        ] + [
            {
                'loc': absolute_url(request, f'/blog/danh-muc/{slug}'),
                'lastmod': created_at.date().isoformat(),
            }
            for slug, created_at in categories
        ]
        return xml_response(sitemap_urlset(items))
