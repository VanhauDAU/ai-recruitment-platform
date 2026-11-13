from uuid import uuid4

from django.db import migrations


CATEGORIES = (
    (
        'Tài khoản và đăng nhập',
        'tai-khoan-va-dang-nhap',
        'Đăng ký, xác thực email, đăng nhập và khôi phục tài khoản.',
        1,
        180,
    ),
    (
        'Bảo mật và quyền riêng tư',
        'bao-mat-va-quyen-rieng',
        'Mật khẩu, xác thực hai lớp và bảo vệ dữ liệu cá nhân.',
        2,
        90,
    ),
    (
        'Tìm việc và gợi ý việc làm',
        'tim-viec-va-goi-y-viec-lam',
        'Tìm kiếm, bộ lọc, lưu việc và gợi ý phù hợp.',
        3,
        180,
    ),
    (
        'Ứng tuyển và theo dõi hồ sơ',
        'ung-tuyen-va-theo-doi-ho-so',
        'Ứng tuyển, chọn CV và theo dõi quá trình ứng tuyển.',
        4,
        180,
    ),
    (
        'CV và mẫu CV',
        'cv-va-mau-cv',
        'Chọn mẫu, tạo, chỉnh sửa, quản lý và chia sẻ CV.',
        5,
        180,
    ),
    (
        'Tìm việc an toàn',
        'tim-viec-an-toan',
        'Nhận diện rủi ro và bảo vệ bản thân trong quá trình tìm việc.',
        6,
        90,
    ),
    (
        'Liên hệ hỗ trợ',
        'lien-he-ho-tro',
        'Các kênh liên hệ và thông tin cần cung cấp khi yêu cầu hỗ trợ.',
        7,
        90,
    ),
)

PERMISSIONS = (
    (
        'knowledgebase.view',
        'Xem trung tâm trợ giúp',
        'Xem bài, revision, preview và lịch sử vận hành nội dung trợ giúp.',
    ),
    (
        'knowledgebase.manage',
        'Biên tập trung tâm trợ giúp',
        'Tạo chuyên mục, bài viết, revision và gửi nội dung đi duyệt.',
    ),
    (
        'knowledgebase.review',
        'Duyệt nội dung trợ giúp',
        'Phê duyệt hoặc từ chối revision đang chờ kiểm duyệt.',
    ),
    (
        'knowledgebase.publish',
        'Phát hành trung tâm trợ giúp',
        'Xuất bản, rollback, lưu trữ bài và thay đổi nội dung đang công khai.',
    ),
)

ROLE_GRANTS = {
    'staff': ('knowledgebase.view', 'knowledgebase.manage'),
    'manager': (
        'knowledgebase.view',
        'knowledgebase.manage',
        'knowledgebase.review',
        'knowledgebase.publish',
    ),
}


def seed_knowledgebase(apps, schema_editor):
    category_model = apps.get_model('knowledgebase', 'KnowledgeCategory')
    permission_model = apps.get_model('accounts', 'AdminPermission')
    role_model = apps.get_model('accounts', 'AdminRole')

    for name, slug, description, order, review_days in CATEGORIES:
        category_model.objects.get_or_create(
            slug=slug,
            defaults={
                'public_id': f'kbc_{uuid4().hex[:12]}',
                'name': name,
                'description': description,
                'order': order,
                'review_interval_days': review_days,
                'is_active': True,
            },
        )

    permissions = {}
    for code, label, description in PERMISSIONS:
        permission, _ = permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': 'knowledgebase',
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
        permissions[code] = permission

    roles = role_model.objects.filter(
        department__code='content-cv',
        code__in=ROLE_GRANTS,
        is_system_managed=True,
    )
    for role in roles:
        role.permissions.add(*(permissions[code] for code in ROLE_GRANTS[role.code]))


def keep_seed_data(apps, schema_editor):
    # Nội dung và quyền là dữ liệu additive/audit-relevant. Rollback code không
    # được xóa cấu hình đã có hoặc làm mất grant của quản trị viên.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0020_account_identity_recovery'),
        ('knowledgebase', '0001_initial'),
    ]

    operations = [migrations.RunPython(seed_knowledgebase, keep_seed_data)]
