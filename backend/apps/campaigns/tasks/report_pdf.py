"""PDF báo cáo chiến dịch: render Chromium trong worker (queue cv-export)."""

import logging

from celery import shared_task
from django.utils import translation

from ..models import RecruitmentCampaign
from ..selectors import campaign_channel_report, daily_applications, report_jobs
from ..services import (
    campaign_report_file,
    fail_campaign_report_pdf,
    finish_campaign_report_pdf,
)

logger = logging.getLogger(__name__)


@shared_task(name='apps.campaigns.tasks.render_campaign_report_pdf')
def render_campaign_report_pdf(token, campaign_id, language):
    """Render the PDF in the requester's language; the result goes to the cache."""
    campaign = RecruitmentCampaign.objects.filter(pk=campaign_id).first()
    if campaign is None:
        fail_campaign_report_pdf(token, campaign_id)
        return
    try:
        with translation.override(language):
            content, _content_type = campaign_report_file(
                campaign,
                'pdf',
                channels=campaign_channel_report(campaign),
                daily=daily_applications(campaign),
                jobs=report_jobs(campaign),
            )
    except Exception:  # noqa: BLE001 - only a status reaches the employer
        logger.warning('Campaign report PDF for campaign %s failed.', campaign_id, exc_info=True)
        fail_campaign_report_pdf(token, campaign_id)
        return
    finish_campaign_report_pdf(token, campaign_id, content)
