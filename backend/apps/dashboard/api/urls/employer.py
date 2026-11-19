from django.urls import path

from ..views import EmployerDashboardView

urlpatterns = [
    path('', EmployerDashboardView.as_view(), name='employer-dashboard'),
]
