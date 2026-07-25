from django.core.management.base import BaseCommand

from apps.accounts.services import sync_permission_catalog

from ._admin_access import cli_actor_identifier, resolve_actor


class Command(BaseCommand):
    help = 'Đồng bộ registry permission vào database; code cũ được deprecate, không bị xoá.'

    def add_arguments(self, parser):
        parser.add_argument('--actor-email')

    def handle(self, *args, **options):
        actor = resolve_actor(options['actor_email'])
        changes = sync_permission_catalog(
            actor=actor,
            source='management_command' if actor else 'seed',
            actor_identifier='' if actor else cli_actor_identifier(),
        )
        for key in ('created', 'updated', 'reactivated'):
            if changes[key]:
                self.stdout.write(f'{key}: {", ".join(changes[key])}')
        if changes['deprecated']:
            self.stdout.write(
                self.style.WARNING(
                    f'deprecated (giữ nguyên liên kết role): {", ".join(changes["deprecated"])}'
                )
            )
        if not any(changes.values()):
            self.stdout.write(
                self.style.SUCCESS('Permission catalog đã đồng bộ, không có thay đổi.')
            )
