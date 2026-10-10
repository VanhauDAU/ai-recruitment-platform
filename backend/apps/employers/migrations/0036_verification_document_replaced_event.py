from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0035_company_upload_assets'),
    ]

    operations = [
        migrations.AddField(
            model_name='employerverificationcase',
            name='final_rejection_count',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='employerverificationcase',
            name='resubmission_locked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='employerverificationevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('submitted', 'Đã nộp'),
                    ('review_started', 'Bắt đầu xử lý'),
                    ('document_reviewed', 'Đã xử lý giấy tờ'),
                    ('document_replaced', 'Đã thay giấy tờ'),
                    ('changes_requested', 'Yêu cầu bổ sung'),
                    ('resubmitted', 'Đã nộp lại'),
                    ('resubmission_unlocked', 'Đã mở khóa nộp lại'),
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
    ]
