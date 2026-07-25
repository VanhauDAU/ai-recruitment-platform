"""Code-owned registry for administrator permissions.

Database rows mirror this registry. Rows removed from the registry are deprecated
instead of deleted so a code rollback can restore grants without data loss.
"""

ADMIN_PERMISSIONS = (
    {
        'code': 'admin_access.manage_department',
        'module': 'admin_access',
        'label': 'Quản lý phòng ban',
        'description': 'Tạo và cập nhật trạng thái phòng ban quản trị.',
    },
    {
        'code': 'admin_access.manage_role',
        'module': 'admin_access',
        'label': 'Quản lý chức danh',
        'description': 'Tạo chức danh và gán quyền cho chức danh.',
    },
    {
        'code': 'admin_access.manage_staff',
        'module': 'admin_access',
        'label': 'Quản lý nhân viên',
        'description': 'Gán và thu hồi chức danh của nhân viên quản trị.',
    },
    {
        'code': 'admin_access.view',
        'module': 'admin_access',
        'label': 'Xem phân quyền',
        'description': 'Xem cấu trúc phòng ban, chức danh và nhân viên quản trị.',
    },
    {
        'code': 'audit_log.view',
        'module': 'audit_log',
        'label': 'Xem lịch sử phân quyền',
        'description': 'Xem và xuất lịch sử thay đổi quyền quản trị.',
    },
    {
        'code': 'blog.manage',
        'module': 'blog',
        'label': 'Quản lý bài viết',
        'description': 'Tạo và chỉnh sửa nội dung bài viết.',
    },
    {
        'code': 'blog.publish',
        'module': 'blog',
        'label': 'Phát hành bài viết',
        'description': 'Phát hành hoặc thu hồi bài viết.',
    },
    {
        'code': 'blog.view',
        'module': 'blog',
        'label': 'Xem bài viết',
        'description': 'Xem khu vực quản trị bài viết.',
    },
    {
        'code': 'consultation_lead.manage',
        'module': 'consultation_lead',
        'label': 'Xử lý lead tư vấn',
        'description': 'Cập nhật trạng thái xử lý lead tư vấn doanh nghiệp.',
    },
    {
        'code': 'consultation_lead.view',
        'module': 'consultation_lead',
        'label': 'Xem lead tư vấn',
        'description': 'Xem thông tin lead tư vấn doanh nghiệp.',
    },
    {
        'code': 'cv_template.archive',
        'module': 'cv_template',
        'label': 'Lưu trữ mẫu CV',
        'description': 'Thu hồi mẫu, phiên bản hoặc dữ liệu catalogue CV.',
    },
    {
        'code': 'cv_template.create',
        'module': 'cv_template',
        'label': 'Tạo mẫu CV',
        'description': 'Tạo mẫu và phiên bản CV mới.',
    },
    {
        'code': 'cv_template.delete',
        'module': 'cv_template',
        'label': 'Xoá mẫu CV',
        'description': 'Xoá hoặc gỡ dữ liệu khỏi catalogue CV.',
    },
    {
        'code': 'cv_template.edit',
        'module': 'cv_template',
        'label': 'Sửa mẫu CV',
        'description': 'Chỉnh sửa nội dung và ảnh dẫn xuất của mẫu CV.',
    },
    {
        'code': 'cv_template.publish',
        'module': 'cv_template',
        'label': 'Phát hành mẫu CV',
        'description': 'Kích hoạt hoặc phát hành dữ liệu catalogue CV.',
    },
    {
        'code': 'cv_template.view',
        'module': 'cv_template',
        'label': 'Xem catalogue CV',
        'description': 'Xem catalogue và bản xem trước CV.',
    },
    {
        'code': 'dashboard.view',
        'module': 'dashboard',
        'label': 'Xem tổng quan',
        'description': 'Xem bảng điều khiển quản trị.',
    },
    {
        'code': 'job_moderation.approve',
        'module': 'job_moderation',
        'label': 'Duyệt tin tuyển dụng',
        'description': 'Phê duyệt tin tuyển dụng đã gửi duyệt.',
    },
    {
        'code': 'job_moderation.reject',
        'module': 'job_moderation',
        'label': 'Từ chối tin tuyển dụng',
        'description': 'Từ chối tin tuyển dụng và ghi lý do.',
    },
    {
        'code': 'job_moderation.view',
        'module': 'job_moderation',
        'label': 'Xem tin chờ duyệt',
        'description': 'Xem danh sách tin tuyển dụng cần kiểm duyệt.',
    },
    {
        'code': 'service_catalog.manage',
        'module': 'service_catalog',
        'label': 'Quản lý gói dịch vụ',
        'description': 'Tạo, sửa hoặc xoá nhóm và gói dịch vụ nhà tuyển dụng.',
    },
    {
        'code': 'service_catalog.view',
        'module': 'service_catalog',
        'label': 'Xem gói dịch vụ',
        'description': 'Xem catalogue dịch vụ nhà tuyển dụng.',
    },
    {
        'code': 'site_setting.manage',
        'module': 'site_setting',
        'label': 'Quản lý cài đặt hệ thống',
        'description': 'Cập nhật cấu hình hệ thống dùng chung.',
    },
    {
        'code': 'site_setting.view',
        'module': 'site_setting',
        'label': 'Xem cài đặt hệ thống',
        'description': 'Xem cấu hình hệ thống dùng chung.',
    },
)

ADMIN_PERMISSION_CODES = frozenset(item['code'] for item in ADMIN_PERMISSIONS)
