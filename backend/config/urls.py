from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from config.health import health_check, readiness_check


def portal(*routes):
    """Một cổng API: mỗi phần tử là (tiền tố tài nguyên, module urls/<cổng>.py của app)."""
    return [path(prefix, include(module)) for prefix, module in routes]


# URL API theo cổng (ADR-0022): /api/{auth,public,candidate,employer,admin,shared}/.
# Trong một cổng, include có route bắt-tất-cả (`<slug>/`, `<str:public_id>/`) đứng
# sau include cùng tiền tố có route cố định.
api_portal_patterns = [
    path('auth/', include('apps.accounts.api.urls.auth')),
    path(
        'public/',
        include(
            portal(
                ('jobs/', 'apps.jobs.api.urls.public'),
                ('companies/', 'apps.employers.api.urls.public'),
                ('campaigns/', 'apps.campaigns.api.urls.public'),
                ('cvs/', 'apps.cvs.api.urls.public'),
                ('', 'apps.cv_templates.api.urls.public'),
                ('', 'apps.applications.api.urls.public'),
                ('blog/', 'apps.blog.api.urls.public'),
                ('knowledgebase/', 'apps.knowledgebase.api.urls.public'),
                ('site/', 'apps.sitecontent.api.urls.public'),
                ('locations/', 'apps.locations.api.urls.public'),
                ('skills/', 'apps.skills.api.urls.public'),
                ('privacy/', 'apps.privacy.api.urls.public'),
            )
        ),
    ),
    path(
        'candidate/',
        include(
            portal(
                ('', 'apps.candidates.api.urls.candidate'),
                ('', 'apps.employers.api.urls.candidate'),
                ('', 'apps.applications.api.urls.candidate'),
                ('cvs/', 'apps.cvs.api.urls.candidate'),
                ('jobs/', 'apps.jobs.api.urls.candidate'),
                ('matching/', 'apps.matching.api.urls.candidate'),
                ('', 'apps.messaging.api.urls.candidate'),
            )
        ),
    ),
    path(
        'employer/',
        include(
            portal(
                ('', 'apps.employers.api.urls.employer'),
                ('', 'apps.campaigns.api.urls.employer'),
                ('', 'apps.applications.api.urls.employer'),
                ('jobs/', 'apps.jobs.api.urls.employer'),
                ('dashboard/', 'apps.dashboard.api.urls.employer'),
                ('', 'apps.messaging.api.urls.employer'),
            )
        ),
    ),
    path(
        'admin/',
        include(
            portal(
                ('', 'apps.accounts.api.urls.admin'),
                ('', 'apps.employers.api.urls.admin'),
                ('', 'apps.cvs.api.urls.admin'),
                ('', 'apps.cv_templates.api.urls.admin'),
                ('', 'apps.applications.api.urls.admin'),
                ('jobs/', 'apps.jobs.api.urls.admin'),
                ('ai/', 'apps.jobs.api.urls.admin_ai'),
                ('dashboard/', 'apps.dashboard.api.urls.admin'),
                ('site/', 'apps.sitecontent.api.urls.admin'),
                ('blog/', 'apps.blog.api.urls.admin'),
                ('knowledgebase/', 'apps.knowledgebase.api.urls.admin'),
                ('skills/', 'apps.skills.api.urls.admin'),
                ('privacy/', 'apps.privacy.api.urls.admin'),
            )
        ),
    ),
    path(
        'shared/',
        include(
            portal(
                ('uploads/', 'apps.uploads.api.urls.shared'),
                ('site/', 'apps.sitecontent.api.urls.shared'),
                ('realtime/', 'apps.realtime.api.urls.shared'),
                ('privacy/', 'apps.privacy.api.urls.shared'),
            )
        ),
    ),
]


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
    path('api/health/ready/', readiness_check, name='health-ready'),
    path('api/', include(api_portal_patterns)),
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
