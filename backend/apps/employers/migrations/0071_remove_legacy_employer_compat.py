"""Drop employer compatibility leftovers once their one-off commands are gone.

- the legacy email OTP channel (``legacy_email`` purpose/dispatch status, the
  plaintext ``PhoneOtp.phone`` column, ``legacy_invalidated`` events);
- ``legacy_auto``/``legacy_unknown`` decision sources, which only the removed
  classification command assigned;
- ``RecruiterProfile.onboarding_completed_at``, unread since onboarding is
  derived from registration, email and a recruitment need;
- nullable ``EmployerVerificationNotification.dedupe_key``: every row is
  written with a key, so the column becomes required.
"""

from django.conf import settings
from django.db import migrations, models


LEGACY_DECISION_SOURCES = ('legacy_auto', 'legacy_unknown')


def drop_legacy_rows(apps, schema_editor):
    phone_otp = apps.get_model('employers', 'PhoneOtp')
    phone_event = apps.get_model('employers', 'EmployerPhoneVerificationEvent')
    case = apps.get_model('employers', 'EmployerVerificationCase')
    notification = apps.get_model('employers', 'EmployerVerificationNotification')
    # Legacy email challenges were all invalidated by 0032; nothing can resume them.
    phone_otp.objects.filter(purpose='legacy_email').delete()
    phone_event.objects.filter(purpose='legacy_email').delete()
    case.objects.filter(decision_source__in=LEGACY_DECISION_SOURCES).update(decision_source='')
    notification.objects.filter(dedupe_key__isnull=True).update(dedupe_key='')


class Migration(migrations.Migration):

    dependencies = [
        ('employers', '0070_move_campaign_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(drop_legacy_rows, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='employerverificationnotification',
            name='uniq_emp_verify_notice_dedupe',
        ),
        migrations.RemoveField(
            model_name='phoneotp',
            name='phone',
        ),
        migrations.RemoveField(
            model_name='recruiterprofile',
            name='onboarding_completed_at',
        ),
        migrations.AlterField(
            model_name='employerphoneverificationevent',
            name='event_type',
            field=models.CharField(choices=[('challenge_created', 'Challenge created'), ('challenge_invalidated', 'Challenge invalidated'), ('dispatch_started', 'Dispatch started'), ('dispatch_sent', 'Dispatch sent'), ('dispatch_retry', 'Dispatch retry scheduled'), ('dispatch_failed', 'Dispatch failed'), ('dispatch_disabled', 'Dispatch disabled'), ('stale_recovered', 'Stale dispatch recovered'), ('verified', 'Phone verified'), ('payload_purged', 'Sensitive payload purged')], max_length=32),
        ),
        migrations.AlterField(
            model_name='employerphoneverificationevent',
            name='purpose',
            field=models.CharField(choices=[('initial_verification', 'Initial verification'), ('phone_change', 'Phone change'), ('reverify', 'Self-service re-verification')], max_length=32),
        ),
        migrations.AlterField(
            model_name='employerverificationcase',
            name='decision_source',
            field=models.CharField(blank=True, choices=[('explicit_admin', 'Quyết định quản trị tường minh')], max_length=24),
        ),
        migrations.AlterField(
            model_name='employerverificationnotification',
            name='dedupe_key',
            field=models.CharField(max_length=160),
        ),
        migrations.AlterField(
            model_name='phoneotp',
            name='dispatch_status',
            field=models.CharField(choices=[('queued', 'Queued'), ('dispatching', 'Dispatching'), ('retry_pending', 'Retry pending'), ('sent', 'Sent'), ('failed', 'Failed'), ('disabled', 'Provider disabled'), ('verified', 'Verified'), ('purged', 'Sensitive payload purged')], default='queued', max_length=24),
        ),
        migrations.AlterField(
            model_name='phoneotp',
            name='purpose',
            field=models.CharField(choices=[('initial_verification', 'Initial verification'), ('phone_change', 'Phone change'), ('reverify', 'Self-service re-verification')], max_length=32),
        ),
        migrations.AddConstraint(
            model_name='employerverificationnotification',
            constraint=models.UniqueConstraint(fields=('recipient', 'dedupe_key'), name='uniq_emp_verify_notice_dedupe'),
        ),
    ]
