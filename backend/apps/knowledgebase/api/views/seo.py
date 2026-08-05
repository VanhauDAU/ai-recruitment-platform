"""Search-engine shell for the client-rendered help center."""

from django.conf import settings
from django.views import View

from apps.sitecontent.services import resolved_seo_settings
from common.seo import SeoMetadata, absolute_url, render_seo_shell, truncate_text

from ...selectors.seo import (
    seo_knowledge_article_by_slugs,
    seo_knowledge_category_by_slug,
)

ROBOTS = 'noindex, nofollow'


def _metadata(
    request,
    *,
    title,
    description,
    canonical_path,
    page_type='website',
    structured_data=(),
):
    site = resolved_seo_settings()
    return SeoMetadata(
        title=f'{title} | {site["site_name"]}',
        description=description or site['seo_default_description'],
        canonical_url=absolute_url(request, canonical_path),
        site_name=site['site_name'],
        robots=ROBOTS,
        image_url=absolute_url(
            request,
            site['seo_og_image'] or site['brand_logo_url'],
        ),
        page_type=page_type,
        google_site_verification=site['seo_google_site_verification'],
        structured_data=tuple(structured_data),
    )


def _not_found(request, canonical_path, label='Nội dung trợ giúp không tồn tại'):
    return render_seo_shell(
        request,
        _metadata(
            request,
            title=label,
            description='Nội dung không tồn tại hoặc hiện chưa được công khai.',
            canonical_path=canonical_path,
        ),
        status=404,
    )


def _breadcrumb(request, article, canonical_url):
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
                'name': 'Trung tâm trợ giúp',
                'item': absolute_url(request, '/tro-giup'),
            },
            {
                '@type': 'ListItem',
                'position': 3,
                'name': article.category.name,
                'item': absolute_url(request, f'/tro-giup/{article.category.slug}'),
            },
            {
                '@type': 'ListItem',
                'position': 4,
                'name': article.published_revision.title,
                'item': canonical_url,
            },
        ],
    }


class KnowledgeHomeSeoShellView(View):
    def get(self, request):
        if not settings.KNOWLEDGEBASE_PUBLIC_ENABLED:
            return _not_found(request, '/tro-giup')
        return render_seo_shell(
            request,
            _metadata(
                request,
                title='Trung tâm trợ giúp',
                description=('Câu hỏi thường gặp và hướng dẫn sử dụng ProCV dành cho ứng viên.'),
                canonical_path='/tro-giup',
            ),
        )


class KnowledgeCategorySeoShellView(View):
    def get(self, request, category_slug):
        canonical_path = f'/tro-giup/{category_slug}'
        if not settings.KNOWLEDGEBASE_PUBLIC_ENABLED:
            return _not_found(request, canonical_path)
        category = seo_knowledge_category_by_slug(category_slug)
        if not category:
            return _not_found(request, canonical_path, 'Chuyên mục trợ giúp không tồn tại')
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=category.seo_title or category.name,
                description=category.seo_description or category.description,
                canonical_path=f'/tro-giup/{category.slug}',
            ),
        )


class KnowledgeDetailSeoShellView(View):
    def get(self, request, category_slug, article_slug):
        canonical_path = f'/tro-giup/{category_slug}/{article_slug}'
        if not settings.KNOWLEDGEBASE_PUBLIC_ENABLED:
            return _not_found(request, canonical_path)
        article = seo_knowledge_article_by_slugs(category_slug, article_slug)
        if not article:
            return _not_found(request, canonical_path)

        revision = article.published_revision
        canonical_path = f'/tro-giup/{article.category.slug}/{article.slug}'
        canonical_url = absolute_url(request, canonical_path)
        site = resolved_seo_settings()
        description = truncate_text(revision.seo_description or revision.body_plain_text)
        structured_article = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': revision.title,
            'description': description,
            'datePublished': article.first_published_at.isoformat(),
            'dateModified': revision.updated_at.isoformat(),
            'inLanguage': 'vi-VN',
            'mainEntityOfPage': canonical_url,
            'publisher': {
                '@type': 'Organization',
                'name': site['site_name'],
            },
        }
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=revision.seo_title or revision.title,
                description=description,
                canonical_path=canonical_path,
                page_type='article',
                structured_data=(
                    structured_article,
                    _breadcrumb(request, article, canonical_url),
                ),
            ),
        )
