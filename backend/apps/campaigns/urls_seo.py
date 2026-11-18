from django.urls import path

from .api.views.public import CampaignLandingSeoShellView, TrackedLinkRedirectView

urlpatterns = [
    path('r/<str:code>', TrackedLinkRedirectView.as_view(), name='campaign-tracked-link'),
    path(
        'tuyen-dung/<slug:slug>', CampaignLandingSeoShellView.as_view(), name='seo-campaign-landing'
    ),
]
