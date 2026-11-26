"""Xuất góp ý / báo lỗi người dùng để rà soát và sửa.

python manage.py export_feedback                      # góp ý mới, Markdown ra màn hình
python manage.py export_feedback --status all --format csv -o feedback.csv
python manage.py export_feedback --since 2026-11-20 --category bug
python manage.py export_feedback --mark-in-progress   # xuất xong chuyển "Đang xử lý"
"""

import csv
import json
from datetime import datetime, time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.sitecontent.models import Feedback

CSV_FIELDS = [
    'id',
    'created_at',
    'status',
    'category',
    'satisfaction',
    'user',
    'email',
    'phone',
    'page_url',
    'client_info',
    'content',
]


def _client_summary(info):
    """Một dòng ngắn đủ để tái hiện: màn hình, chế độ web app, trình duyệt."""
    if not info:
        return ''
    parts = [
        info.get('viewport') and f'màn {info["viewport"]}',
        info.get('dpr') and f'dpr {info["dpr"]}',
        info.get('standalone') and 'web app',
        info.get('touch') and 'cảm ứng',
        info.get('language'),
        info.get('user_agent'),
    ]
    return ' · '.join(str(part) for part in parts if part)


def _local(value):
    return timezone.localtime(value).strftime('%Y-%m-%d %H:%M')


def _row(feedback):
    return {
        'id': feedback.id,
        'created_at': _local(feedback.created_at),
        'status': feedback.get_status_display(),
        'category': feedback.get_category_display(),
        'satisfaction': feedback.get_satisfaction_display() if feedback.satisfaction else '',
        'user': feedback.user.email if feedback.user else 'Khách',
        'email': feedback.email,
        'phone': feedback.phone,
        'page_url': feedback.page_url,
        'client_info': json.dumps(feedback.client_info, ensure_ascii=False)
        if feedback.client_info
        else '',
        'content': feedback.content,
    }


def _markdown(feedbacks):
    lines = [f'# Góp ý người dùng ({len(feedbacks)})', '']
    by_category = {}
    for feedback in feedbacks:
        by_category.setdefault(feedback.get_category_display(), []).append(feedback)
    for category, items in by_category.items():
        lines += [f'## {category} ({len(items)})', '']
        for feedback in items:
            row = _row(feedback)
            meta = [row['created_at'], row['user'], row['status']]
            if row['satisfaction']:
                meta.append(f'hài lòng: {row["satisfaction"]}')
            lines.append(f'### #{feedback.id} · {" · ".join(meta)}')
            if feedback.page_url:
                lines.append(f'- Trang: `{feedback.page_url}`')
            if summary := _client_summary(feedback.client_info):
                lines.append(f'- Thiết bị: {summary}')
            contact = ', '.join(value for value in (feedback.email, feedback.phone) if value)
            if contact:
                lines.append(f'- Liên hệ: {contact}')
            lines += ['', *(f'> {line}' for line in feedback.content.splitlines()), '']
    return '\n'.join(lines)


class Command(BaseCommand):
    help = 'Xuất góp ý / báo lỗi của người dùng ra Markdown hoặc CSV.'

    def add_arguments(self, parser):
        statuses = [*Feedback.Status.values, 'all']
        parser.add_argument(
            '--status', default=Feedback.Status.NEW, choices=statuses, help='Mặc định: new'
        )
        parser.add_argument('--category', choices=Feedback.Category.values)
        parser.add_argument('--since', help='Từ ngày (YYYY-MM-DD), giờ địa phương')
        parser.add_argument('--format', default='md', choices=['md', 'csv'])
        parser.add_argument('-o', '--output', help='Ghi ra file thay vì màn hình')
        parser.add_argument(
            '--mark-in-progress',
            action='store_true',
            help='Chuyển các góp ý "Mới" vừa xuất sang "Đang xử lý"',
        )

    def handle(self, *args, **options):
        queryset = Feedback.objects.select_related('user').order_by('created_at')
        if options['status'] != 'all':
            queryset = queryset.filter(status=options['status'])
        if options['category']:
            queryset = queryset.filter(category=options['category'])
        if options['since']:
            try:
                day = datetime.strptime(options['since'], '%Y-%m-%d').date()
            except ValueError as error:
                raise CommandError('--since phải có dạng YYYY-MM-DD.') from error
            start = timezone.make_aware(datetime.combine(day, time.min))
            queryset = queryset.filter(created_at__gte=start)
        feedbacks = list(queryset)

        output = (
            open(options['output'], 'w', encoding='utf-8', newline='')  # noqa: SIM115
            if options['output']
            else self.stdout
        )
        try:
            if options['format'] == 'csv':
                writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
                writer.writeheader()
                writer.writerows(_row(feedback) for feedback in feedbacks)
            else:
                output.write(_markdown(feedbacks) + '\n')
        finally:
            if options['output']:
                output.close()

        if options['mark_in_progress']:
            Feedback.objects.filter(
                id__in=[feedback.id for feedback in feedbacks], status=Feedback.Status.NEW
            ).update(status=Feedback.Status.IN_PROGRESS)
        if options['output']:
            self.stderr.write(f'Đã xuất {len(feedbacks)} góp ý ra {options["output"]}')
