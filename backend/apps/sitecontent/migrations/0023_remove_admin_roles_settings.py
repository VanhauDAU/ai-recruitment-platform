from django.db import migrations, models

ADMIN_ROLE_SETTING_KEYS = (
    'admin_roles_enabled',
    'admin_allow_staff_creation',
    'admin_default_role',
    'admin_action_log_enabled',
)


def remove_admin_role_settings(apps, schema_editor):
    # Nhóm "Phân quyền admin" chỉ là khung chưa từng được đọc; ADR-0018 bỏ hẳn
    # phòng ban/chức danh nên các khóa này không còn ý nghĩa.
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.filter(key__in=ADMIN_ROLE_SETTING_KEYS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('sitecontent', '0022_delete_locale'),
    ]

    operations = [
        migrations.RunPython(remove_admin_role_settings, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='sitesetting',
            name='group',
            field=models.CharField(
                choices=[
                    ('general', 'Cài đặt chung'),
                    ('homepage', 'Giao diện trang chủ'),
                    ('seo', 'SEO'),
                    ('candidate', 'Tài khoản ứng viên'),
                    ('employer', 'Nhà tuyển dụng'),
                    ('jobs', 'Việc làm'),
                    ('cv', 'Hồ sơ / CV'),
                    ('email', 'Email & thông báo'),
                    ('payment', 'Thanh toán / gói dịch vụ'),
                    ('security', 'Bảo mật'),
                    ('upload', 'Upload file / media'),
                    ('footer', 'Footer'),
                    ('contact', 'Liên hệ / hỗ trợ'),
                    ('ai', 'Cài đặt AI'),
                    ('blog', 'Cẩm nang nghề nghiệp (Blog)'),
                ],
                default='general',
                max_length=30,
            ),
        ),
    ]
