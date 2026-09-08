from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('services', '0008_saved_job_remarketing_impression')]

    operations = [
        migrations.AlterField(
            model_name='serviceauditevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('package_published', 'Phát hành phiên bản gói'),
                    ('unit_granted', 'Cấp lượt'),
                    ('unit_revoked', 'Thu hồi lượt'),
                    ('unit_expired', 'Lượt hết hạn kích hoạt'),
                    ('unit_consumed', 'Sử dụng lượt'),
                    ('activation_created', 'Kích hoạt dịch vụ'),
                    ('activation_expired', 'Dịch vụ kết thúc'),
                    ('activation_terminated', 'Dịch vụ bị dừng'),
                    ('capability_used', 'Sử dụng quyền lợi'),
                ],
                max_length=32,
            ),
        ),
    ]
