"""Dọn tài khoản demo (``@demo.local``) khỏi một database thật.

Các lệnh ``seed_admin_account_demo`` và ``seed_demo_jobs`` tạo tài khoản với mật
khẩu nằm trong repo công khai. Nạp production từ dump của máy dev sẽ mang theo
chúng (kể cả một superuser), nên runbook gọi lệnh này sau mỗi lần khôi phục dump
có nguồn gốc dev. Mặc định chỉ liệt kê; ``--confirm`` mới xóa (cascade như
``seed_demo_jobs --clear``).
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from apps.accounts.models import User

DEMO_EMAIL_SUFFIX = '@demo.local'


class Command(BaseCommand):
    help = 'Liệt kê (mặc định) hoặc xóa (--confirm) mọi tài khoản email @demo.local.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Xóa thật các tài khoản demo cùng dữ liệu phụ thuộc.',
        )

    def handle(self, *args, **options):
        accounts = User.objects.filter(email__iendswith=DEMO_EMAIL_SUFFIX)
        by_role = dict(
            accounts.order_by()
            .values_list('role')
            .annotate(total=Count('id'))
            .values_list('role', 'total')
        )
        if not by_role:
            self.stdout.write(self.style.SUCCESS('Không có tài khoản demo.'))
            return

        summary = ', '.join(f'{role}: {total}' for role, total in sorted(by_role.items()))
        self.stdout.write(f'Tài khoản demo: {summary}.')
        if not options['confirm']:
            self.stdout.write('Chạy lại với --confirm để xóa.')
            return

        with transaction.atomic():
            removed = accounts.delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Đã xóa tài khoản demo ({removed} dòng liên quan).'))
