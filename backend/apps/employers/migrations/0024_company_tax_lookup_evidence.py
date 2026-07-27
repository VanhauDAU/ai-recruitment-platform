import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0023_company_update_request_revision'),
    ]

    operations = [
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
                    ('sensitive_viewed', 'Đã xem dữ liệu nhạy cảm'),
                    ('tax_lookup_refreshed', 'Đã tra cứu lại mã số thuế'),
                ],
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name='CompanyTaxLookupEvidence',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('provider', models.CharField(default='vietqr', editable=False, max_length=30)),
                ('workflow_revision', models.PositiveIntegerField()),
                ('tax_code', models.CharField(max_length=100)),
                ('submitted_company_name', models.CharField(blank=True, max_length=255)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('pending', 'Đang tra cứu'),
                            ('found', 'Đã tìm thấy'),
                            ('not_found', 'Không tìm thấy'),
                            ('unavailable', 'Nguồn không khả dụng'),
                            ('invalid_response', 'Phản hồi không hợp lệ'),
                        ],
                        default='pending',
                        max_length=24,
                    ),
                ),
                ('returned_tax_code', models.CharField(blank=True, max_length=100)),
                ('registered_name', models.CharField(blank=True, max_length=255)),
                ('international_name', models.CharField(blank=True, max_length=255)),
                ('short_name', models.CharField(blank=True, max_length=255)),
                ('provider_code', models.CharField(blank=True, max_length=40)),
                ('provider_description', models.CharField(blank=True, max_length=500)),
                ('response_hash', models.CharField(blank=True, max_length=64)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'company',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='tax_lookup_evidences',
                        to='employers.company',
                    ),
                ),
                (
                    'requested_by',
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'update_request',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='tax_lookup_evidences',
                        to='employers.companyupdaterequest',
                    ),
                ),
                (
                    'verification_case',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='tax_lookup_evidences',
                        to='employers.employerverificationcase',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(
                        fields=['company', 'tax_code', '-created_at'],
                        name='company_tax_lookup_time_idx',
                    ),
                    models.Index(
                        fields=['status', '-created_at'],
                        name='tax_lookup_status_time_idx',
                    ),
                ],
                'constraints': [
                    models.CheckConstraint(
                        condition=(
                            models.Q(
                                ('update_request__isnull', True),
                                ('verification_case__isnull', False),
                            )
                            | models.Q(
                                ('update_request__isnull', False),
                                ('verification_case__isnull', True),
                            )
                        ),
                        name='tax_lookup_evidence_exactly_one_workflow',
                    ),
                ],
            },
        ),
    ]
