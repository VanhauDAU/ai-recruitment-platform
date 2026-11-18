from django.urls import path

from ..views import AdminDashboardView, AdminQueueSummaryView

urlpatterns = [
    path('admin/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/queues/', AdminQueueSummaryView.as_view(), name='admin-dashboard-queues'),
]
