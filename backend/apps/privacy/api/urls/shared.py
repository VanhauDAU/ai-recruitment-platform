from django.urls import path

from apps.privacy.api.views.data_requests import (
    OwnDataRequestCancelView,
    OwnDataRequestExportView,
    OwnDataRequestListCreateView,
)

urlpatterns = [
    path('requests/', OwnDataRequestListCreateView.as_view(), name='privacy-requests'),
    path(
        'requests/<str:public_id>/cancel/',
        OwnDataRequestCancelView.as_view(),
        name='privacy-request-cancel',
    ),
    path(
        'requests/<str:public_id>/export/',
        OwnDataRequestExportView.as_view(),
        name='privacy-request-export',
    ),
]
