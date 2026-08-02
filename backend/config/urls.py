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
    path('', include('apps.jobs.urls_seo')),
    path('', include('apps.blog.urls_seo')),
    path('', include('apps.cv_templates.urls_seo')),
    path('', include('apps.sitecontent.urls_seo')),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/admin/', include('apps.accounts.urls_admin')),
    path('api/admin/', include('apps.employers.urls_admin')),
    path('api/candidate/', include('apps.candidates.urls')),
    path('api/employer/', include('apps.employers.urls')),
    path('api/v2/cvs/', include('apps.cvs.urls_v2')),
    path('api/v2/', include('apps.cv_templates.urls_v2')),
    path('api/jobs/', include('apps.jobs.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/v2/', include('apps.applications.urls_v2')),
    path('api/locations/', include('apps.locations.urls')),
    path('api/skills/', include('apps.skills.urls')),
    path('api/site/', include('apps.sitecontent.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/blog/', include('apps.blog.urls')),
    path('api/privacy/', include('apps.privacy.urls')),
    path('api/speech/', include('apps.speech.urls')),
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
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
