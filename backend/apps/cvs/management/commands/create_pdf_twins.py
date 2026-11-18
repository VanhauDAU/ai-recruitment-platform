"""Tạo bản CV tải lên (PDF) cho các CV tổng hợp đã có, để đo trích xuất trên PDF.

    python manage.py create_pdf_twins CV-001 CV-007 --out /tmp/pdf_twins --apply

Mỗi mã được xuất PDF từ CV builder rồi tải lên lại cho cùng tài khoản; tệp PDF
cũng được ghi vào `--out`. Mặc định chỉ chạy thử. Chạy lại an toàn.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from ...services import create_pdf_twins


class Command(BaseCommand):
    help = 'Xuất PDF từ CV tổng hợp và tải lên lại thành CV tải lên (mặc định chạy thử).'

    def add_arguments(self, parser):
        parser.add_argument('codes', nargs='+', help='Mã CV, ví dụ CV-001.')
        parser.add_argument('--out', help='Thư mục ghi các tệp PDF đã xuất.')
        parser.add_argument('--apply', action='store_true', help='Ghi thay đổi.')

    def handle(self, *args, **options):
        report, pdfs = create_pdf_twins(
            [code.upper() for code in options['codes']], apply=options['apply']
        )
        if options['out']:
            out = Path(options['out'])
            out.mkdir(parents=True, exist_ok=True)
            for code, pdf in pdfs.items():
                (out / f'{code}.pdf').write_bytes(pdf)
        self.stdout.write(json.dumps(report, ensure_ascii=False))
