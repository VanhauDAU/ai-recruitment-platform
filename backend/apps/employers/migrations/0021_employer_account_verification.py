import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

VERIFICATION_DOC_TYPES = {
    'authorization_letter',
    'business_registration',
    'data_processing_agreement',
    'identity_document',
}


def _public_id(prefix):
    return f'{prefix}_{uuid.uuid4().hex[:12]}'


def backfill_verification_cases(apps, schema_editor):
    RecruiterProfile = apps.get_model('employers', 'RecruiterProfile')
    VerificationCase = apps.get_model('employers', 'EmployerVerificationCase')
    VerificationEvent = apps.get_model('employers', 'EmployerVerificationEvent')
    CompanyDocument = apps.get_model('employers', 'CompanyDocument')

    for document in CompanyDocument.objects.all().iterator():
        document.public_id = _public_id('doc')
        document.save(update_fields=['public_id'])

    for recruiter in RecruiterProfile.objects.all().iterator():
        case = VerificationCase.objects.create(
            public_id=_public_id('evc'),
            recruiter_id=recruiter.pk,
            company_id=recruiter.company_id,
            status='draft',
        )
        documents = CompanyDocument.objects.filter(
            update_request__isnull=True,
            doc_type__in=VERIFICATION_DOC_TYPES,
        ).filter(
            models.Q(recruiter_id=recruiter.pk)
            | models.Q(recruiter__isnull=True, uploaded_by_id=recruiter.user_id)
        )
        latest_submitted_at = None
        has_authorization = False
        for doc_type in VERIFICATION_DOC_TYPES:
            versions = list(documents.filter(doc_type=doc_type).order_by('created_at', 'id'))
            for index, document in enumerate(versions, start=1):
                document.verification_case_id = case.pk
                document.recruiter_id = recruiter.pk
                document.version = index
                document.is_current = index == len(versions)
                document.supersedes_id = versions[index - 2].pk if index > 1 else None
                document.save(
                    update_fields=[
                        'verification_case',
                        'recruiter',
                        'version',
                        'is_current',
                        'supersedes',
                    ]
                )
                latest_submitted_at = max(
                    filter(None, [latest_submitted_at, document.created_at]),
                    default=None,
                )
                has_authorization = has_authorization or doc_type in {
                    'authorization_letter',
                    'identity_document',
                }
        if latest_submitted_at is not None:
            # Legacy ownership cannot be proven reliably by migration alone.
            # Send it to the queue instead of inheriting an approved state.
            case.status = 'in_review'
            case.submitted_at = latest_submitted_at
            case.verification_method = (
                'authorization_and_id' if has_authorization else 'business_registration'
            )
            case.lock_version = 1
            case.save(
                update_fields=[
                    'status',
                    'submitted_at',
                    'verification_method',
                    'lock_version',
                ]
            )
            VerificationEvent.objects.create(
                public_id=_public_id('eve'),
                verification_case_id=case.pk,
                event_type='submitted',
                payload={'source': 'legacy_backfill', 'requires_manual_review': True},
            )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('employers', '0020_remove_campaign_insight_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployerVerificationCase',
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
                    'verification_method',
                    models.CharField(
                        blank=True,
                        choices=[
                            ('business_registration', 'Giấy đăng ký doanh nghiệp'),
                            (
                                'authorization_and_id',
                                'Giấy ủy quyền + giấy tờ định danh',
                            ),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('draft', 'Chưa nộp'),
                            ('pending', 'Chờ duyệt'),
                            ('in_review', 'Đang xử lý'),
                            ('changes_requested', 'Cần bổ sung'),
                            ('rejected', 'Bị từ chối'),
                            ('approved', 'Đã xác thực'),
                        ],
                        default='draft',
                        max_length=24,
                    ),
                ),
                ('revision', models.PositiveIntegerField(default=1)),
                ('lock_version', models.PositiveIntegerField(default=0)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('review_started_at', models.DateTimeField(blank=True, null=True)),
                ('decided_at', models.DateTimeField(blank=True, null=True)),
                ('decision_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'company',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='recruiter_verification_cases',
                        to='employers.company',
                    ),
                ),
                (
                    'recruiter',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='verification_case',
                        to='employers.recruiterprofile',
                    ),
                ),
                (
                    'reviewer',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-submitted_at', '-updated_at'],
                'indexes': [
                    models.Index(
                        fields=['status', '-submitted_at'],
                        name='emp_verify_status_time_idx',
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name='EmployerVerificationEvent',
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
                    'event_type',
                    models.CharField(
                        choices=[
                            ('submitted', 'Đã nộp'),
                            ('review_started', 'Bắt đầu xử lý'),
                            ('document_reviewed', 'Đã xử lý giấy tờ'),
                            ('changes_requested', 'Yêu cầu bổ sung'),
                            ('resubmitted', 'Đã nộp lại'),
                            ('approved', 'Đã duyệt'),
                            ('rejected', 'Đã từ chối'),
                            ('sensitive_viewed', 'Đã xem dữ liệu nhạy cảm'),
                        ],
                        max_length=32,
                    ),
                ),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'actor',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'verification_case',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='events',
                        to='employers.employerverificationcase',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(
                        fields=['verification_case', '-created_at'],
                        name='emp_verify_event_time_idx',
                    )
                ],
            },
        ),
        migrations.AddField(
            model_name='companydocument',
            name='public_id',
            field=models.CharField(
                editable=False,
                max_length=50,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='file_size',
            field=models.PositiveBigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='is_current',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='mime_type',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='sha256',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='companydocument',
            name='verification_case',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='documents',
                to='employers.employerverificationcase',
            ),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='companydocument',
            name='supersedes',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='superseded_by',
                to='employers.companydocument',
            ),
        ),
        migrations.AlterField(
            model_name='companydocument',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Chờ duyệt'),
                    ('changes_requested', 'Cần bổ sung'),
                    ('approved', 'Đã duyệt'),
                    ('rejected', 'Từ chối'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_verification_cases, migrations.RunPython.noop),
        # Django creates PostgreSQL foreign keys as deferrable. The backfill
        # above updates CompanyDocument.verification_case/recruiter, leaving
        # their constraint triggers queued until transaction commit. Flush
        # them before the following ALTER TABLE so databases with legacy
        # documents do not fail with "pending trigger events".
        migrations.RunSQL(
            sql='SET CONSTRAINTS ALL IMMEDIATE',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name='companydocument',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
        migrations.AddConstraint(
            model_name='companydocument',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ('is_current', True),
                    ('verification_case__isnull', False),
                ),
                fields=('verification_case', 'doc_type'),
                name='uniq_current_verification_doc_type',
            ),
        ),
    ]
