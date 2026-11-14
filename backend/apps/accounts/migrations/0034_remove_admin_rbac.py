"""ADR-0018: gỡ phòng ban, chức danh, gán nhân viên và danh mục quyền admin.

Xóa vĩnh viễn dữ liệu RBAC; lời mời quản trị giữ lại nhưng không còn chức danh.
Phụ thuộc knowledgebase.0002 vì migration đó đọc AdminRole/AdminPermission.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0033_company_report_permissions'),
        ('knowledgebase', '0002_seed_knowledgebase'),
    ]

    # DeleteModel theo thứ tự phụ thuộc (lá trước) để Django dựng lại được bảng,
    # ràng buộc và ordering khi chạy ngược trên schema rỗng. Dữ liệu RBAC không
    # khôi phục được: rollback thật phải dùng bản pg_dump (ADR-0018).
    operations = [
        migrations.RemoveField(
            model_name='admininvitation',
            name='provisioning_scope',
        ),
        migrations.RemoveField(
            model_name='admininvitation',
            name='target_role',
        ),
        migrations.DeleteModel(name='AdminProvisioningScope'),
        migrations.DeleteModel(name='AdminMembership'),
        migrations.DeleteModel(name='AdminRole'),
        migrations.DeleteModel(name='Department'),
        migrations.DeleteModel(name='AdminPermission'),
    ]
