import uuid

from django.db import migrations

PERMISSIONS = (
    (
        'account.employer.view',
        'account',
        'Xem tài khoản nhà tuyển dụng',
        'Xem danh sách và chi tiết tài khoản nhà tuyển dụng, không mở dữ liệu ứng viên.',
    ),
    (
        'company.sensitive.view',
        'company',
        'Xem dữ liệu công ty nhạy cảm',
        'Xem đầy đủ mã số thuế, email và số điện thoại của công ty.',
    ),
    (
        'company.view',
        'company',
        'Xem công ty',
        'Xem danh sách và hồ sơ pháp lý của công ty tuyển dụng.',
    ),
    (
        'company_recruiter.view',
        'company',
        'Xem nhà tuyển dụng của công ty',
        'Xem owner, member và trạng thái xác thực của nhà tuyển dụng thuộc công ty.',
    ),
    (
        'company_update.review',
        'company_update',
        'Duyệt sửa thông tin công ty',
        'Duyệt giấy tờ, từ chối hoặc áp dụng yêu cầu sửa thông tin công ty; cần cấp kèm quyền xem.',
    ),
    (
        'company_update.view',
        'company_update',
        'Xem yêu cầu sửa công ty',
        'Xem hàng chờ và đối chiếu thông tin công ty hiện tại với nội dung đề xuất.',
    ),
    (
        'dashboard.view',
        'dashboard',
        'Xem tổng quan',
        'Xem bảng điều khiển quản trị.',
    ),
    (
        'employer_verification.review',
        'employer_verification',
        'Duyệt xác thực nhà tuyển dụng',
        'Duyệt, yêu cầu bổ sung hoặc từ chối hồ sơ xác thực nhà tuyển dụng.',
    ),
    (
        'employer_verification.view',
        'employer_verification',
        'Xem xác thực nhà tuyển dụng',
        'Xem hàng chờ, giấy tờ và lịch sử xác thực nhà tuyển dụng.',
    ),
)

ROLE_DEFINITIONS = (
    (
        'staff',
        'Nhân viên',
        'Theo dõi công ty, NTD và các hàng chờ xác thực.',
        10,
        (
            'dashboard.view',
            'account.employer.view',
            'company.view',
            'company_recruiter.view',
            'company_update.view',
            'employer_verification.view',
        ),
    ),
    (
        'manager',
        'Trưởng phòng',
        'Điều phối và quyết định các yêu cầu xác thực doanh nghiệp.',
        100,
        (
            'dashboard.view',
            'account.employer.view',
            'company.view',
            'company.sensitive.view',
            'company_recruiter.view',
            'company_update.view',
            'company_update.review',
            'employer_verification.view',
            'employer_verification.review',
        ),
    ),
)


def public_id(prefix):
    return f'{prefix}_{uuid.uuid4().hex[:12]}'


def seed_employer_operations_access(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    department_model = apps.get_model('accounts', 'Department')
    role_model = apps.get_model('accounts', 'AdminRole')

    permissions = {}
    for code, module, label, description in PERMISSIONS:
        permission, _ = permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': module,
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
        permissions[code] = permission

    department, created = department_model.objects.get_or_create(
        code='employer-operations',
        defaults={
            'public_id': public_id('dept'),
            'name': 'Vận hành doanh nghiệp',
            'description': 'Tra cứu công ty, nhà tuyển dụng và xử lý các hồ sơ xác thực.',
            'is_system_managed': True,
        },
    )
    if not created and department.is_system_managed:
        department.name = 'Vận hành doanh nghiệp'
        department.description = 'Tra cứu công ty, nhà tuyển dụng và xử lý các hồ sơ xác thực.'
        department.save(update_fields=['name', 'description', 'updated_at'])

    for code, name, description, rank, permission_codes in ROLE_DEFINITIONS:
        role, role_created = role_model.objects.get_or_create(
            department=department,
            code=code,
            defaults={
                'public_id': public_id('arole'),
                'name': name,
                'description': description,
                'rank': rank,
                'is_system_managed': True,
            },
        )
        if role_created or role.is_system_managed:
            if not role_created:
                role.name = name
                role.description = description
                role.rank = rank
                role.save(update_fields=['name', 'description', 'rank', 'updated_at'])
            role.permissions.set(permissions[item] for item in permission_codes)


def keep_employer_operations_access(apps, schema_editor):
    # Permission và membership là dữ liệu audit; rollback code không được xoá grant.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0017_authsession_device_index')]

    operations = [
        migrations.RunPython(
            seed_employer_operations_access,
            keep_employer_operations_access,
        ),
    ]
