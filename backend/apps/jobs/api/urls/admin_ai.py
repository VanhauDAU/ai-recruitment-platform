from django.urls import path

from ..views.ai_admin import AdminAiOverviewView

urlpatterns = [
    path('overview/', AdminAiOverviewView.as_view(), name='admin-ai-overview'),
]
