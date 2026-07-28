export const ADMIN_NAVIGATION = [
  {
    key: 'overview',
    label: 'Tổng quan',
    iconKey: 'dashboard',
    children: [
      {
        key: 'operations',
        label: 'Điều hành',
        description: 'Tình hình vận hành hệ thống',
        children: [
          { key: 'dashboard', label: 'Bảng điều khiển', routeRef: 'dashboard' },
        ],
      },
      {
        key: 'reports',
        label: 'Báo cáo',
        description: 'Báo cáo tổng hợp theo kỳ',
        children: [
          {
            key: 'operations-report',
            label: 'Báo cáo vận hành',
            status: 'comingSoon',
            access: { superuser: true },
          },
        ],
      },
    ],
  },
  {
    key: 'companies-employers',
    label: 'Công ty & NTD',
    iconKey: 'companies',
    children: [
      {
        key: 'companies',
        label: 'Công ty',
        description: 'Pháp nhân và trạng thái xác thực',
        children: [
          { key: 'company-list', label: 'Danh sách công ty', routeRef: 'companies' },
          {
            key: 'company-pending',
            label: 'Công ty chờ xác thực',
            routeRef: 'companies',
            query: { verification_status: 'pending' },
          },
          {
            key: 'company-updates',
            label: 'Yêu cầu cập nhật thông tin',
            routeRef: 'accounts',
            query: { tab: 'company-updates' },
            access: { allOf: ['company_update.view'] },
          },
        ],
      },
      {
        key: 'employers',
        label: 'Nhà tuyển dụng',
        description: 'Tài khoản và hồ sơ đại diện',
        children: [
          {
            key: 'employer-list',
            label: 'Danh sách NTD',
            routeRef: 'accounts',
            query: { tab: 'employer' },
            access: { allOf: ['account.view'] },
          },
          {
            key: 'employer-verification',
            label: 'Hồ sơ chờ xác thực',
            routeRef: 'accounts',
            query: { tab: 'verification' },
            access: { allOf: ['employer_verification.view'] },
          },
          {
            key: 'employer-invitations',
            label: 'Lời mời tham gia',
            status: 'comingSoon',
            access: { superuser: true },
          },
        ],
      },
      {
        key: 'memberships',
        label: 'Thành viên',
        description: 'Owner và member trong từng công ty',
        children: [
          {
            key: 'membership-directory',
            label: 'Tra cứu owner/member',
            routeRef: 'companies',
            query: { member_role: 'owner' },
            access: { allOf: ['company.view', 'company_recruiter.view'] },
          },
          {
            key: 'membership-management',
            label: 'Quản lý thành viên',
            status: 'comingSoon',
            access: { superuser: true },
          },
        ],
      },
    ],
  },
  {
    key: 'users',
    label: 'Người dùng',
    iconKey: 'accounts',
    children: [
      {
        key: 'user-accounts',
        label: 'Tài khoản',
        description: 'Ứng viên, NTD và nhân viên quản trị',
        children: [
          {
            key: 'all-accounts',
            label: 'Tất cả tài khoản',
            routeRef: 'accounts',
            access: { anyOf: ['account.view', 'account.admin.view'] },
          },
          {
            key: 'candidate-accounts',
            label: 'Ứng viên',
            routeRef: 'accounts',
            query: { tab: 'candidate' },
            access: { allOf: ['account.view'] },
          },
          {
            key: 'admin-accounts',
            label: 'Nhân viên quản trị',
            routeRef: 'accounts',
            query: { tab: 'admin' },
            access: { allOf: ['account.admin.view'] },
          },
        ],
      },
      {
        key: 'user-control',
        label: 'Kiểm soát',
        description: 'Trạng thái và hoạt động tài khoản',
        children: [
          {
            key: 'blocked-accounts',
            label: 'Tài khoản bị khóa',
            routeRef: 'accounts',
            query: { tab: 'all', status: 'banned' },
            access: { allOf: ['account.view'] },
          },
          {
            key: 'account-activity',
            label: 'Hoạt động tài khoản',
            status: 'comingSoon',
            access: { superuser: true },
          },
        ],
      },
    ],
  },
  {
    key: 'recruitment-cv',
    label: 'Tuyển dụng & CV',
    iconKey: 'moderation',
    children: [
      {
        key: 'jobs',
        label: 'Việc làm',
        description: 'Kiểm duyệt và báo cáo vi phạm',
        children: [
          {
            key: 'job-moderation',
            label: 'Kiểm duyệt tin',
            routeRef: 'jobModeration',
          },
          {
            key: 'job-reports',
            label: 'Báo cáo vi phạm',
            routeRef: 'jobModeration',
            query: { tab: 'reports' },
          },
        ],
      },
      {
        key: 'cv-library',
        label: 'Thư viện CV',
        description: 'Catalogue và dữ liệu nền CV',
        children: [
          { key: 'cv-templates', label: 'Mẫu CV', routeRef: 'cvCatalogue' },
          { key: 'cv-samples', label: 'CV mẫu', routeRef: 'cvCatalogue', query: { tab: 'samples' } },
          { key: 'cv-blueprints', label: 'Blueprint', routeRef: 'cvCatalogue', query: { tab: 'blueprints' } },
          { key: 'cv-locales', label: 'Ngôn ngữ', routeRef: 'cvCatalogue', query: { tab: 'locales' } },
          { key: 'cv-taxonomy', label: 'Phân loại', routeRef: 'cvCatalogue', query: { tab: 'taxonomy' } },
          { key: 'cv-backgrounds', label: 'Background', routeRef: 'cvCatalogue', query: { tab: 'backgrounds' } },
        ],
      },
    ],
  },
  {
    key: 'content-business',
    label: 'Nội dung & kinh doanh',
    iconKey: 'blog',
    children: [
      {
        key: 'blog',
        label: 'Blog',
        description: 'Cẩm nang nghề nghiệp',
        children: [
          { key: 'blog-posts', label: 'Bài viết', routeRef: 'blog' },
          { key: 'blog-categories', label: 'Chuyên mục', routeRef: 'blog', query: { tab: 'categories' } },
          { key: 'blog-tags', label: 'Tags', routeRef: 'blog', query: { tab: 'tags' } },
          { key: 'blog-pins', label: 'Bài ghim', routeRef: 'blog', query: { tab: 'pins' } },
        ],
      },
      {
        key: 'services',
        label: 'Dịch vụ',
        description: 'Catalogue dịch vụ nhà tuyển dụng',
        children: [
          { key: 'service-categories', label: 'Danh mục', routeRef: 'services' },
          { key: 'service-packages', label: 'Gói dịch vụ', routeRef: 'services', query: { tab: 'packages' } },
        ],
      },
      {
        key: 'leads',
        label: 'Khách hàng tiềm năng',
        description: 'Nhu cầu tư vấn doanh nghiệp',
        children: [
          { key: 'consultation-leads', label: 'Yêu cầu tư vấn', routeRef: 'consultationLeads' },
        ],
      },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    iconKey: 'shield',
    children: [
      {
        key: 'access-control',
        label: 'Phân quyền',
        description: 'Cơ cấu và quyền quản trị',
        children: [
          { key: 'departments', label: 'Phòng ban', routeRef: 'accessControl' },
          { key: 'roles', label: 'Vai trò', routeRef: 'accessControl', query: { tab: 'roles' } },
          { key: 'staff', label: 'Nhân viên', routeRef: 'accessControl', query: { tab: 'staff' } },
          { key: 'provisioning', label: 'Cấp quyền', routeRef: 'accessControl', query: { tab: 'provisioning' } },
        ],
      },
      {
        key: 'settings',
        label: 'Cấu hình',
        description: 'Thiết lập toàn hệ thống',
        children: [
          { key: 'settings-general', label: 'Chung', routeRef: 'settings' },
          { key: 'settings-candidate', label: 'Ứng viên', routeRef: 'settings', query: { group: 'candidate' } },
          { key: 'settings-employer', label: 'Nhà tuyển dụng', routeRef: 'settings', query: { group: 'employer' } },
          { key: 'settings-recruitment', label: 'Tuyển dụng & CV', routeRef: 'settings', query: { group: 'jobs' } },
          { key: 'settings-commerce', label: 'Email & thanh toán', routeRef: 'settings', query: { group: 'email' } },
          { key: 'settings-security', label: 'Bảo mật', routeRef: 'settings', query: { group: 'security' } },
          { key: 'settings-content', label: 'SEO & nội dung', routeRef: 'settings', query: { group: 'seo' } },
        ],
      },
      {
        key: 'monitoring',
        label: 'Giám sát',
        description: 'Theo dõi hoạt động quản trị',
        children: [
          {
            key: 'audit-log',
            label: 'Nhật ký kiểm toán',
            status: 'comingSoon',
            access: { allOf: ['audit_log.view'] },
          },
        ],
      },
    ],
  },
  {
    key: 'personal',
    label: 'Tài khoản cá nhân',
    iconKey: 'account',
    children: [
      {
        key: 'personal-profile',
        label: 'Hồ sơ',
        description: 'Thiết lập tài khoản đang đăng nhập',
        children: [
          { key: 'my-profile', label: 'Thông tin cá nhân', routeRef: 'account' },
          { key: 'my-security', label: 'Bảo mật', routeRef: 'account', query: { tab: 'security' } },
          { key: 'my-access', label: 'Quyền truy cập', routeRef: 'account', query: { tab: 'access' } },
          { key: 'my-activity', label: 'Hoạt động', routeRef: 'account', query: { tab: 'activity' } },
        ],
      },
    ],
  },
]
