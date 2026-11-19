from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    # Search-visible HTML shell routes live outside /api by design. Order keeps
    # their explicit public paths ahead of API and Django-admin composition.
    path('', include('apps.jobs.seo.urls')),
    path('', include('apps.blog.seo.urls')),
    path('', include('apps.knowledgebase.seo.urls')),
    path('', include('apps.cv_templates.seo.urls')),
    path('', include('apps.sitecontent.seo.urls')),
    # After sitecontent: /cong-ty and /cong-ty/tim-kiem must keep resolving there.
    path('', include('apps.employers.seo.urls')),
    path('', include('apps.campaigns.seo.urls')),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('apps.accounts.api.urls.auth')),
    path('api/admin/', include('apps.accounts.api.urls.admin')),
    path('api/admin/', include('apps.employers.api.urls.admin')),
    path('api/candidate/', include('apps.candidates.api.urls.candidate')),
    path('api/candidate/', include('apps.employers.api.urls.candidate')),
    path('api/companies/', include('apps.employers.api.urls.public')),
    path('api/employer/', include('apps.employers.api.urls.employer')),
    path('api/employer/', include('apps.campaigns.api.urls.employer')),
    path('api/campaigns/', include('apps.campaigns.api.urls.public')),
    # Public trước: các route cố định (`shares/`, `assets/`) không bị `<str:public_id>/` che.
    path('api/v2/cvs/', include('apps.cvs.api.urls.public')),
    path('api/v2/cvs/', include('apps.cvs.api.urls.candidate')),
    path('api/v2/', include('apps.cvs.api.urls.admin')),
    path('api/v2/', include('apps.cv_templates.api.urls.admin')),
    path('api/v2/', include('apps.cv_templates.api.urls.public')),
    path('api/jobs/', include('apps.jobs.api.urls.admin')),
    path('api/jobs/', include('apps.jobs.api.urls.employer')),
    path('api/jobs/', include('apps.jobs.api.urls.candidate')),
    path('api/jobs/', include('apps.jobs.api.urls.public')),
    path('api/ai/', include('apps.jobs.api.urls.admin_ai')),
    path('api/matching/', include('apps.matching.api.urls.candidate')),
    path('api/dashboard/', include('apps.dashboard.api.urls.admin')),
    path('api/dashboard/', include('apps.dashboard.api.urls.employer')),
    path('api/v2/', include('apps.applications.api.urls.admin')),
    path('api/v2/', include('apps.applications.api.urls.employer')),
    path('api/v2/', include('apps.applications.api.urls.candidate')),
    path('api/v2/', include('apps.applications.api.urls.public')),
    path('api/locations/', include('apps.locations.api.urls.public')),
    path('api/skills/', include('apps.skills.api.urls.public')),
    path('api/site/', include('apps.sitecontent.api.urls.admin')),
    path('api/site/', include('apps.sitecontent.api.urls.shared')),
    path('api/site/', include('apps.sitecontent.api.urls.public')),
    path('api/blog/', include('apps.blog.api.urls.admin')),
    path('api/blog/', include('apps.blog.api.urls.public')),
    path('api/privacy/', include('apps.privacy.api.urls.public')),
    path('api/knowledgebase/', include('apps.knowledgebase.api.urls.admin')),
    path('api/knowledgebase/', include('apps.knowledgebase.api.urls.public')),
    path('api/uploads/', include('apps.uploads.api.urls.shared')),
]

if settings.DJANGO_ADMIN_ENABLED:
    urlpatterns += [path('admin/', admin.site.urls)]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.PUBLIC_MEDIA_ROOT)
