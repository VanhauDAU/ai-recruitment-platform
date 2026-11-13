from django.db import migrations
from django.utils import timezone

# CVT-4 gộp quyền mẫu CV theo cổng quản trị mới (kế hoạch CVT-v3 mục 9.6):
# create/edit/delete → manage, archive → publish; thêm quyền sinh AI và quyền
# xem CV ứng viên. Vai trò đang có quyền cũ được cấp quyền mới tương ứng trước
# khi mã cũ bị đánh dấu deprecated, như `sync_permission_catalog`.
NEW_PERMISSIONS = {
    'cv_template.manage': (
        'cv_template',
        'Quản lý mẫu CV',
        'Tạo, sửa mẫu CV, thư viện màu/danh mục/hình nền, vị trí và trường riêng.',
    ),
    'cv_content.generate_ai': (
        'cv_template',
        'Sinh nội dung CV mẫu bằng AI',
        'Chạy sinh nội dung mẫu theo vị trí bằng AI; kết quả chờ duyệt.',
    ),
    'cv_user.view': (
        'cv_user',
        'Xem CV ứng viên',
        'Xem metadata CV của ứng viên (không gồm nội dung).',
    ),
    'cv_user.view_content': (
        'cv_user',
        'Xem nội dung CV ứng viên',
        'Xem nội dung CV khi có lý do; mỗi lần xem được ghi nhật ký. Khóa CV vi phạm.',
    ),
}
REPLACEMENTS = {
    'cv_template.create': 'cv_template.manage',
    'cv_template.edit': 'cv_template.manage',
    'cv_template.delete': 'cv_template.manage',
    'cv_template.archive': 'cv_template.publish',
}

def regroup_cv_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    # DB mới chưa có catalogue quyền: `sync_permission_catalog` sẽ tạo đúng bộ mới.
    if not permission_model.objects.filter(code__in=REPLACEMENTS).exists():
        return
    for code, (module, label, description) in NEW_PERMISSIONS.items():
        permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': module,
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
    publish, _ = permission_model.objects.get_or_create(
        code='cv_template.publish',
        defaults={'module': 'cv_template', 'label': 'Phát hành mẫu CV'},
    )
    manage = permission_model.objects.get(code='cv_template.manage')
    replacements = {
        code: publish if target == 'cv_template.publish' else manage
        for code, target in REPLACEMENTS.items()
    }
    for old in permission_model.objects.filter(code__in=REPLACEMENTS).prefetch_related('roles'):
        for role in old.roles.all():
            role.permissions.add(replacements[old.code])
    permission_model.objects.filter(code__in=REPLACEMENTS, is_active=True).update(
        is_active=False, deprecated_at=timezone.now()
    )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0030_remove_two_factor')]

    operations = [
        migrations.RunPython(regroup_cv_permissions, migrations.RunPython.noop),
    ]
