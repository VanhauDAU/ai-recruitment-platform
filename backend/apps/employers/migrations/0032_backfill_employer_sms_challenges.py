import uuid

from django.db import migrations
from django.utils import timezone


def _public_id(prefix):
    return f'{prefix}_{uuid.uuid4().hex[:12]}'


def backfill_challenge_ids_and_invalidate_legacy(apps, schema_editor):
    del schema_editor
    phone_otp_model = apps.get_model('employers', 'PhoneOtp')
    event_model = apps.get_model('employers', 'EmployerPhoneVerificationEvent')

    for challenge in phone_otp_model.objects.filter(public_id__isnull=True).iterator():
        challenge.public_id = _public_id('poc')
        challenge.save(update_fields=['public_id'])

    invalidated_at = timezone.now()
    active_legacy = phone_otp_model.objects.filter(
        purpose='legacy_email',
        verified_at__isnull=True,
        invalidated_at__isnull=True,
        expires_at__gt=invalidated_at,
    )
    for challenge in active_legacy.iterator():
        challenge.invalidated_at = invalidated_at
        challenge.invalidation_reason = 'migration_cutover'
        challenge.save(update_fields=['invalidated_at', 'invalidation_reason'])
        event_model.objects.create(
            public_id=_public_id('pve'),
            user_id=challenge.user_id,
            challenge_public_id=challenge.public_id,
            purpose='legacy_email',
            event_type='legacy_invalidated',
            outcome='invalidated',
            reason_code='migration_cutover',
        )


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0031_employer_sms_provider_foundation'),
    ]

    operations = [
        migrations.RunPython(
            backfill_challenge_ids_and_invalidate_legacy,
            migrations.RunPython.noop,
        ),
    ]
