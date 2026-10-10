from django.urls import path

from .api.views.ai_admin import AdminAiOverviewView

urlpatterns = [
    path('admin/overview/', AdminAiOverviewView.as_view(), name='admin-ai-overview'),
]
