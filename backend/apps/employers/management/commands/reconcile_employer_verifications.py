from django.core.management.base import BaseCommand

from apps.employers.services import reconcile_completed_verification_cases


class Command(BaseCommand):
    help = 'Compatibility check; auto-approval is disabled by the explicit final-decision policy.'

    def handle(self, *args, **options):
        cases = reconcile_completed_verification_cases()
        self.stdout.write(
            self.style.SUCCESS(
                f'Không tự duyệt hồ sơ. Số quyết định tự động được tạo: {len(cases)}.'
            )
        )
