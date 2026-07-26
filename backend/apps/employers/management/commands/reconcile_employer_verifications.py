from django.core.management.base import BaseCommand

from apps.employers.services import reconcile_completed_verification_cases


class Command(BaseCommand):
    help = 'Tự duyệt các hồ sơ xác thực đã đủ điều kiện từ trước khi có cơ chế tự duyệt.'

    def handle(self, *args, **options):
        cases = reconcile_completed_verification_cases()
        self.stdout.write(self.style.SUCCESS(f'Đã đồng bộ {len(cases)} hồ sơ xác thực.'))
