import os

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.accounts.services import is_account_accessible
from apps.employers.services import PhoneChallengeError, verify_phone_by_admin


def _resolve_admin(email):
    if not email:
        return None
    try:
        return User.objects.get(email__iexact=email, role=User.Role.ADMIN)
    except User.DoesNotExist as error:
        raise CommandError(f'Không tìm thấy tài khoản admin: {email}.') from error


class Command(BaseCommand):
    help = (
        'Xác minh số điện thoại cho nhà tuyển dụng khi SMS OTP đang tắt, sau khi quản trị '
        'viên đã gọi xác nhận số. Ghi audit; từ chối chạy khi SMS đã bật.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email', help='Email tài khoản nhà tuyển dụng')
        parser.add_argument('--phone', required=True, help='Số di động Việt Nam, ví dụ 0912345678')
        parser.add_argument(
            '--reason',
            required=True,
            help='Cách đã xác nhận, ví dụ "Gọi xác nhận 26/11 với chủ tài khoản"',
        )
        parser.add_argument('--actor-email', help='Email admin chịu trách nhiệm (ghi audit)')
        parser.add_argument('--no-input', action='store_true')

    def handle(self, *args, **options):
        email = options['email']
        try:
            user = User.objects.get(email__iexact=email, role=User.Role.EMPLOYER)
        except User.DoesNotExist as error:
            raise CommandError(f'Không tìm thấy tài khoản nhà tuyển dụng: {email}.') from error
        if not is_account_accessible(user):
            raise CommandError(
                'Tài khoản nhà tuyển dụng đang bị khoá hoặc không còn truy cập được.'
            )

        actor = _resolve_admin(options['actor_email'])
        actor_identifier = '' if actor else f'cli:{os.getenv("USER", "unknown")}'
        if not options['no_input']:
            self.stdout.write(
                self.style.WARNING(
                    'Chỉ dùng khi đã tự gọi xác nhận số này thuộc chủ tài khoản. '
                    'Thao tác được ghi vào nhật ký quản trị.'
                )
            )
            if input('Tiếp tục? [y/N] ').strip().lower() not in {'y', 'yes'}:
                raise CommandError('Đã huỷ.')

        try:
            recruiter = verify_phone_by_admin(
                user=user,
                phone=options['phone'],
                reason=options['reason'],
                actor=actor,
                actor_identifier=actor_identifier,
            )
        except ValidationError as error:
            raise CommandError(' '.join(error.messages)) from error
        except PhoneChallengeError as error:
            raise CommandError(str(error.message)) from error

        self.stdout.write(
            self.style.SUCCESS(
                f'Đã xác minh số ...{recruiter.verified_phone[-3:]} cho {user.email}.'
            )
        )
