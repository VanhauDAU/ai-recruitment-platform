from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction

from apps.accounts.models import AdminAccessAuditLog, User
from apps.accounts.services import is_account_accessible

from ._admin_access import cli_actor_identifier, resolve_actor


class Command(BaseCommand):
    help = 'Bật email MFA cho admin được tạo từ createsuperuser.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--mark-email-verified', action='store_true')
        parser.add_argument('--actor-email')
        parser.add_argument('--no-input', action='store_true')

    def handle(self, *args, **options):
        email = options['email']
        try:
            validate_email(email)
            user = User.objects.get(email__iexact=email, role=User.Role.ADMIN)
        except (ValidationError, User.DoesNotExist) as error:
            raise CommandError(f'Không tìm thấy tài khoản admin hợp lệ: {email}.') from error
        if not is_account_accessible(user):
            raise CommandError('Tài khoản admin đang bị khoá hoặc không còn truy cập được.')

        actor = resolve_actor(options['actor_email'])
        actor_identifier = '' if actor else cli_actor_identifier()
        if not user.email_verified and not options['mark_email_verified']:
            raise CommandError(
                f'Email chưa xác minh. Chạy lại: python manage.py bootstrap_admin_mfa {email} '
                '--mark-email-verified --actor-email <superadmin>'
            )
        if not user.email_verified and options['mark_email_verified'] and not options['no_input']:
            self.stdout.write(
                self.style.WARNING(
                    'Đây là thao tác tin cậy từ CLI, chỉ dùng khi bạn kiểm soát hộp thư này.'
                )
            )
            if input('Tiếp tục? [y/N] ').strip().lower() not in {'y', 'yes'}:
                raise CommandError('Đã huỷ.')

        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user.pk)
            if not user.email_verified:
                user.email_verified = True
                user.save(update_fields=['email_verified', 'updated_at'])
                AdminAccessAuditLog.objects.create(
                    actor=actor,
                    source='management_command' if actor else 'seed',
                    actor_identifier=actor_identifier,
                    action='mark_email_verified',
                    target_type='user',
                    target_public_id=user.public_id,
                    payload={'user_public_id': user.public_id, 'email': user.email},
                )
            user.two_factor_enabled = True
            user.two_factor_email_enabled = True
            user.save(
                update_fields=[
                    'two_factor_enabled',
                    'two_factor_email_enabled',
                    'updated_at',
                ]
            )
            AdminAccessAuditLog.objects.create(
                actor=actor,
                source='management_command' if actor else 'seed',
                actor_identifier=actor_identifier,
                action='bootstrap_mfa',
                target_type='user',
                target_public_id=user.public_id,
                payload={
                    'user_public_id': user.public_id,
                    'email': user.email,
                    'method': 'email',
                },
            )
        self.stdout.write(self.style.SUCCESS(f'Đã bật email MFA cho {user.email}.'))
