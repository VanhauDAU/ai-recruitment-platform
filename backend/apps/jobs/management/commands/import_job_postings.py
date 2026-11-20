"""Nhập hàng loạt tin tuyển dụng từ JSON, dùng cho dữ liệu demo và tập đánh giá.

Đầu vào là một mảng JSON các dòng tin, đọc từ tệp hoặc từ stdin (`-`);
`ml/scripts/import_jd.py` tạo nó từ tệp Excel `ml/data/jd/jd_input.xlsx`. Mỗi tin
được tạo rồi đưa lên công khai qua cùng bước kiểm tra với tin đăng thường.
Mặc định chỉ chạy thử rồi hoàn tác; báo cáo JSON in ra stdout. Chạy lại an toàn:
tin đã có (trùng tiêu đề và mô tả) được bỏ qua.
"""

import json
import sys

from django.core.management.base import BaseCommand, CommandError

from ...services import import_job_postings


class Command(BaseCommand):
    help = 'Nhập hàng loạt tin tuyển dụng từ JSON (mặc định chỉ chạy thử).'

    def add_arguments(self, parser):
        parser.add_argument('source', help='Đường dẫn tệp JSON, hoặc "-" để đọc từ stdin.')
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Ghi thay đổi. Mặc định chỉ chạy thử và hoàn tác.',
        )
        parser.add_argument(
            '--create-skills',
            action='store_true',
            help='Khi ghi thật, tạo kỹ năng chưa có trong danh mục thay vì từ chối dòng.',
        )

        parser.add_argument(
            '--refresh-skills',
            action='store_true',
            help='Đồng bộ lại kỹ năng của tin đã có theo dữ liệu nhập (sau khi sửa danh mục).',
        )

    def handle(self, *args, **options):
        try:
            if options['source'] == '-':
                rows = json.load(sys.stdin)
            else:
                with open(options['source'], encoding='utf-8') as source:
                    rows = json.load(source)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f'Không đọc được dữ liệu đầu vào: {error}') from error
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise CommandError('Dữ liệu đầu vào phải là một mảng JSON các dòng tin.')

        report = import_job_postings(
            rows,
            apply=options['apply'],
            create_missing_skills=options['create_skills'],
            refresh_skills=options['refresh_skills'],
        )
        self.stdout.write(json.dumps(report, ensure_ascii=False))
