from django.urls import path

from apps.privacy.api.views.consent import ConsentView

urlpatterns = [
    path('consent/', ConsentView.as_view(), name='privacy-consent'),
]
