from django.urls import path

from .api.views import AdminDashboardView, AdminQueueSummaryView, EmployerDashboardView

urlpatterns = [
    path('employer/', EmployerDashboardView.as_view(), name='employer-dashboard'),
    path('admin/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/queues/', AdminQueueSummaryView.as_view(), name='admin-dashboard-queues'),
]
