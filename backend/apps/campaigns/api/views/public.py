"""Public endpoints: tracked-link redirect, landing page data and its SEO shell."""

from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from common.storage.media import media_url_from_value

from ...selectors import landing_state, public_campaign_by_slug


def _landing_payload(request, campaign):
    company = campaign.company
    return {
        'public_id': campaign.public_id,
        'slug': campaign.slug,
        'name': campaign.name,
        'intro': campaign.landing_intro,
        'state': landing_state(campaign),
        'start_date': campaign.start_date,
        'target_date': None if campaign.is_continuous else campaign.target_date,
        'is_continuous': campaign.is_continuous,
        'company': {
            'public_id': company.public_id,
            'name': company.company_name,
            'slug': company.slug,
            'logo_url': media_url_from_value(company.logo_url, request=request),
            'cover_image_url': media_url_from_value(company.cover_image_url, request=request),
        },
    }


class LandingThrottle(AnonRateThrottle):
    rate = '120/min'


@extend_schema(
    tags=['campaigns'],
    summary='Dữ liệu trang landing chiến dịch',
    responses=OpenApiTypes.OBJECT,
)
class CampaignLandingView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LandingThrottle]

    def get(self, request, slug):
        campaign = public_campaign_by_slug(slug)
        if campaign is None:
            raise Http404
        return Response(_landing_payload(request, campaign))
