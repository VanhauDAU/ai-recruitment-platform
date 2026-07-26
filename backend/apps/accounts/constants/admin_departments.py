"""Code-owned default organizational matrix for administrator access."""

ADMIN_DEPARTMENTS = (
    {
        'code': 'content-cv',
        'name': 'Nội dung & CV',
        'description': 'Quản lý nội dung và catalogue mẫu CV.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'description': 'Biên tập nội dung và mẫu CV.',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'description': 'Quản lý và phát hành nội dung, catalogue mẫu CV.',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                    'cv_template.publish',
                    'cv_template.archive',
                    'cv_template.delete',
                ),
            },
        ),
    },
    {
        'code': 'job-moderation',
        'name': 'Kiểm duyệt tin tuyển dụng',
        'description': 'Kiểm tra và quyết định tin tuyển dụng được phép hiển thị.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'description': 'Kiểm tra và xử lý tin tuyển dụng chờ duyệt.',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'job_moderation.view',
                    'job_moderation.approve',
                    'job_moderation.reject',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'description': 'Điều phối hoạt động kiểm duyệt tin tuyển dụng.',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'job_moderation.view',
                    'job_moderation.approve',
                    'job_moderation.reject',
                ),
            },
        ),
    },
    {
        'code': 'employer-services',
        'name': 'Dịch vụ nhà tuyển dụng',
        'description': 'Quản lý dịch vụ và lead tư vấn của nhà tuyển dụng.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'description': 'Theo dõi catalogue dịch vụ và xử lý lead tư vấn.',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'service_catalog.view',
                    'consultation_lead.view',
                    'consultation_lead.manage',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'description': 'Quản lý catalogue dịch vụ và hoạt động tư vấn.',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'service_catalog.view',
                    'service_catalog.manage',
                    'consultation_lead.view',
                    'consultation_lead.manage',
                ),
            },
        ),
    },
)


def system_department_definition(code):
    return next((item for item in ADMIN_DEPARTMENTS if item['code'] == code), None)


def system_role_definition(department_code, role_code):
    department = system_department_definition(department_code)
    if not department:
        return None
    return next((item for item in department['roles'] if item['code'] == role_code), None)
