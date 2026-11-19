from django.urls import path

from ..views.public import CampaignLandingView

urlpatterns = [
    path('<slug:slug>/', CampaignLandingView.as_view(), name='campaign-landing'),
]
