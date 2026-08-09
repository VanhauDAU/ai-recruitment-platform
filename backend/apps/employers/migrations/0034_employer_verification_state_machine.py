import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('employers', '0033_finalize_employer_sms_challenge_id'),
        ('jobs', '0034_job_approved_snapshot_job_approved_snapshot_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='verification_source',
            field=models.CharField(
                blank=True,
                choices=[
                    ('explicit_admin', 'Quyết định quản trị tường minh'),
                    ('legacy_auto', 'Tự duyệt lịch sử'),
                    ('legacy_unknown', 'Không xác định nguồn lịch sử'),
                ],
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name='employerverificationcase',
            name='decision_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='employerverificationcase',
            name='decision_source',
            field=models.CharField(
                blank=True,
                choices=[
                    ('explicit_admin', 'Quyết định quản trị tường minh'),
                    ('legacy_auto', 'Tự duyệt lịch sử'),
                    ('legacy_unknown', 'Không xác định nguồn lịch sử'),
                ],
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name='employerverificationcase',
            name='tax_override_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='employerverificationcase',
            name='tax_override_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='employerverificationcase',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Chưa nộp'),
                    ('pending', 'Chờ duyệt'),
                    ('in_review', 'Đang xử lý'),
                    ('changes_requested', 'Cần bổ sung'),
                    ('rejected', 'Bị từ chối'),
                    ('approved', 'Đã xác thực'),
                    ('revoked', 'Đã thu hồi'),
                    ('expired', 'Hết hiệu lực'),
                ],
                default='draft',
                max_length=24,
            ),
        ),
        migrations.AlterField(
            model_name='employerverificationevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('submitted', 'Đã nộp'),
                    ('review_started', 'Bắt đầu xử lý'),
                    ('document_reviewed', 'Đã xử lý giấy tờ'),
                    ('changes_requested', 'Yêu cầu bổ sung'),
                    ('resubmitted', 'Đã nộp lại'),
                    ('approved', 'Đã duyệt'),
                    ('rejected', 'Đã từ chối'),
                    ('revoked', 'Đã thu hồi'),
                    ('expired', 'Hết hiệu lực'),
                    ('reapproved', 'Đã duyệt lại'),
                    ('hold_applied', 'Đã áp dụng compliance hold'),
                    ('hold_released', 'Đã gỡ compliance hold'),
                    ('sensitive_viewed', 'Đã xem dữ liệu nhạy cảm'),
                    ('tax_lookup_refreshed', 'Đã tra cứu lại mã số thuế'),
                ],
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name='EmployerComplianceHold',
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
                    'source',
                    models.CharField(
                        choices=[
                            ('verification', 'Xác thực nhà tuyển dụng'),
                            ('dpa', 'Thỏa thuận xử lý dữ liệu'),
                        ],
                        max_length=24,
                    ),
                ),
                (
                    'reason',
                    models.CharField(
                        choices=[
                            ('verification_revoked', 'Xác thực bị thu hồi'),
                            ('verification_expired', 'Xác thực hết hiệu lực'),
                            ('dpa_outdated', 'DPA không còn hiện hành'),
                            ('dpa_hold', 'DPA quá hạn'),
                        ],
                        max_length=40,
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[('active', 'Đang áp dụng'), ('released', 'Đã gỡ')],
                        default='active',
                        max_length=16,
                    ),
                ),
                ('release_reason', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('applied_at', models.DateTimeField(auto_now_add=True)),
                ('released_at', models.DateTimeField(blank=True, null=True)),
                (
                    'applied_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'recruiter',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='compliance_holds',
                        to='employers.recruiterprofile',
                    ),
                ),
                (
                    'released_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'verification_case',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='compliance_holds',
                        to='employers.employerverificationcase',
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='EmployerComplianceHoldCampaign',
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
                ('linked_at', models.DateTimeField(auto_now_add=True)),
                (
                    'campaign',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='compliance_hold_links',
                        to='employers.recruitmentcampaign',
                    ),
                ),
                (
                    'hold',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='campaign_links',
                        to='employers.employercompliancehold',
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='EmployerComplianceHoldJob',
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
                ('linked_at', models.DateTimeField(auto_now_add=True)),
                (
                    'hold',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='job_links',
                        to='employers.employercompliancehold',
                    ),
                ),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='compliance_hold_links',
                        to='jobs.job',
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name='employercompliancehold',
            index=models.Index(
                fields=['recruiter', 'status', 'source'],
                name='emp_hold_recruiter_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='employercompliancehold',
            index=models.Index(
                fields=['status', 'source', 'reason'],
                name='emp_hold_source_idx',
            ),
        ),
        migrations.AddConstraint(
            model_name='employercompliancehold',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'active')),
                fields=('recruiter', 'source'),
                name='uniq_active_recruiter_hold_src',
            ),
        ),
        migrations.AddConstraint(
            model_name='employercompliancehold',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        ('release_reason', ''),
                        ('released_at__isnull', True),
                        ('released_by__isnull', True),
                        ('status', 'active'),
                    )
                    | (
                        models.Q(
                            ('released_at__isnull', False),
                            ('released_by__isnull', False),
                            ('status', 'released'),
                        )
                        & ~models.Q(('release_reason', ''))
                    )
                ),
                name='emp_hold_release_state_consistent',
            ),
        ),
        migrations.AddConstraint(
            model_name='employercompliancehold',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        ('reason__in', ['verification_revoked', 'verification_expired']),
                        ('source', 'verification'),
                        ('verification_case__isnull', False),
                    )
                    | models.Q(
                        ('reason__in', ['dpa_outdated', 'dpa_hold']),
                        ('source', 'dpa'),
                        ('verification_case__isnull', True),
                    )
                ),
                name='emp_hold_source_reason_valid',
            ),
        ),
        migrations.AddIndex(
            model_name='employercomplianceholdcampaign',
            index=models.Index(fields=['campaign', 'hold'], name='emp_hold_campaign_idx'),
        ),
        migrations.AddConstraint(
            model_name='employercomplianceholdcampaign',
            constraint=models.UniqueConstraint(
                fields=('hold', 'campaign'),
                name='uniq_compliance_hold_campaign',
            ),
        ),
        migrations.AddIndex(
            model_name='employercomplianceholdjob',
            index=models.Index(fields=['job', 'hold'], name='emp_hold_job_idx'),
        ),
        migrations.AddConstraint(
            model_name='employercomplianceholdjob',
            constraint=models.UniqueConstraint(
                fields=('hold', 'job'),
                name='uniq_compliance_hold_job',
            ),
        ),
    ]
