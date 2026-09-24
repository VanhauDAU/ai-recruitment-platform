import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0030_company_update_request_requester_scope'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployerPhoneVerificationEvent',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                (
                    'challenge_public_id',
                    models.CharField(blank=True, db_index=True, max_length=50),
                ),
                (
                    'purpose',
                    models.CharField(
                        choices=[
                            ('legacy_email', 'Legacy email compatibility'),
                            ('initial_verification', 'Initial verification'),
                            ('phone_change', 'Phone change'),
                            ('reverify', 'Self-service re-verification'),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    'event_type',
                    models.CharField(
                        choices=[
                            ('challenge_created', 'Challenge created'),
                            ('challenge_invalidated', 'Challenge invalidated'),
                            ('legacy_invalidated', 'Legacy challenge invalidated'),
                            ('dispatch_started', 'Dispatch started'),
                            ('dispatch_sent', 'Dispatch sent'),
                            ('dispatch_retry', 'Dispatch retry scheduled'),
                            ('dispatch_failed', 'Dispatch failed'),
                            ('dispatch_disabled', 'Dispatch disabled'),
                            ('stale_recovered', 'Stale dispatch recovered'),
                            ('verified', 'Phone verified'),
                            ('payload_purged', 'Sensitive payload purged'),
                        ],
                        max_length=32,
                    ),
                ),
                ('outcome', models.CharField(blank=True, max_length=24)),
                ('reason_code', models.CharField(blank=True, max_length=50)),
                ('occurred_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    'user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='employer_phone_verification_events',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={'ordering': ['-occurred_at', '-pk']},
        ),
        migrations.RemoveConstraint(
            model_name='recruiterprofile',
            name='uniq_recruiter_verified_phone',
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='destination_ciphertext',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='dispatch_attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='dispatch_error_code',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='dispatch_started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='dispatch_status',
            field=models.CharField(
                choices=[
                    ('legacy_email', 'Legacy email compatibility'),
                    ('queued', 'Queued'),
                    ('dispatching', 'Dispatching'),
                    ('retry_pending', 'Retry pending'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                    ('disabled', 'Provider disabled'),
                    ('verified', 'Verified'),
                    ('purged', 'Sensitive payload purged'),
                ],
                default='legacy_email',
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='dispatched_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='invalidated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='invalidation_reason',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='otp_ciphertext',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='phone_fingerprint',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='pii_purged_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='provider_message_id',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='purpose',
            field=models.CharField(
                choices=[
                    ('legacy_email', 'Legacy email compatibility'),
                    ('initial_verification', 'Initial verification'),
                    ('phone_change', 'Phone change'),
                    ('reverify', 'Self-service re-verification'),
                ],
                default='legacy_email',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='secret_purged_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='phoneotp',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='phoneotp',
            name='code_hash',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AlterField(
            model_name='phoneotp',
            name='phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name='recruiterprofile',
            name='verified_phone',
            field=models.CharField(blank=True, default=None, max_length=20, null=True),
        ),
        migrations.AddIndex(
            model_name='phoneotp',
            index=models.Index(
                fields=['dispatch_status', 'dispatch_started_at'],
                name='phone_otp_dispatch_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='phoneotp',
            index=models.Index(
                fields=['created_at', 'pii_purged_at'],
                name='phone_otp_purge_idx',
            ),
        ),
        migrations.AddConstraint(
            model_name='recruiterprofile',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ('verified_phone__isnull', False),
                    models.Q(('verified_phone', ''), _negated=True),
                ),
                fields=('verified_phone',),
                name='uniq_recruiter_verified_phone',
            ),
        ),
        migrations.AddIndex(
            model_name='employerphoneverificationevent',
            index=models.Index(
                fields=['user', '-occurred_at'],
                name='phone_event_user_time_idx',
            ),
        ),
    ]
