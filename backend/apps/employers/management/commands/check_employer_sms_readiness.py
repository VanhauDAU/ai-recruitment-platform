from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ...services.sms_provider import sms_configuration_errors


class Command(BaseCommand):
    help = 'Validate employer SMS configuration without sending a message.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--require-enabled',
            action='store_true',
            help='Fail when EMPLOYER_SMS_OTP_ENABLED is false.',
        )

    def handle(self, *args, **options):
        errors = sms_configuration_errors(require_enabled=options['require_enabled'])
        if errors:
            raise CommandError('SMS readiness failed:\n- ' + '\n- '.join(errors))
        if not settings.EMPLOYER_SMS_OTP_ENABLED:
            self.stdout.write(self.style.WARNING('SMS readiness: DISABLED (fail closed).'))
            return
        self.stdout.write(
            self.style.SUCCESS(
                f'SMS readiness: READY ({settings.EMPLOYER_SMS_PROVIDER}, configuration only).'
            )
        )
