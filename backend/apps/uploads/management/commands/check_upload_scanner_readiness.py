import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.uploads.services import upload_scanner_readiness


class Command(BaseCommand):
    help = 'Probe upload scanner readiness without exposing endpoint, version or credentials.'

    def add_arguments(self, parser):
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **options):
        if not settings.UPLOAD_QUARANTINE_ENABLED:
            payload = {'ready': False, 'code': 'pipeline_disabled', 'latency_ms': 0}
        else:
            readiness = upload_scanner_readiness()
            payload = {
                'ready': readiness.ready,
                'code': readiness.code,
                'latency_ms': readiness.latency_ms,
            }
        if options['as_json']:
            self.stdout.write(json.dumps(payload, sort_keys=True))
        else:
            self.stdout.write(f'Upload scanner: {payload["code"]} ({payload["latency_ms"]} ms)')
        if not payload['ready']:
            raise CommandError('Upload scanner readiness failed.')
