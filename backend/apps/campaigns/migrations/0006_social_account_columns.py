from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0005_social_provider_to_network'),
    ]

    operations = [
        # The default only lets a rollback re-add the column on existing rows;
        # 0005 then restores the real values.
        migrations.AlterField(
            model_name='socialaccountconnection',
            name='provider',
            field=models.CharField(
                choices=[('facebook', 'Facebook'), ('fake', 'Giả lập')],
                default='facebook',
                max_length=20,
            ),
        ),
        migrations.RemoveField(
            model_name='socialaccountconnection',
            name='provider',
        ),
        migrations.RenameField(
            model_name='socialaccountconnection',
            old_name='page_id',
            new_name='account_id',
        ),
        migrations.RenameField(
            model_name='socialaccountconnection',
            old_name='page_name',
            new_name='account_name',
        ),
        migrations.RenameField(
            model_name='socialaccountconnection',
            old_name='page_picture_url',
            new_name='account_picture_url',
        ),
        migrations.AddConstraint(
            model_name='socialaccountconnection',
            constraint=models.UniqueConstraint(
                fields=('owner', 'network', 'simulated', 'account_id'),
                name='camp_social_account_unique',
            ),
        ),
        migrations.AlterField(
            model_name='campaignactivity',
            name='event_type',
            field=models.CharField(choices=[('legacy_synced', 'Đồng bộ dữ liệu hiện có'), ('campaign_created', 'Tạo chiến dịch'), ('campaign_updated', 'Cập nhật chiến dịch'), ('campaign_paused', 'Dừng chiến dịch'), ('campaign_resumed', 'Mở lại chiến dịch'), ('campaign_scheduled', 'Lên lịch kích hoạt'), ('campaign_unscheduled', 'Hủy lịch kích hoạt'), ('campaign_activated', 'Kích hoạt chiến dịch'), ('campaign_activation_failed', 'Kích hoạt theo lịch thất bại'), ('campaign_completed', 'Hoàn tất chiến dịch'), ('campaign_cancelled', 'Hủy chiến dịch'), ('channel_added', 'Thêm kênh phân phối'), ('channel_posted', 'Đã đăng lên kênh'), ('social_post_published', 'Đã tự đăng bài'), ('social_post_deleted', 'Đã tự gỡ bài'), ('job_added', 'Thêm tin tuyển dụng'), ('job_removed', 'Gỡ tin tuyển dụng'), ('job_updated', 'Cập nhật tin tuyển dụng'), ('job_status_changed', 'Đổi trạng thái tin'), ('application_received', 'Nhận CV ứng tuyển'), ('application_status_changed', 'Đổi trạng thái ứng viên'), ('account_policy_held', 'Giữ do trạng thái tài khoản'), ('account_policy_released', 'Gỡ giữ do trạng thái tài khoản')], max_length=50),
        ),
        migrations.AlterField(
            model_name='scheduledsocialpost',
            name='status',
            field=models.CharField(choices=[('scheduled', 'Đã hẹn giờ'), ('publishing', 'Đang đăng'), ('published', 'Đã đăng'), ('postponed', 'Hoãn do chiến dịch tạm dừng'), ('failed', 'Đăng không thành công'), ('cancelled', 'Đã hủy'), ('deleted', 'Đã gỡ bài'), ('delete_failed', 'Cần tự gỡ bài')], default='scheduled', max_length=20),
        ),
        ]
