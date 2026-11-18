from django.urls import path

from .api.views.launch import CampaignLaunchView

urlpatterns = [
    path(
        'campaigns/<str:public_id>/launch/',
        CampaignLaunchView.as_view(),
        name='employer-campaign-launch',
    ),
]
