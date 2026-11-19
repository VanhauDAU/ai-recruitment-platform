from django.urls import path

from apps.employers.seo.views import CompanySeoShellView, CompanySitemapView

# Included after apps.sitecontent.seo.urls, which owns the static /cong-ty and
# /cong-ty/tim-kiem routes.
urlpatterns = [
    path('sitemaps/companies.xml', CompanySitemapView.as_view(), name='seo-sitemap-companies'),
    path('cong-ty/<slug:slug>', CompanySeoShellView.as_view(), name='seo-company-detail'),
]
