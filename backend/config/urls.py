from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/candidate/', include('apps.candidates.urls')),
    path('api/employer/', include('apps.employers.urls')),
    path('api/cv-templates/', include('apps.cv_templates.urls')),
    path('api/cvs/', include('apps.cvs.urls')),
    path('api/jobs/', include('apps.jobs.urls')),
    path('api/applications/', include('apps.applications.urls')),
    path('api/locations/', include('apps.locations.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
