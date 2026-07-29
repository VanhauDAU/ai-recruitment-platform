from django.db import migrations, models
from django.utils import timezone
import django.db.models.deletion


def backfill_campaign_holds(apps, schema_editor):
    campaign_model = apps.get_model('employers', 'RecruitmentCampaign')
    nonterminal = ['draft', 'active', 'paused']
    held_at = timezone.now()
    campaign_model.objects.filter(
        owner__user__status='banned',
        status__in=nonterminal,
    ).update(policy_hold='ban_review', policy_held_at=held_at)
    campaign_model.objects.filter(
        owner__user__status='inactive',
        status__in=nonterminal,
        policy_hold='',
    ).update(policy_hold='legacy_lock', policy_held_at=held_at)


def preserve_campaign_holds(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0021_account_status_enforcement'),
        ('employers', '0028_remove_legacy_tax_lookup_address_columns'),
    ]

    operations = [
        migrations.AddField(
            model_name='recruitmentcampaign',
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
            model_name='recruitmentcampaign',
            name='policy_held_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='policy_hold_transition',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='held_campaigns',
                to='accounts.accountstatustransition',
            ),
        ),
        migrations.AddIndex(
            model_name='recruitmentcampaign',
            index=models.Index(
                fields=['policy_hold', 'status'],
                name='emp_camp_hold_status_idx',
            ),
        ),
        migrations.AlterField(
            model_name='campaignactivity',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('legacy_synced', 'Đồng bộ dữ liệu hiện có'),
                    ('campaign_created', 'Tạo chiến dịch'),
                    ('campaign_updated', 'Cập nhật chiến dịch'),
                    ('campaign_paused', 'Dừng chiến dịch'),
                    ('campaign_resumed', 'Mở lại chiến dịch'),
                    ('job_added', 'Thêm tin tuyển dụng'),
                    ('job_removed', 'Gỡ tin tuyển dụng'),
                    ('job_updated', 'Cập nhật tin tuyển dụng'),
                    ('job_status_changed', 'Đổi trạng thái tin'),
                    ('application_received', 'Nhận CV ứng tuyển'),
                    ('application_status_changed', 'Đổi trạng thái ứng viên'),
                    ('account_policy_held', 'Giữ do trạng thái tài khoản'),
                    ('account_policy_released', 'Gỡ giữ do trạng thái tài khoản'),
                ],
                max_length=50,
            ),
        ),
        migrations.RunPython(backfill_campaign_holds, preserve_campaign_holds),
    ]
