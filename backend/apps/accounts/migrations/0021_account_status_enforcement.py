from django.conf import settings
from django.core.management.color import no_style
from django.db import migrations, models
import django.db.models.deletion


STATUS_PERMISSIONS = (
    (
        'account.status.ban',
        'Cấm tài khoản',
        'Cấm tài khoản và giữ tài nguyên liên quan để rà soát trước khi khôi phục.',
    ),
    (
        'account.resource_hold.release',
        'Gỡ giữ tài nguyên tài khoản',
        'Gỡ policy hold sau khi hoàn tất rà soát tài nguyên của tài khoản bị cấm hoặc khóa cũ.',
    ),
)


def seed_status_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    for code, label, description in STATUS_PERMISSIONS:
        permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': 'account',
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
    for statement in schema_editor.connection.ops.sequence_reset_sql(
        no_style(),
        [permission_model],
    ):
        schema_editor.execute(statement)


def keep_status_permissions(apps, schema_editor):
    # Permission configuration may already be referenced by audit records or
    # grants. A rollback must never silently delete it.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0020_account_identity_recovery')]

    operations = [
        migrations.CreateModel(
            name='AccountStatusTransition',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=64, unique=True)),
                (
                    'kind',
                    models.CharField(
                        choices=[
                            ('suspend', 'Temporarily suspend'),
                            ('ban', 'Ban'),
                            ('begin_reactivation', 'Begin reactivation review'),
                            ('reactivate', 'Reactivate'),
                            ('release_resource_holds', 'Release resource holds'),
                        ],
                        max_length=32,
                    ),
                ),
                ('before_status', models.CharField(max_length=50)),
                ('after_status', models.CharField(max_length=50)),
                ('reason', models.TextField()),
                ('enforcement_evidence', models.TextField(blank=True)),
                (
                    'violation_category',
                    models.CharField(
                        blank=True,
                        choices=[
                            ('security', 'Security'),
                            ('fraud', 'Fraud'),
                            ('policy', 'Policy'),
                            ('legal', 'Legal'),
                            ('other', 'Other'),
                        ],
                        max_length=20,
                    ),
                ),
                ('resource_snapshot', models.JSONField(blank=True, default=dict)),
                ('effect_summary', models.JSONField(blank=True, default=dict)),
                (
                    'effect_status',
                    models.CharField(
                        choices=[('applied', 'Applied'), ('failed', 'Failed')],
                        default='applied',
                        max_length=20,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'actor',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='account_status_transitions_performed',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='status_transitions',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='accountstatustransition',
            index=models.Index(
                fields=['user', '-created_at'],
                name='acct_status_user_time_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='accountstatustransition',
            index=models.Index(
                fields=['kind', '-created_at'],
                name='acct_status_kind_time_idx',
            ),
        ),
        migrations.AlterField(
            model_name='authemailjob',
            name='kind',
            field=models.CharField(
                choices=[
                    ('verification', 'Email verification'),
                    ('welcome', 'Welcome email'),
                    ('password_reset', 'Password reset'),
                    ('two_factor', 'Two-factor authentication code'),
                    ('admin_invitation', 'Admin invitation'),
                    ('email_changed_notice', 'Email changed security notice'),
                    ('mfa_reset_notice', 'MFA reset security notice'),
                    ('account_status_notice', 'Account status security notice'),
                ],
                max_length=30,
            ),
        ),
        migrations.RunPython(seed_status_permissions, keep_status_permissions),
    ]
