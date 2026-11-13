from django.urls import path, re_path
from django.views.generic import RedirectView

from .api.views.seo import CvTemplateSeoShellView, CvTemplateSitemapView

urlpatterns = [
    path(
        'sitemaps/cv-templates.xml',
        CvTemplateSitemapView.as_view(),
        name='seo-sitemap-cv-templates',
    ),
    re_path(
        r'^(?P<catalog_path>mau-cv-tieng-anh)'
        r'(?:/chi-tiet/(?P<slug>[^/]+)|/(?P<category_slug>[^/]+))?$',
        CvTemplateSeoShellView.as_view(),
        name='seo-cv-template-localized',
    ),
    # Kho mẫu tiếng Nhật/Trung và route locale động đã gỡ (CVT-0): chuyển
    # vĩnh viễn về kho tiếng Việt, giữ nguyên slug mẫu nếu có.
    re_path(
        r'^(?:mau-cv-tieng-(?:nhat|trung)|mau-cv/ngon-ngu/[^/]+)/chi-tiet/(?P<slug>[^/]+)$',
        RedirectView.as_view(url='/mau-cv/chi-tiet/%(slug)s', permanent=True),
        name='seo-cv-template-removed-locale-detail',
    ),
    re_path(
        r'^(?:mau-cv-tieng-(?:nhat|trung)|mau-cv/ngon-ngu/[^/]+)(?:/[^/]+)?$',
        RedirectView.as_view(url='/mau-cv', permanent=True),
        name='seo-cv-template-removed-locale',
    ),
    re_path(
        r'^mau-cv(?:/chi-tiet/(?P<slug>[^/]+)|/(?P<category_slug>[^/]+))?$',
        CvTemplateSeoShellView.as_view(),
        {'catalog_path': 'mau-cv'},
        name='seo-cv-template',
    ),
    path(
        'cv-templates',
        CvTemplateSeoShellView.as_view(),
        {'catalog_path': 'mau-cv'},
        name='seo-cv-template-legacy-list',
    ),
    path(
        'cv-templates/<slug:legacy_slug>',
        CvTemplateSeoShellView.as_view(),
        name='seo-cv-template-legacy-detail',
    ),
]
