from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import AdminPermission


class Command(BaseCommand):
    help = 'Xoá vĩnh viễn permission đã deprecate; thao tác phá huỷ có xác nhận tường minh.'

    def add_arguments(self, parser):
        parser.add_argument('--confirm', action='store_true')
        parser.add_argument('--force', action='store_true')

    def handle(self, *args, **options):
        if not options['confirm']:
            raise CommandError('Bắt buộc truyền --confirm.')
        permissions = list(
            AdminPermission.objects.filter(is_active=False).prefetch_related('roles')
        )
        referenced = {
            permission.code: permission.roles.count()
            for permission in permissions
            if permission.roles.exists()
        }
        if referenced and not options['force']:
            detail = ', '.join(f'{code} ({count} role)' for code, count in referenced.items())
            raise CommandError(
                f'Từ chối xoá permission còn được role tham chiếu: {detail}. Dùng --force nếu đã xác minh.'
            )
        with transaction.atomic():
            deleted, _ = AdminPermission.objects.filter(
                pk__in=[permission.pk for permission in permissions]
            ).delete()
        self.stdout.write(self.style.SUCCESS(f'Đã xoá {deleted} row permission/M2M liên quan.'))
