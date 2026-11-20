from django.urls import path

from apps.campaigns.seo.views import CampaignLandingSeoShellView, TrackedLinkRedirectView

urlpatterns = [
    path('r/<str:code>', TrackedLinkRedirectView.as_view(), name='campaign-tracked-link'),
    path(
        'r/<str:code>/<slug:destination>',
        TrackedLinkRedirectView.as_view(),
        name='campaign-tracked-link-destination',
    ),
    path(
        'tuyen-dung/<slug:slug>', CampaignLandingSeoShellView.as_view(), name='seo-campaign-landing'
    ),
]
