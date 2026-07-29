from django.db import migrations, models
from django.utils import timezone
import django.db.models.deletion


def backfill_job_holds(apps, schema_editor):
    job_model = apps.get_model('jobs', 'Job')
    nonterminal = ['draft', 'pending', 'active']
    held_at = timezone.now()
    job_model.objects.filter(
        posted_by__status='banned',
        status__in=nonterminal,
    ).update(policy_hold='ban_review', policy_held_at=held_at)
    job_model.objects.filter(
        posted_by__status='inactive',
        status__in=nonterminal,
        policy_hold='',
    ).update(policy_hold='legacy_lock', policy_held_at=held_at)


def preserve_job_holds(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0021_account_status_enforcement'),
        ('employers', '0029_campaign_policy_hold'),
        ('jobs', '0031_job_currency_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='policy_hold',
            field=models.CharField(
                blank=True,
                choices=[
                    ('', 'Không giữ'),
                    ('temporary_lock', 'Tạm giữ do khóa tài khoản'),
                    ('ban_review', 'Giữ để rà soát sau cấm'),
                    ('legacy_lock', 'Giữ do trạng thái khóa cũ'),
                ],
                default='',
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='policy_held_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='policy_hold_transition',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='held_jobs',
                to='accounts.accountstatustransition',
            ),
        ),
        migrations.AddIndex(
            model_name='job',
            index=models.Index(
                fields=['policy_hold', 'status'],
                name='jobs_hold_status_idx',
            ),
        ),
        migrations.RunPython(backfill_job_holds, preserve_job_holds),
    ]
