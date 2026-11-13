from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('jobs', '0046_convert_job_approval_states')]

    operations = [
        migrations.RemoveConstraint(
            model_name='job',
            name='chk_jobs_status',
        ),
        migrations.RemoveField(
            model_name='job',
            name='rejected_reason',
        ),
        migrations.AlterField(
            model_name='job',
            name='status',
            field=models.CharField(
                choices=[('draft', 'Nháp'), ('active', 'Đang tuyển'), ('closed', 'Đã đóng')],
                default='draft',
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='jobmoderationevent',
            name='action',
            field=models.CharField(
                choices=[
                    ('approve', 'Duyệt tin (lịch sử)'),
                    ('reject', 'Từ chối tin (lịch sử)'),
                    ('hide', 'Tạm ẩn tin'),
                    ('restore', 'Khôi phục hiển thị'),
                ],
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.CheckConstraint(
                condition=models.Q(('status__in', ['draft', 'active', 'closed'])),
                name='chk_jobs_status',
            ),
        ),
    ]
