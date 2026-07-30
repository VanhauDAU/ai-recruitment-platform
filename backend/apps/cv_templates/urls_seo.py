from django.urls import path, re_path

from .api.views.seo import CvTemplateSeoShellView, CvTemplateSitemapView

urlpatterns = [
    path(
        'sitemaps/cv-templates.xml',
        CvTemplateSitemapView.as_view(),
        name='seo-sitemap-cv-templates',
    ),
    re_path(
        r'^(?P<catalog_path>mau-cv(?:-tieng-(?:anh|nhat|trung)))'
        r'(?:/chi-tiet/(?P<slug>[^/]+)|/(?P<category_slug>[^/]+))?$',
        CvTemplateSeoShellView.as_view(),
        name='seo-cv-template-localized',
    ),
    re_path(
        r'^mau-cv/ngon-ngu/(?P<locale_code>[^/]+)'
        r'(?:/chi-tiet/(?P<slug>[^/]+)|/(?P<category_slug>[^/]+))?$',
        CvTemplateSeoShellView.as_view(),
        name='seo-cv-template-dynamic-locale',
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
