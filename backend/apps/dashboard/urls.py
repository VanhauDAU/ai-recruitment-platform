from django.urls import path

from .api.views import EmployerDashboardView

urlpatterns = [
    path('employer/', EmployerDashboardView.as_view(), name='employer-dashboard'),
]
