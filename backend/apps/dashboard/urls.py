from django.urls import path

from .api.views import AdminDashboardView, EmployerDashboardView

urlpatterns = [
    path('employer/', EmployerDashboardView.as_view(), name='employer-dashboard'),
    path('admin/', AdminDashboardView.as_view(), name='admin-dashboard'),
]
