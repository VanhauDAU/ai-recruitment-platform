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
                    'cv_template.manage',
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
                    'cv_template.manage',
                    'cv_template.publish',
                    'cv_content.generate_ai',
                    'cv_user.view',
                    'cv_user.view_content',
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
        'description': 'Hậu kiểm tin tuyển dụng: xử lý báo cáo, tạm ẩn và khôi phục hiển thị.',
        'roles': (
            {
                'code': 'staff',
                'name': 'Nhân viên',
                'description': 'Rà soát tin tuyển dụng và xử lý báo cáo vi phạm.',
                'rank': 10,
                'permissions': (
                    'dashboard.view',
                    'job_moderation.view',
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
                    'employer_domain.view',
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
                    'company_page.moderate',
                    'company_recruiter.view',
                    'company_report.view',
                    'company_report.resolve',
                    'company_update.view',
                    'company_update.review',
                    'employer_verification.view',
                    'employer_verification.review',
                    'employer_domain.view',
                    'employer_domain.review',
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
