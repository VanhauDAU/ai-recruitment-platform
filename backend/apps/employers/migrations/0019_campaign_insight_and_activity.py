import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_campaign_activity(apps, schema_editor):
    RecruitmentCampaign = apps.get_model('employers', 'RecruitmentCampaign')
    CampaignActivity = apps.get_model('employers', 'CampaignActivity')
    Job = apps.get_model('jobs', 'Job')
    Application = apps.get_model('applications', 'Application')

    activities = []
    for campaign in RecruitmentCampaign.objects.select_related('owner').iterator():
        latest_at = campaign.updated_at
        latest_job_at = (
            Job.objects.filter(campaign_id=campaign.id)
            .order_by('-updated_at')
            .values_list('updated_at', flat=True)
            .first()
        )
        latest_application_at = (
            Application.objects.filter(job__campaign_id=campaign.id)
            .order_by('-updated_at')
            .values_list('updated_at', flat=True)
            .first()
        )
        latest_at = max(
            value for value in (latest_at, latest_job_at, latest_application_at) if value
        )
        activities.append(
            CampaignActivity(
                campaign_id=campaign.id,
                actor_id=campaign.owner.user_id,
                group='campaign',
                event_type='legacy_synced',
                metadata={'label': 'Dữ liệu được đồng bộ từ lịch sử hiện có.'},
                occurred_at=latest_at,
            )
        )
    CampaignActivity.objects.bulk_create(activities, batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('applications', '0011_allow_limited_reapplications'),
        ('employers', '0018_recruitmentcampaign_company_optional'),
        ('jobs', '0028_remove_jobs_one_job_per_campaign'),
        ('locations', '0002_location_merged_from'),
    ]

    operations = [
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='experience_years',
            field=models.CharField(
                blank=True,
                choices=[
                    ('none', 'Không yêu cầu'),
                    ('under_1', 'Dưới 1 năm'),
                    ('1', '1 năm'),
                    ('2', '2 năm'),
                    ('3', '3 năm'),
                    ('4', '4 năm'),
                    ('5', '5 năm'),
                    ('over_5', 'Trên 5 năm'),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='salary_currency',
            field=models.CharField(default='VND', max_length=10),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='salary_max',
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='salary_min',
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='salary_type',
            field=models.CharField(
                choices=[
                    ('negotiable', 'Thỏa thuận'),
                    ('range', 'Khoảng lương'),
                    ('fixed', 'Mức cố định'),
                    ('from', 'Từ mức'),
                    ('up_to', 'Đến mức'),
                ],
                default='negotiable',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='recruitmentcampaign',
            name='desired_locations',
            field=models.ManyToManyField(
                blank=True,
                related_name='recruitment_campaigns',
                to='locations.location',
            ),
        ),
        migrations.CreateModel(
            name='CampaignActivity',
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
                (
                    'group',
                    models.CharField(
                        choices=[
                            ('campaign', 'Chiến dịch'),
                            ('job', 'Tin tuyển dụng'),
                            ('application', 'Ứng viên'),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    'event_type',
                    models.CharField(
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
                        ],
                        max_length=50,
                    ),
                ),
                ('subject_public_id', models.CharField(blank=True, max_length=50)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('occurred_at', models.DateTimeField()),
                (
                    'actor',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='campaign_activities',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'campaign',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='activities',
                        to='employers.recruitmentcampaign',
                    ),
                ),
            ],
            options={'ordering': ['-occurred_at', '-id']},
        ),
        migrations.AddIndex(
            model_name='campaignactivity',
            index=models.Index(
                fields=['campaign', '-occurred_at'],
                name='emp_camp_activity_time_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='campaignactivity',
            index=models.Index(
                fields=['campaign', 'group', '-occurred_at'],
                name='emp_camp_activity_group_idx',
            ),
        ),
        migrations.RunPython(backfill_campaign_activity, migrations.RunPython.noop),
    ]
