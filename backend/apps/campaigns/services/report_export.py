"""Campaign report files: Excel workbook and a self-contained PDF.

Both hold aggregate figures only (no candidate personal data), so exporting
needs the workspace gate but not candidate-data access.
"""

from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone

from ..models import CampaignHealthSnapshot

STATUS_LABELS = dict(CampaignHealthSnapshot.Status.choices)
STAGE_LABELS = {
    'applied': 'Ứng tuyển',
    'viewed': 'Đã xem',
    'shortlisted': 'Phù hợp',
    'interviewed': 'Phỏng vấn',
    'accepted': 'Trúng tuyển',
}
JOB_STATUS = {'draft': 'Nháp', 'active': 'Đang tuyển', 'closed': 'Ngừng tuyển'}


def _overview_rows(report):
    campaign, health = report['campaign'], report['health']
    budget = health['budget']
    return [
        ('Chiến dịch', campaign.name),
        ('Mã', campaign.public_id),
        ('Thời gian', report['period']),
        ('Tình trạng', STATUS_LABELS.get(health['status'], '')),
        ('Chỉ tiêu (người)', health['headcount']),
        ('Đã tuyển (người)', health['accepted']),
        ('Dự báo tuyển được (người)', health['forecast']),
        ('Hồ sơ cần mỗi ngày để kịp', health['required_velocity']),
        ('Tổng hồ sơ', health['applications']),
        ('Hồ sơ mỗi ngày (7 ngày gần nhất)', health['velocity_7d']),
        ('Thời gian xem hồ sơ (trung vị, giờ)', health['response']['median_hours_to_view']),
        ('Hồ sơ được xem trong 48 giờ (%)', health['response']['viewed_within_48h_percent']),
        ('Hồ sơ chờ quá 48 giờ', health['response']['backlog']),
        ('Đã chi (VNĐ)', budget['spent']),
        ('Ngân sách tối đa (VNĐ)', budget['budget_max']),
        ('Ngân sách đã dùng (%)', budget['used_percent']),
        ('Xuất lúc', timezone.localtime().strftime('%H:%M %d/%m/%Y')),
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

    sheet('Tổng quan', None, _overview_rows(report), first=True)
    sheet(
        'Phễu',
        ['Bước', 'Số hồ sơ', '% so với ứng tuyển'],
        [
            (STAGE_LABELS[row['stage']], row['count'], row['percent_of_applications'])
            for row in report['health']['funnel']
        ],
    )
    sheet(
        'Nguồn và chi phí',
        [
            'Nguồn',
            'Người bấm',
            'Hồ sơ',
            'Tỷ lệ nộp (%)',
            'Trúng tuyển',
            'Đã chi',
            'Chi phí/hồ sơ',
            'Chi phí/trúng tuyển',
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
        'Theo ngày',
        ['Ngày', 'Hồ sơ'],
        [(row['date'].strftime('%d/%m/%Y'), row['applications']) for row in report['daily']],
    )
    sheet(
        'Tin tuyển dụng',
        ['Tin', 'Trạng thái', 'Cần tuyển', 'Hạn nộp', 'Hồ sơ', 'Trúng tuyển'],
        [
            (
                job['title'],
                JOB_STATUS.get(job['status'], job['status']),
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
    from apps.cvs.services.pdf_renderer import render_html_pdf

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
