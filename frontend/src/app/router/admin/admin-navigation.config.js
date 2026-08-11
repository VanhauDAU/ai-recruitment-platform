export const ADMIN_NAVIGATION = [
  {
    key: 'dashboard',
    label: 'Trang chủ',
    iconKey: 'dashboard',
    routeRef: 'dashboard',
  },
  {
    key: 'companies-employers',
    label: 'Doanh nghiệp',
    iconKey: 'companies',
    children: [
      {
        key: 'companies',
        label: 'Công ty',
        children: [
          {
            key: 'company-list',
            label: 'Tất cả công ty',
            routeRef: 'companies',
            access: { allOf: ['company.view'] },
          },
          {
            key: 'company-updates',
            label: 'Yêu cầu cập nhật',
            badgeKey: 'company_updates',
            routeRef: 'companies',
            query: { tab: 'updates' },
            access: { allOf: ['company_update.view'] },
          },
        ],
      },
      {
        key: 'employers',
        label: 'Nhà tuyển dụng',
        children: [
          {
            key: 'employer-list',
            label: 'Tất cả NTD',
            routeRef: 'recruiters',
            access: { anyOf: ['account.employer.view', 'account.view'] },
          },
          {
            key: 'employer-verification',
            label: 'Chờ xác thực hồ sơ',
            badgeKey: 'recruiter_verification',
            routeRef: 'recruiters',
            query: { tab: 'verification' },
            access: { allOf: ['employer_verification.view'] },
          },
          {
            key: 'employer-restricted',
            label: 'NTD bị hạn chế',
            routeRef: 'recruiters',
            query: { status: 'inactive,banned' },
            access: { anyOf: ['account.employer.view', 'account.view'] },
          },
          {
            key: 'employer-invitations',
            label: 'Lời mời tham gia',
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
        children: [
          {
            key: 'all-accounts',
            label: 'Tất cả người dùng',
            routeRef: 'accounts',
            access: { allOf: ['account.view', 'account.admin.view'] },
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
            label: 'Quản trị viên',
            routeRef: 'accounts',
            query: { tab: 'admin' },
            access: { allOf: ['account.admin.view'] },
          },
          {
            key: 'admin-invitations',
            label: 'Lời mời quản trị',
            badgeKey: 'admin_invitations',
            routeRef: 'accounts',
            query: { tab: 'invitations' },
            access: { allOf: ['account.admin.invite'] },
          },
        ],
      },
      {
        key: 'user-control',
        label: 'Kiểm soát',
        children: [
          {
            key: 'blocked-accounts',
            label: 'Người dùng bị hạn chế',
            routeRef: 'accounts',
            query: { status: 'inactive,banned' },
            access: { anyOf: ['account.view', 'account.admin.view'] },
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
        label: 'Tin tuyển dụng',
        children: [
          {
            key: 'job-moderation',
            label: 'Tin chờ duyệt',
            routeRef: 'jobModeration',
          },
          {
            key: 'all-jobs',
            label: 'Tất cả tin',
            routeRef: 'jobModeration',
            query: { job_scope: 'all' },
          },
          {
            key: 'held-jobs',
            label: 'Tin đang tạm giữ',
            routeRef: 'jobModeration',
            query: { job_scope: 'held' },
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
        children: [
          { key: 'cv-templates', label: 'Mẫu CV', routeRef: 'cvCatalogue' },
          { key: 'cv-samples', label: 'Nội dung mẫu', routeRef: 'cvCatalogue', query: { tab: 'samples' } },
          { key: 'cv-blueprints', label: 'Blueprint', routeRef: 'cvCatalogue', query: { tab: 'blueprints' } },
          { key: 'cv-locales', label: 'Ngôn ngữ', routeRef: 'cvCatalogue', query: { tab: 'locales' } },
          { key: 'cv-taxonomy', label: 'Danh mục & màu', routeRef: 'cvCatalogue', query: { tab: 'taxonomy' } },
          { key: 'cv-backgrounds', label: 'Hình nền', routeRef: 'cvCatalogue', query: { tab: 'backgrounds' } },
        ],
      },
    ],
  },
  {
    key: 'content-business',
    label: 'Nội dung & dịch vụ',
    iconKey: 'blog',
    children: [
      {
        key: 'blog',
        label: 'Cẩm nang nghề nghiệp',
        children: [
          { key: 'blog-posts', label: 'Bài viết', routeRef: 'blog' },
          { key: 'blog-categories', label: 'Danh mục', routeRef: 'blog', query: { tab: 'categories' } },
          { key: 'blog-tags', label: 'Thẻ', routeRef: 'blog', query: { tab: 'tags' } },
          { key: 'blog-pins', label: 'Bài ghim', routeRef: 'blog', query: { tab: 'pins' } },
        ],
      },
      {
        key: 'knowledgebase',
        label: 'FAQ & hướng dẫn',
        children: [
          { key: 'knowledgebase-articles', label: 'Tất cả nội dung', routeRef: 'knowledgebase' },
          { key: 'knowledgebase-review', label: 'Hàng chờ duyệt', routeRef: 'knowledgebase', query: { revision_status: 'IN_REVIEW' }, access: { allOf: ['knowledgebase.review'] } },
          { key: 'knowledgebase-overdue', label: 'Cần rà soát', routeRef: 'knowledgebase', query: { review_due: 'overdue' } },
        ],
      },
      {
        key: 'services',
        label: 'Dịch vụ',
        children: [
          { key: 'service-categories', label: 'Danh mục', routeRef: 'services' },
          { key: 'service-packages', label: 'Gói dịch vụ', routeRef: 'services', query: { tab: 'packages' } },
        ],
      },
      {
        key: 'consultation-leads',
        label: 'Yêu cầu tư vấn',
        routeRef: 'consultationLeads',
      },
      {
        key: 'announcements',
        label: 'Thông báo đa cổng',
        routeRef: 'announcements',
        access: { allOf: ['announcement.view'] },
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
        children: [
          { key: 'departments', label: 'Phòng ban', routeRef: 'accessControl' },
          { key: 'roles', label: 'Chức danh', routeRef: 'accessControl', query: { tab: 'roles' } },
          { key: 'staff', label: 'Nhân viên', routeRef: 'accessControl', query: { tab: 'staff' } },
          { key: 'provisioning', label: 'Cấp tài khoản', routeRef: 'accessControl', query: { tab: 'provisioning' } },
        ],
      },
      {
        key: 'settings',
        label: 'Cấu hình',
        children: [
          { key: 'settings-general', label: 'Chung', routeRef: 'settings' },
          { key: 'settings-homepage', label: 'Trang chủ', routeRef: 'settings', query: { group: 'homepage' } },
          { key: 'settings-seo', label: 'SEO', routeRef: 'settings', query: { group: 'seo' } },
          { key: 'settings-candidate', label: 'Ứng viên', routeRef: 'settings', query: { group: 'candidate' } },
          { key: 'settings-employer', label: 'Nhà tuyển dụng', routeRef: 'settings', query: { group: 'employer' } },
          { key: 'settings-jobs', label: 'Tin tuyển dụng', routeRef: 'settings', query: { group: 'jobs' } },
          { key: 'settings-cv', label: 'CV', routeRef: 'settings', query: { group: 'cv' } },
          { key: 'settings-email', label: 'Email', routeRef: 'settings', query: { group: 'email' } },
          { key: 'settings-payment', label: 'Thanh toán', routeRef: 'settings', query: { group: 'payment' } },
          { key: 'settings-security', label: 'Bảo mật', routeRef: 'settings', query: { group: 'security' } },
          { key: 'settings-upload', label: 'Tải tệp', routeRef: 'settings', query: { group: 'upload' } },
          { key: 'settings-footer', label: 'Chân trang', routeRef: 'settings', query: { group: 'footer' } },
          { key: 'settings-contact', label: 'Liên hệ', routeRef: 'settings', query: { group: 'contact' } },
          { key: 'settings-admin', label: 'Quản trị', routeRef: 'settings', query: { group: 'admin_roles' } },
          { key: 'settings-ai', label: 'AI', routeRef: 'settings', query: { group: 'ai' } },
          { key: 'settings-blog', label: 'Cẩm nang', routeRef: 'settings', query: { group: 'blog' } },
        ],
      },
      {
        key: 'audit-log',
        label: 'Nhật ký kiểm toán',
        status: 'comingSoon',
        access: { allOf: ['audit_log.view'] },
      },
    ],
  },
  {
    key: 'personal',
    label: 'Tài khoản cá nhân',
    iconKey: 'account',
    routeRef: 'account',
  },
]
