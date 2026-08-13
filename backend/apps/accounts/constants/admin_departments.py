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
                    'announcement.view',
                    'announcement.manage',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                    'blog.view',
                    'blog.manage',
                    'knowledgebase.view',
                    'knowledgebase.manage',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'description': 'Quản lý và phát hành nội dung, catalogue mẫu CV.',
                'rank': 100,
                'permissions': (
                    'dashboard.view',
                    'announcement.view',
                    'announcement.manage',
                    'announcement.publish',
                    'cv_template.view',
                    'cv_template.create',
                    'cv_template.edit',
                    'cv_template.publish',
                    'cv_template.archive',
                    'cv_template.delete',
                    'blog.view',
                    'blog.manage',
                    'blog.publish',
                    'knowledgebase.view',
                    'knowledgebase.manage',
                    'knowledgebase.review',
                    'knowledgebase.publish',
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
                    'job_moderation.resolve_report',
                    'job_moderation.view_sensitive_contact',
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
                    'job_moderation.resolve_report',
                    'job_moderation.enforce_visibility',
                    'job_moderation.view_sensitive_contact',
                ),
            },
        ),
    },
    {
        'code': 'employer-operations',
        'name': 'Vận hành doanh nghiệp',
        'description': 'Tra cứu công ty, nhà tuyển dụng và xử lý các hồ sơ xác thực.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'description': 'Theo dõi công ty, NTD và các hàng chờ xác thực.',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'account.employer.view',
                    'company.view',
                    'company_recruiter.view',
                    'company_update.view',
                    'employer_verification.view',
                ),
            },
            {
                'code': 'manager',
                'name': 'Trưởng phòng',
                'description': 'Điều phối và quyết định các yêu cầu xác thực doanh nghiệp.',
                'rank': 100,
                'permissions': (
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
                    'company.view',
                    'company_recruiter.view',
                    'service_catalog.view',
                    'service_entitlement.view',
                    'service_audit.view',
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
                    'company.view',
                    'company.sensitive.view',
                    'company_recruiter.view',
                    'service_catalog.view',
                    'service_catalog.manage',
                    'service_catalog.draft.manage',
                    'service_catalog.publish',
                    'service_entitlement.view',
                    'service_entitlement.manage',
                    'service_audit.view',
                    'consultation_lead.view',
                    'consultation_lead.export',
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
