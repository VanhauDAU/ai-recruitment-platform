"""Search-visible HTML metadata for the public CV template catalogue."""

from django.views import View

from apps.sitecontent.services import resolved_seo_settings
from common.media_storage import media_url_from_value
from common.seo import (
    SeoMetadata,
    absolute_url,
    render_seo_shell,
    sitemap_urlset,
    xml_response,
)

from ...selectors.seo import (
    cv_template_sitemap_rows,
    seo_catalog_context,
    seo_template_by_slug,
)


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
        title=f'{title} | {settings["site_name"]}',
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


def _not_found(request, canonical_path, label='Mẫu CV không tồn tại'):
    return render_seo_shell(
        request,
        _metadata(
            request,
            title=label,
            description='Mẫu CV hoặc danh mục bạn tìm không tồn tại.',
            canonical_path=canonical_path,
            robots='noindex, nofollow',
        ),
        status=404,
    )


def _breadcrumb(request, *, locale, template=None, category=None, canonical_url):
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
            'name': f'Mẫu CV {locale.label_vi.lower()}',
            'item': absolute_url(request, f'/{locale.catalog_path}'),
        },
    ]
    if category:
        items.append(
            {
                '@type': 'ListItem',
                'position': 3,
                'name': category.name,
                'item': canonical_url,
            }
        )
    if template:
        items.append(
            {
                '@type': 'ListItem',
                'position': 3,
                'name': template.catalog_localizations[0].display_name,
                'item': canonical_url,
            }
        )
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': items,
    }


class CvTemplateSeoShellView(View):
    def get(
        self,
        request,
        catalog_path=None,
        locale_code=None,
        category_slug=None,
        slug=None,
        legacy_slug=None,
    ):
        if legacy_slug is not None or request.path.startswith('/cv-templates'):
            catalog_path = 'mau-cv'
            slug = legacy_slug

        locale, category = seo_catalog_context(
            catalog_path=catalog_path,
            locale_code=locale_code,
            category_slug=category_slug,
        )
        requested_path = request.path.rstrip('/') or '/'
        if not locale:
            return _not_found(request, requested_path, 'Ngôn ngữ CV không tồn tại')

        base_path = f'/{locale.catalog_path}'
        if category_slug and not category:
            return _not_found(request, f'{base_path}/{category_slug}', 'Danh mục CV không tồn tại')

        if slug:
            template = seo_template_by_slug(slug, locale.code)
            canonical_path = f'{base_path}/chi-tiet/{slug}'
            if not template:
                return _not_found(request, canonical_path)
            localization = template.catalog_localizations[0]
            canonical_url = absolute_url(request, canonical_path)
            image = media_url_from_value(
                template.preview_url or template.thumbnail_url,
                request=request,
            )
            creative_work = {
                '@context': 'https://schema.org',
                '@type': 'CreativeWork',
                'name': localization.display_name,
                'description': localization.seo_description or localization.description,
                'inLanguage': locale.code,
                'url': canonical_url,
            }
            if image:
                creative_work['image'] = absolute_url(request, image)
            return render_seo_shell(
                request,
                _metadata(
                    request,
                    title=localization.seo_title or f'Mẫu CV {localization.display_name}',
                    description=localization.seo_description or localization.description,
                    canonical_path=canonical_path,
                    image=image,
                    structured_data=(
                        creative_work,
                        _breadcrumb(
                            request,
                            locale=locale,
                            template=template,
                            canonical_url=canonical_url,
                        ),
                    ),
                ),
            )

        canonical_path = f'{base_path}/{category.slug}' if category else base_path
        label = category.name if category else f'Mẫu CV {locale.label_vi.lower()} chuyên nghiệp'
        description = (
            category.description
            if category
            else f'Khám phá mẫu CV {locale.label_vi.lower()} chuyên nghiệp, dễ chỉnh sửa và dùng ngay.'
        )
        canonical_url = absolute_url(request, canonical_path)
        return render_seo_shell(
            request,
            _metadata(
                request,
                title=label,
                description=description,
                canonical_path=canonical_path,
                structured_data=(
                    _breadcrumb(
                        request,
                        locale=locale,
                        category=category,
                        canonical_url=canonical_url,
                    ),
                ),
            ),
        )


class CvTemplateSitemapView(View):
    def get(self, request):
        localizations, locales, categories = cv_template_sitemap_rows()
        items = []
        for locale in locales:
            base_path = f'/{locale.catalog_path}'
            items.append({'loc': absolute_url(request, base_path)})
            items.extend(
                {
                    'loc': absolute_url(request, f'{base_path}/{category.slug}'),
                    'lastmod': category.updated_at.date().isoformat(),
                }
                for category in categories
            )
        items.extend(
            {
                'loc': absolute_url(
                    request,
                    f'/{localization.locale_ref.catalog_path}/chi-tiet/'
                    f'{localization.template.slug}',
                ),
                'lastmod': localization.template.updated_at.date().isoformat(),
            }
            for localization in localizations
        )
        return xml_response(sitemap_urlset(items))
