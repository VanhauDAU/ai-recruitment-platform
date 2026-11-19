from django.http import HttpResponse
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from ...selectors import (
    campaign_channel_report,
    campaign_health_history,
    daily_applications,
    report_jobs,
)
from ...services import REPORT_CONTENT_TYPES, campaign_health, campaign_report_file
from .channels import CampaignScopedView


@extend_schema(
    tags=['campaigns'],
    summary='Sức khỏe chiến dịch và lịch sử theo ngày',
    responses={200: OpenApiTypes.OBJECT},
)
class CampaignHealthView(CampaignScopedView):
    """Live indicators and forecast, plus the daily snapshots for the trend chart."""

    def get(self, request, public_id):
        campaign = self.campaign()
        return Response(
            {'health': campaign_health(campaign), 'history': campaign_health_history(campaign)}
        )


class ExportThrottle(UserRateThrottle):
    rate = '20/hour'


@extend_schema(
    tags=['campaigns'],
    summary='Tải báo cáo chiến dịch (Excel hoặc PDF)',
    parameters=[OpenApiParameter('type', str, enum=list(REPORT_CONTENT_TYPES))],
    responses={
        (200, content_type): OpenApiTypes.BINARY for content_type in REPORT_CONTENT_TYPES.values()
    },
)
class CampaignReportExportView(CampaignScopedView):
    """Excel or PDF report of the campaign; aggregates only, no candidate data."""

    throttle_classes = [ExportThrottle]

    def get(self, request, public_id):
        # Not `format`: DRF reserves that query parameter for renderer selection.
        file_format = request.query_params.get('type', 'xlsx')
        if file_format not in REPORT_CONTENT_TYPES:
            raise ValidationError({'type': _('Chọn xlsx hoặc pdf.')})
        campaign = self.campaign()
        content, content_type = campaign_report_file(
            campaign,
            file_format,
            channels=campaign_channel_report(campaign),
            daily=daily_applications(campaign),
            jobs=report_jobs(campaign),
        )
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = (
            f'attachment; filename="bao-cao-{campaign.public_id}.{file_format}"'
        )
        response['Cache-Control'] = 'no-store'
        return response
