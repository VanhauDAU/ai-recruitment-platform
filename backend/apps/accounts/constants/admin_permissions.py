"""Code-owned registry for administrator permissions.

Database rows mirror this registry. Rows removed from the registry are deprecated
instead of deleted so a code rollback can restore grants without data loss.
"""

ADMIN_PERMISSIONS = (
    {
        'code': 'account.admin.invite',
        'module': 'account',
        'label': 'Mời tài khoản quản trị',
        'description': 'Mời và quản lý lời mời quản trị viên trong phạm vi chức danh được cấp.',
    },
    {
        'code': 'account.admin.manage',
        'module': 'account',
        'label': 'Quản lý tài khoản quản trị',
        'description': 'Quản lý tài khoản quản trị đã kích hoạt; thao tác ghi vẫn superuser-only.',
    },
    {
        'code': 'account.admin.view',
        'module': 'account',
        'label': 'Xem tài khoản quản trị',
        'description': 'Xem danh sách và chi tiết tài khoản quản trị nội bộ.',
    },
    {
        'code': 'account.employer.view',
        'module': 'account',
        'label': 'Xem tài khoản nhà tuyển dụng',
        'description': 'Xem danh sách và chi tiết tài khoản nhà tuyển dụng, không mở dữ liệu ứng viên.',
    },
    {
        'code': 'account.profile.manage',
        'module': 'account',
        'label': 'Sửa thông tin tài khoản',
        'description': 'Sửa họ tên và số điện thoại của ứng viên hoặc nhà tuyển dụng.',
    },
    {
        'code': 'account.sensitive.view',
        'module': 'account',
        'label': 'Xem dữ liệu tài khoản nhạy cảm',
        'description': 'Xem dữ liệu cá nhân, consent, CV và giấy tờ riêng tư có ghi audit.',
    },
    {
        'code': 'account.security.manage',
        'module': 'account',
        'label': 'Hỗ trợ bảo mật tài khoản',
        'description': 'Gửi xác minh, đặt lại mật khẩu và thu hồi phiên tài khoản.',
    },
    {
        'code': 'account.status.manage',
        'module': 'account',
        'label': 'Quản lý trạng thái tài khoản',
        'description': 'Tạm khóa, mở khóa hoặc cấm tài khoản ứng viên và nhà tuyển dụng.',
    },
    {
        'code': 'account.view',
        'module': 'account',
        'label': 'Xem tài khoản người dùng',
        'description': 'Xem danh sách và chi tiết tài khoản ứng viên, nhà tuyển dụng.',
    },
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
        'code': 'announcement.manage',
        'module': 'announcement',
        'label': 'Quản lý thông báo',
        'description': 'Tạo thông báo và revision nội dung trước khi phát hành.',
    },
    {
        'code': 'announcement.publish',
        'module': 'announcement',
        'label': 'Phát hành thông báo',
        'description': 'Phát hành, lên lịch, tạm dừng, tiếp tục hoặc lưu trữ thông báo.',
    },
    {
        'code': 'announcement.view',
        'module': 'announcement',
        'label': 'Xem thông báo',
        'description': 'Xem danh sách, nội dung, lịch sử revision và hiệu quả thông báo.',
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
        'code': 'company.sensitive.view',
        'module': 'company',
        'label': 'Xem dữ liệu công ty nhạy cảm',
        'description': 'Xem đầy đủ mã số thuế, email và số điện thoại của công ty.',
    },
    {
        'code': 'company.view',
        'module': 'company',
        'label': 'Xem công ty',
        'description': 'Xem danh sách và hồ sơ pháp lý của công ty tuyển dụng.',
    },
    {
        'code': 'company_recruiter.view',
        'module': 'company',
        'label': 'Xem nhà tuyển dụng của công ty',
        'description': 'Xem owner, member và trạng thái xác thực của nhà tuyển dụng thuộc công ty.',
    },
    {
        'code': 'company_update.review',
        'module': 'company_update',
        'label': 'Duyệt sửa thông tin công ty',
        'description': 'Duyệt giấy tờ, từ chối hoặc áp dụng yêu cầu sửa thông tin công ty; cần cấp kèm quyền xem.',
    },
    {
        'code': 'company_update.view',
        'module': 'company_update',
        'label': 'Xem yêu cầu sửa công ty',
        'description': 'Xem hàng chờ và đối chiếu thông tin công ty hiện tại với nội dung đề xuất.',
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
        'code': 'employer_verification.review',
        'module': 'employer_verification',
        'label': 'Duyệt xác thực nhà tuyển dụng',
        'description': 'Duyệt, yêu cầu bổ sung hoặc từ chối hồ sơ xác thực nhà tuyển dụng.',
    },
    {
        'code': 'employer_verification.view',
        'module': 'employer_verification',
        'label': 'Xem xác thực nhà tuyển dụng',
        'description': 'Xem hàng chờ, giấy tờ và lịch sử xác thực nhà tuyển dụng.',
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
        'code': 'job_moderation.resolve_report',
        'module': 'job_moderation',
        'label': 'Xử lý báo cáo tin tuyển dụng',
        'description': 'Xác nhận, bác bỏ hoặc gỡ kết luận vi phạm của báo cáo tin tuyển dụng.',
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

# Quan hệ quyền nền được sở hữu ở backend để API, seed và UI không thể tạo một
# chức danh có quyền thao tác nhưng thiếu quyền đọc tài nguyên tương ứng.
ADMIN_PERMISSION_DEPENDENCIES = {
    'account.admin.manage': ('account.admin.view',),
    'account.profile.manage': ('account.view',),
    'account.security.manage': ('account.view',),
    'account.sensitive.view': ('account.view',),
    'account.status.manage': ('account.view',),
    'admin_access.manage_department': ('admin_access.view',),
    'admin_access.manage_role': ('admin_access.view',),
    'admin_access.manage_staff': ('admin_access.view',),
    'announcement.manage': ('announcement.view',),
    'announcement.publish': ('announcement.view',),
    'blog.manage': ('blog.view',),
    'blog.publish': ('blog.view',),
    'company.sensitive.view': ('company.view',),
    'company_recruiter.view': ('company.view',),
    'company_update.review': ('company_update.view',),
    'consultation_lead.manage': ('consultation_lead.view',),
    'cv_template.archive': ('cv_template.view',),
    'cv_template.create': ('cv_template.view',),
    'cv_template.delete': ('cv_template.view',),
    'cv_template.edit': ('cv_template.view',),
    'cv_template.publish': ('cv_template.view',),
    'employer_verification.review': ('employer_verification.view',),
    'job_moderation.approve': ('job_moderation.view',),
    'job_moderation.reject': ('job_moderation.view',),
    'job_moderation.resolve_report': ('job_moderation.view',),
    'service_catalog.manage': ('service_catalog.view',),
    'site_setting.manage': ('site_setting.view',),
}


def expand_admin_permission_codes(codes):
    """Bổ sung đệ quy mọi quyền nền cần thiết cho một tập quyền."""

    expanded = set(codes)
    pending = list(expanded)
    while pending:
        code = pending.pop()
        for required_code in ADMIN_PERMISSION_DEPENDENCIES.get(code, ()):
            if required_code in expanded:
                continue
            expanded.add(required_code)
            pending.append(required_code)
    return expanded
