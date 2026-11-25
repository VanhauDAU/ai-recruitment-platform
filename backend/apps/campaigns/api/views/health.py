from django.http import HttpResponse
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from common.api.params import parse_bool

from ...selectors import (
    campaign_channel_report,
    campaign_health_history,
    daily_applications,
    report_jobs,
)
from ...services import (
    REPORT_CONTENT_TYPES,
    campaign_health,
    campaign_report_file,
    campaign_report_pdf_job,
    request_campaign_report_pdf,
)
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
    summary='Tải báo cáo chiến dịch dạng Excel (PDF: xếp hàng qua report/export/pdf/)',
    parameters=[OpenApiParameter('type', str, enum=['xlsx'])],
    responses={(200, REPORT_CONTENT_TYPES['xlsx']): OpenApiTypes.BINARY},
)
class CampaignReportExportView(CampaignScopedView):
    """Excel report of the campaign; aggregates only, no candidate data."""

    throttle_classes = [ExportThrottle]

    def get(self, request, public_id):
        # Not `format`: DRF reserves that query parameter for renderer selection.
        file_format = request.query_params.get('type', 'xlsx')
        if file_format != 'xlsx':
            # Chromium never runs inside a web worker: PDFs are queued.
            raise ValidationError({'type': _('Chọn xlsx; PDF được tạo qua hàng đợi.')})
        campaign = self.campaign()
        content, content_type = campaign_report_file(
            campaign,
            file_format,
            channels=campaign_channel_report(campaign),
            daily=daily_applications(campaign),
            jobs=report_jobs(campaign),
        )
        return _attachment(content, content_type, f'bao-cao-{campaign.public_id}.{file_format}')


def _attachment(content, content_type, filename):
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Cache-Control'] = 'no-store'
    return response


@extend_schema(
    tags=['campaigns'],
    summary='Xếp hàng tạo PDF báo cáo chiến dịch (trả token để hỏi kết quả)',
    request=None,
    responses={202: OpenApiTypes.OBJECT},
)
class CampaignReportPdfView(CampaignScopedView):
    throttle_classes = [ExportThrottle]

    def post(self, request, public_id):
        token = request_campaign_report_pdf(self.campaign())
        return Response({'token': token, 'status': 'pending'}, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    tags=['campaigns'],
    summary='Trạng thái PDF báo cáo chiến dịch; ?download=1 tải tệp khi đã xong',
    parameters=[OpenApiParameter('download', bool)],
    responses={
        (200, 'application/json'): OpenApiTypes.OBJECT,
        (200, REPORT_CONTENT_TYPES['pdf']): OpenApiTypes.BINARY,
    },
)
class CampaignReportPdfResultView(CampaignScopedView):
    def get(self, request, public_id, token):
        campaign = self.campaign()
        job = campaign_report_pdf_job(campaign, token)
        if job is None:
            raise ValidationError({'token': _('Kết quả đã hết hạn, hãy tạo lại báo cáo.')})
        if job['status'] == 'ready' and parse_bool(request.query_params.get('download'), False):
            return _attachment(
                job['pdf'], REPORT_CONTENT_TYPES['pdf'], f'bao-cao-{campaign.public_id}.pdf'
            )
        return Response({'status': job['status']}, headers={'Cache-Control': 'no-store'})
