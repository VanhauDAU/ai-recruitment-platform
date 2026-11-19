"""HTML ngoài /api: link theo dõi ``/r/<code>`` và head SEO của landing chiến dịch."""

from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from django.views import View

from apps.sitecontent.services import resolved_seo_settings, seo_page_title
from common.seo import SeoMetadata, absolute_url, render_seo_shell, truncate_text
from common.storage.media import media_url_from_value

from ..models import CampaignChannel
from ..selectors import landing_state, public_campaign_by_slug
from ..services import record_click, redirect_target


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


class CampaignLandingSeoShellView(View):
    """Server-rendered head for ``/tuyen-dung/<slug>`` so shared links get a preview."""

    def get(self, request, slug):
        settings = resolved_seo_settings()
        campaign = public_campaign_by_slug(slug)
        canonical = absolute_url(request, f'/tuyen-dung/{slug}')
        if campaign is None:
            metadata = SeoMetadata(
                title=seo_page_title(_('Không tìm thấy trang tuyển dụng'), settings),
                description=_('Trang tuyển dụng không tồn tại.'),
                canonical_url=canonical,
                site_name=settings['site_name'],
                robots='noindex, nofollow',
            )
            return render_seo_shell(request, metadata, status=404)
        state = landing_state(campaign)
        company = campaign.company
        description = truncate_text(
            campaign.landing_intro
            or _('%(company)s đang tuyển dụng: %(campaign)s.')
            % {'company': company.company_name, 'campaign': campaign.name}
        )
        image = (
            media_url_from_value(company.cover_image_url, request=request)
            or media_url_from_value(company.logo_url, request=request)
            or settings['seo_og_image']
        )
        metadata = SeoMetadata(
            title=seo_page_title(f'{campaign.name} - {company.company_name}', settings),
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
