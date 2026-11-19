from django.urls import path

from ..views import AdminDashboardView, AdminQueueSummaryView

urlpatterns = [
    path('', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('queues/', AdminQueueSummaryView.as_view(), name='admin-dashboard-queues'),
]
