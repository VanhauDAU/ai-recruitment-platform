from django.urls import path

from .api.views.channels import (
    CampaignChannelContentView,
    CampaignChannelCostDetailView,
    CampaignChannelCostView,
    CampaignChannelDetailView,
    CampaignChannelListView,
    CampaignChannelReportView,
)
from .api.views.launch import CampaignLaunchView

urlpatterns = [
    path(
        'campaigns/<str:public_id>/launch/',
        CampaignLaunchView.as_view(),
        name='employer-campaign-launch',
    ),
    path(
        'campaigns/<str:public_id>/channels/',
        CampaignChannelListView.as_view(),
        name='employer-campaign-channels',
    ),
    path(
        'campaigns/<str:public_id>/channel-report/',
        CampaignChannelReportView.as_view(),
        name='employer-campaign-channel-report',
    ),
    path(
        'campaigns/<str:public_id>/channels/<str:channel_id>/',
        CampaignChannelDetailView.as_view(),
        name='employer-campaign-channel-detail',
    ),
    path(
        'campaigns/<str:public_id>/channels/<str:channel_id>/content/',
        CampaignChannelContentView.as_view(),
        name='employer-campaign-channel-content',
    ),
    path(
        'campaigns/<str:public_id>/channels/<str:channel_id>/costs/',
        CampaignChannelCostView.as_view(),
        name='employer-campaign-channel-costs',
    ),
    path(
        'campaigns/<str:public_id>/channels/<str:channel_id>/costs/<int:cost_id>/',
        CampaignChannelCostDetailView.as_view(),
        name='employer-campaign-channel-cost-detail',
    ),
]
