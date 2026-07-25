import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.accounts.constants import ADMIN_PERMISSIONS


class Command(BaseCommand):
    help = 'Xuất contract permission frontend trực tiếp từ registry Python, không cần database.'

    def add_arguments(self, parser):
        default_output = (
            Path(__file__).resolve().parents[5]
            / 'frontend/src/entities/admin-access/model/admin-permissions.generated.json'
        )
        parser.add_argument('--output', default=str(default_output))

    def handle(self, *args, **options):
        output = Path(options['output']).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        payload = [
            {key: item[key] for key in ('code', 'module', 'label')}
            for item in sorted(ADMIN_PERMISSIONS, key=lambda item: item['code'])
        ]
        output.write_text(
            f'{json.dumps(payload, ensure_ascii=False, indent=2)}\n',
            encoding='utf-8',
        )
        self.stdout.write(str(output))
