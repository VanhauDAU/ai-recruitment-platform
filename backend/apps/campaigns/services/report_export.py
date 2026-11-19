"""Campaign report files: Excel workbook and a self-contained PDF.

Both hold aggregate figures only (no candidate personal data), so exporting
needs the workspace gate but not candidate-data access.
"""

from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from common.pdf.browser import PdfRenderingError, render_html_pdf

from .health import HEALTH_STATUS_LABELS, campaign_health

STAGE_LABELS = {
    'applied': gettext_lazy('Ứng tuyển'),
    'viewed': gettext_lazy('Đã xem'),
    'shortlisted': gettext_lazy('Phù hợp'),
    'interviewed': gettext_lazy('Phỏng vấn'),
    'accepted': gettext_lazy('Trúng tuyển'),
}
JOB_STATUS = {
    'draft': gettext_lazy('Nháp'),
    'active': gettext_lazy('Đang tuyển'),
    'closed': gettext_lazy('Ngừng tuyển'),
}
REPORT_CONTENT_TYPES = {
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pdf': 'application/pdf',
}


def _period(campaign):
    start = campaign.start_date.strftime('%d/%m/%Y') if campaign.start_date else _('khi kích hoạt')
    if campaign.is_continuous:
        return _('Từ %(start)s, tuyển liên tục') % {'start': start}
    end = campaign.target_date.strftime('%d/%m/%Y') if campaign.target_date else _('chưa đặt')
    return _('Từ %(start)s đến %(end)s') % {'start': start, 'end': end}


def campaign_report_file(campaign, file_format, *, channels, daily, jobs):
    """(content, content_type) of the report; ``file_format`` is ``xlsx`` or ``pdf``.

    ``channels``, ``daily`` and ``jobs`` come from the campaign selectors
    (``campaign_channel_report``, ``daily_applications``, ``report_jobs``).
    """
    report = {
        'campaign': campaign,
        'period': _period(campaign),
        'active_days': round(campaign.active_seconds() / 86400, 1),
        'health': campaign_health(campaign),
        'channels': channels,
        'daily': daily,
        'jobs': jobs,
    }
    if file_format == 'pdf':
        try:
            content = build_pdf(report)
        except PdfRenderingError as error:
            raise ValidationError(
                {'detail': _('Chưa tạo được PDF, hãy thử lại sau ít phút.')}
            ) from error
    else:
        content = build_xlsx(report)
    return content, REPORT_CONTENT_TYPES[file_format]


def _overview_rows(report):
    campaign, health = report['campaign'], report['health']
    budget = health['budget']
    return [
        (_('Chiến dịch'), campaign.name),
        (_('Mã'), campaign.public_id),
        (_('Thời gian'), report['period']),
        (_('Tình trạng'), str(HEALTH_STATUS_LABELS.get(health['status'], ''))),
        (_('Chỉ tiêu (người)'), health['headcount']),
        (_('Đã tuyển (người)'), health['accepted']),
        (_('Dự báo tuyển được (người)'), health['forecast']),
        (_('Hồ sơ cần mỗi ngày để kịp'), health['required_velocity']),
        (_('Tổng hồ sơ'), health['applications']),
        (_('Hồ sơ mỗi ngày (7 ngày gần nhất)'), health['velocity_7d']),
        (_('Thời gian xem hồ sơ (trung vị, giờ)'), health['response']['median_hours_to_view']),
        (_('Hồ sơ được xem trong 48 giờ (%)'), health['response']['viewed_within_48h_percent']),
        (_('Hồ sơ chờ quá 48 giờ'), health['response']['backlog']),
        (_('Đã chi (VNĐ)'), budget['spent']),
        (_('Ngân sách tối đa (VNĐ)'), budget['budget_max']),
        (_('Ngân sách đã dùng (%)'), budget['used_percent']),
        (_('Xuất lúc'), timezone.localtime().strftime('%H:%M %d/%m/%Y')),
    ]


def build_xlsx(report):
    from openpyxl import Workbook
    from openpyxl.styles import Font

    workbook = Workbook()
    bold = Font(bold=True)

    def sheet(title, header, rows, first=False):
        worksheet = workbook.active if first else workbook.create_sheet()
        worksheet.title = title
        if header:
            worksheet.append(header)
            for cell in worksheet[1]:
                cell.font = bold
        for row in rows:
            worksheet.append(['' if value is None else value for value in row])
        for column in worksheet.columns:
            width = max(len(str(cell.value or '')) for cell in column)
            worksheet.column_dimensions[column[0].column_letter].width = min(max(width + 2, 10), 60)

    sheet(_('Tổng quan'), None, _overview_rows(report), first=True)
    sheet(
        _('Phễu'),
        [_('Bước'), _('Số hồ sơ'), _('% so với ứng tuyển')],
        [
            (str(STAGE_LABELS[row['stage']]), row['count'], row['percent_of_applications'])
            for row in report['health']['funnel']
        ],
    )
    sheet(
        _('Nguồn và chi phí'),
        [
            _('Nguồn'),
            _('Người bấm'),
            _('Hồ sơ'),
            _('Tỷ lệ nộp (%)'),
            _('Trúng tuyển'),
            _('Đã chi'),
            _('Chi phí/hồ sơ'),
            _('Chi phí/trúng tuyển'),
        ],
        [
            (
                row['label'],
                row['unique_clicks'],
                row['applications'],
                row['apply_rate'],
                row['hires'],
                row['cost'],
                row['cost_per_application'],
                row['cost_per_hire'],
            )
            for row in report['channels']['rows']
        ],
    )
    sheet(
        _('Theo ngày'),
        [_('Ngày'), _('Hồ sơ')],
        [(row['date'].strftime('%d/%m/%Y'), row['applications']) for row in report['daily']],
    )
    sheet(
        _('Tin tuyển dụng'),
        [_('Tin'), _('Trạng thái'), _('Cần tuyển'), _('Hạn nộp'), _('Hồ sơ'), _('Trúng tuyển')],
        [
            (
                job['title'],
                str(JOB_STATUS.get(job['status'], job['status'])),
                job['number_of_vacancies'],
                job['deadline'].strftime('%d/%m/%Y') if job['deadline'] else '',
                job['current_applications'],
                job['hires'],
            )
            for job in report['jobs']
        ],
    )
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _daily_bars(daily):
    """SVG geometry (viewBox 100 x 60) for the 30-day application bars."""
    peak = max((row['applications'] for row in daily), default=0) or 1
    slot = 100 / max(len(daily), 1)
    bars = []
    for index, row in enumerate(daily):
        height = round(row['applications'] * 52 / peak, 2)
        bars.append(
            {
                'x': round(index * slot + slot * 0.15, 2),
                'y': round(56 - height, 2),
                'width': round(slot * 0.7, 2),
                'height': height,
            }
        )
    return bars


def build_pdf(report):
    html = render_to_string(
        'campaigns/report.html',
        {
            **report,
            'overview': _overview_rows(report),
            'funnel': [
                {**row, 'label': STAGE_LABELS[row['stage']]} for row in report['health']['funnel']
            ],
            'bars': _daily_bars(report['daily']),
            'daily_peak': max((row['applications'] for row in report['daily']), default=0),
            'jobs': [
                {**job, 'status_label': JOB_STATUS.get(job['status'], job['status'])}
                for job in report['jobs']
            ],
        },
    )
    return render_html_pdf(html)
