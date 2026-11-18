"""Public endpoints: tracked-link redirect, landing page data and its SEO shell."""

from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.views import View
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.sitecontent.services import resolved_seo_settings
from common.media_storage import media_url_from_value
from common.seo import SeoMetadata, absolute_url, render_seo_shell, truncate_text

from ...models import CampaignChannel
from ...selectors import landing_state, public_campaign_by_slug
from ...services import record_click, redirect_target


class TrackedLinkRedirectView(View):
    """``/r/<code>``: count the click, then send the visitor on with a signed ref."""

    def dispatch(self, request, *args, **kwargs):
        if request.method not in ('GET', 'HEAD'):
            raise Http404
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, code):
        channel = get_object_or_404(
            CampaignChannel.objects.select_related('campaign__owner__user', 'job'), code=code
        )
        record_click(request, channel)
        response = HttpResponseRedirect(redirect_target(channel))
        response['Cache-Control'] = 'no-store'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['X-Robots-Tag'] = 'noindex'
        return response

    head = get


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


class CampaignLandingView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LandingThrottle]

    def get(self, request, slug):
        campaign = public_campaign_by_slug(slug)
        if campaign is None:
            raise Http404
        return Response(_landing_payload(request, campaign))


class CampaignLandingSeoShellView(View):
    """Server-rendered head for ``/tuyen-dung/<slug>`` so shared links get a preview."""

    def get(self, request, slug):
        settings = resolved_seo_settings()
        campaign = public_campaign_by_slug(slug)
        canonical = absolute_url(request, f'/tuyen-dung/{slug}')
        if campaign is None:
            metadata = SeoMetadata(
                title=f'Không tìm thấy trang tuyển dụng | {settings["site_name"]}',
                description='Trang tuyển dụng không tồn tại.',
                canonical_url=canonical,
                site_name=settings['site_name'],
                robots='noindex, nofollow',
            )
            return render_seo_shell(request, metadata, status=404)
        state = landing_state(campaign)
        company = campaign.company
        description = truncate_text(
            campaign.landing_intro or f'{company.company_name} đang tuyển dụng: {campaign.name}.'
        )
        image = (
            media_url_from_value(company.cover_image_url, request=request)
            or media_url_from_value(company.logo_url, request=request)
            or settings['seo_og_image']
        )
        metadata = SeoMetadata(
            title=f'{campaign.name} | {company.company_name}',
            description=description,
            canonical_url=canonical,
            site_name=settings['site_name'],
            robots='index, follow'
            if state == 'open' and settings['seo_robots_index']
            else 'noindex',
            image_url=absolute_url(request, image) if image else '',
            structured_data=(
                {
                    '@context': 'https://schema.org',
                    '@type': 'Organization',
                    'name': company.company_name,
                    'url': absolute_url(request, f'/cong-ty/{company.slug}'),
                },
            ),
        )
        return render_seo_shell(request, metadata, status=410 if state == 'ended' else 200)
