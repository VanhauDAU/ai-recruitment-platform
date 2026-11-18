from django.http import HttpResponse
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from common.pdf.browser import PdfRenderingError

from ...models import CampaignHealthSnapshot
from ...selectors import campaign_channel_report, daily_applications, report_jobs
from ...services import build_pdf, build_xlsx, campaign_health
from .channels import CampaignScopedView

HISTORY_DAYS = 60


class CampaignHealthView(CampaignScopedView):
    """Live indicators and forecast, plus the daily snapshots for the trend chart."""

    def get(self, request, public_id):
        campaign = self.campaign()
        history = CampaignHealthSnapshot.objects.filter(campaign=campaign).order_by('-date')[
            :HISTORY_DAYS
        ]
        return Response(
            {
                'health': campaign_health(campaign),
                'history': [
                    {
                        'date': snapshot.date,
                        'status': snapshot.status,
                        'forecast': snapshot.metrics.get('forecast'),
                        'accepted': snapshot.metrics.get('accepted'),
                        'applications': snapshot.metrics.get('applications'),
                        'headcount': snapshot.metrics.get('headcount'),
                    }
                    for snapshot in reversed(history)
                ],
            }
        )


class ExportThrottle(UserRateThrottle):
    rate = '20/hour'


def _period(campaign):
    start = campaign.start_date.strftime('%d/%m/%Y') if campaign.start_date else 'khi kích hoạt'
    if campaign.is_continuous:
        return f'Từ {start}, tuyển liên tục'
    end = campaign.target_date.strftime('%d/%m/%Y') if campaign.target_date else 'chưa đặt'
    return f'Từ {start} đến {end}'


class CampaignReportExportView(CampaignScopedView):
    """Excel or PDF report of the campaign; aggregates only, no candidate data."""

    throttle_classes = [ExportThrottle]

    def get(self, request, public_id):
        # Not `format`: DRF reserves that query parameter for renderer selection.
        file_format = request.query_params.get('type', 'xlsx')
        if file_format not in {'xlsx', 'pdf'}:
            raise ValidationError({'type': 'Chọn xlsx hoặc pdf.'})
        campaign = self.campaign()
        report = {
            'campaign': campaign,
            'period': _period(campaign),
            'active_days': round(campaign.active_seconds() / 86400, 1),
            'health': campaign_health(campaign),
            'channels': campaign_channel_report(campaign),
            'daily': daily_applications(campaign),
            'jobs': report_jobs(campaign),
        }
        if file_format == 'pdf':
            try:
                content = build_pdf(report)
            except PdfRenderingError as error:
                raise ValidationError(
                    {'detail': 'Chưa tạo được PDF, hãy thử lại sau ít phút.'}
                ) from error
            content_type = 'application/pdf'
        else:
            content = build_xlsx(report)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = (
            f'attachment; filename="bao-cao-{campaign.public_id}.{file_format}"'
        )
        response['Cache-Control'] = 'no-store'
        return response
