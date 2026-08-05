from django.urls import path

from .api.views import SpeechSessionView, SpeechVoiceCatalogView

urlpatterns = [
    path('voices/', SpeechVoiceCatalogView.as_view(), name='speech-voice-catalog'),
    path('sessions/', SpeechSessionView.as_view(), name='speech-session'),
]
