from django.urls import path

from .api.views import PublicCompanyListView

urlpatterns = [
    path('', PublicCompanyListView.as_view(), name='public-company-list'),
]
