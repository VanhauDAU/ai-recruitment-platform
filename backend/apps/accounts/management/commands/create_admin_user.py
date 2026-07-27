import getpass

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

from apps.accounts.models import AdminAccessAuditLog, User

from ._admin_access import cli_actor_identifier, resolve_actor


class Command(BaseCommand):
    help = 'Tạo tài khoản admin thường không bypass RBAC.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--actor-email')

    def handle(self, *args, **options):
        email = User.objects.normalize_email(options['email'])
        try:
            validate_email(email)
        except ValidationError as error:
            raise CommandError('Email không hợp lệ.') from error
        if User.objects.filter(email__iexact=email, role=User.Role.ADMIN).exists():
            raise CommandError('Tài khoản admin với email này đã tồn tại.')

        password = getpass.getpass('Mật khẩu: ')
        confirmation = getpass.getpass('Nhập lại mật khẩu: ')
        if not password or password != confirmation:
            raise CommandError('Mật khẩu xác nhận không khớp.')

        actor = resolve_actor(options['actor_email'])
        actor_identifier = '' if actor else cli_actor_identifier()
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    email,
                    password,
                    role=User.Role.ADMIN,
                    status=User.Status.ACTIVE,
                    is_superuser=False,
                    is_staff=False,
                )
                AdminAccessAuditLog.objects.create(
                    actor=actor,
                    source='management_command' if actor else 'seed',
                    actor_identifier=actor_identifier,
                    action='create_admin_user',
                    target_type='user',
                    target_public_id=user.public_id,
                    payload={'user_public_id': user.public_id, 'email': user.email},
                )
        except IntegrityError as error:
            raise CommandError('Tài khoản admin với email này đã tồn tại.') from error

        self.stdout.write(self.style.SUCCESS(f'Đã tạo admin thường {user.email}.'))
        self.stdout.write(
            'Tùy chọn (khuyến nghị): python manage.py bootstrap_admin_mfa '
            f'{user.email} --mark-email-verified'
        )
