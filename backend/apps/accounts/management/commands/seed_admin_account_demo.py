from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.services import record_admin_action

DEMO_PASSWORD = 'AdminDemo123!'
DEMO_ACCOUNTS = (
    {'email': 'admin-root@demo.local', 'name': 'Superuser Demo', 'is_superuser': True},
    {'email': 'moderator-admin@demo.local', 'name': 'Quản trị viên Demo', 'is_superuser': False},
)


class Command(BaseCommand):
    help = 'Tạo một superuser và một admin thường để demo cổng quản trị trên Docker local.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Cho phép chạy ngoài DEBUG (không khuyến nghị). Không có hiệu lực ở production.',
        )

    def handle(self, *args, **options):
        # Mật khẩu demo nằm trong repo công khai: production không bao giờ được tạo.
        if settings.IS_PRODUCTION:
            raise CommandError('Không tạo tài khoản demo trên production.')
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'Seed demo chỉ được chạy khi DEBUG=True. Dùng --force nếu đã hiểu rủi ro.'
            )

        with transaction.atomic():
            for definition in DEMO_ACCOUNTS:
                self._upsert_account(definition)

        self.stdout.write(self.style.SUCCESS('Đã đồng bộ tài khoản quản trị demo.'))
        self.stdout.write(f'Mật khẩu chung: {DEMO_PASSWORD}')
        for definition in DEMO_ACCOUNTS:
            kind = 'Superuser' if definition['is_superuser'] else 'Quản trị viên'
            self.stdout.write(f'- {definition["email"]} | {kind}')

    def _upsert_account(self, definition):
        user, created = User.objects.get_or_create(
            email=definition['email'],
            role=User.Role.ADMIN,
            defaults={'full_name': definition['name']},
        )
        user.full_name = definition['name']
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.is_staff = definition['is_superuser']
        user.is_superuser = definition['is_superuser']
        user.email_verified = True
        user.set_password(DEMO_PASSWORD)
        user.save(
            update_fields=[
                'full_name',
                'status',
                'is_active',
                'is_staff',
                'is_superuser',
                'email_verified',
                'password',
                'updated_at',
            ]
        )
        if created:
            record_admin_action(
                actor=None,
                source='seed',
                actor_identifier='seed_admin_account_demo',
                action='create_admin_demo_user',
                target_type='user',
                target_public_id=user.public_id,
                payload={
                    'user_public_id': user.public_id,
                    'email': user.email,
                    'is_superuser': user.is_superuser,
                },
            )
        return user
