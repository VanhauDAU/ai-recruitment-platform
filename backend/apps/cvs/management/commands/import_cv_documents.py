"""Nhập CV dựng sẵn từ JSON (CV tổng hợp cho thực nghiệm đối sánh CV–JD).

Đầu vào là mảng JSON `[{code, language, data}]`, đọc từ tệp hoặc stdin (`-`);
`ml/scripts/import_cvs.py` tạo nó từ `ml/data/synthetic_cvs/`. Mặc định chỉ chạy
thử rồi hoàn tác; báo cáo JSON in ra stdout. Chạy lại an toàn: CV đã có bị bỏ qua.
"""

import json
import sys

from django.core.management.base import BaseCommand, CommandError

from ...services import import_cv_documents


class Command(BaseCommand):
    help = 'Nhập CV dựng sẵn từ JSON (mặc định chỉ chạy thử).'

    def add_arguments(self, parser):
        parser.add_argument('source', help='Đường dẫn tệp JSON, hoặc "-" để đọc từ stdin.')
        parser.add_argument('--apply', action='store_true', help='Ghi thay đổi.')

    def handle(self, *args, **options):
        try:
            if options['source'] == '-':
                items = json.load(sys.stdin)
            else:
                with open(options['source'], encoding='utf-8') as source:
                    items = json.load(source)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f'Không đọc được dữ liệu đầu vào: {error}') from error
        if not isinstance(items, list):
            raise CommandError('Dữ liệu đầu vào phải là một mảng JSON.')
        report = import_cv_documents(items, apply=options['apply'])
        self.stdout.write(json.dumps(report, ensure_ascii=False))
