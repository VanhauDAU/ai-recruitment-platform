from django.urls import path

from ..views.admin import AdminJobApplicationListView

urlpatterns = [
    path(
        'jobs/<str:job_public_id>/applications/',
        AdminJobApplicationListView.as_view(),
        name='admin-job-application-list',
    ),
]
