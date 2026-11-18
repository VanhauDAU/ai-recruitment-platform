from django.urls import path

from .api.views.public import CampaignLandingView

urlpatterns = [
    path('public/<slug:slug>/', CampaignLandingView.as_view(), name='campaign-landing'),
]
