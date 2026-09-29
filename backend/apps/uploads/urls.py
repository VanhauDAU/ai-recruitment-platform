from django.urls import path

from .api.views import (
    UploadSessionCancelView,
    UploadSessionContentView,
    UploadSessionCreateView,
    UploadSessionDetailView,
    UploadSessionRetryView,
)

app_name = 'uploads'
urlpatterns = [
    path('sessions/', UploadSessionCreateView.as_view(), name='session-create'),
    path(
        'sessions/<str:public_id>/',
        UploadSessionDetailView.as_view(),
        name='session-detail',
    ),
    path(
        'sessions/<str:public_id>/content/',
        UploadSessionContentView.as_view(),
        name='session-content',
    ),
    path(
        'sessions/<str:public_id>/cancel/',
        UploadSessionCancelView.as_view(),
        name='session-cancel',
    ),
    path(
        'sessions/<str:public_id>/retry/',
        UploadSessionRetryView.as_view(),
        name='session-retry',
    ),
]
