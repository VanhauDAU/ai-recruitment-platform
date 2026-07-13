from django.urls import path

from .api.views import ConsentView

urlpatterns = [
    path('consent/', ConsentView.as_view(), name='privacy-consent'),
]
