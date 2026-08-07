from django.urls import path

from .api.views import AdminSpeechOverviewView, SpeechSessionView, SpeechVoiceCatalogView

urlpatterns = [
    path('voices/', SpeechVoiceCatalogView.as_view(), name='speech-voice-catalog'),
    path('sessions/', SpeechSessionView.as_view(), name='speech-session'),
    path('admin/overview/', AdminSpeechOverviewView.as_view(), name='speech-admin-overview'),
]
