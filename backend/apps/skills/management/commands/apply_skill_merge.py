"""Áp bảng gộp kỹ năng (alias và nhóm) vào danh mục kỹ năng.

Đầu vào là JSON đọc từ tệp hoặc từ stdin (`-`), cùng cấu trúc với
`ml/labeling/skill_merge.json`; `ml/scripts/import_jd.py` gọi lệnh này trước khi
nhập tin. Báo cáo JSON in ra stdout. Chạy lại an toàn.
"""

import json
import sys

from django.core.management.base import BaseCommand, CommandError

from ...services import apply_skill_merge


class Command(BaseCommand):
    help = 'Áp bảng gộp kỹ năng (alias và nhóm) vào danh mục.'

    def add_arguments(self, parser):
        parser.add_argument('source', help='Đường dẫn tệp JSON, hoặc "-" để đọc từ stdin.')

    def handle(self, *args, **options):
        try:
            if options['source'] == '-':
                merge = json.load(sys.stdin)
            else:
                with open(options['source'], encoding='utf-8') as source:
                    merge = json.load(source)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f'Không đọc được bảng gộp: {error}') from error
        if not isinstance(merge, dict):
            raise CommandError('Bảng gộp phải là một đối tượng JSON có khóa "aliases" và "groups".')
        self.stdout.write(json.dumps(apply_skill_merge(merge), ensure_ascii=False))
