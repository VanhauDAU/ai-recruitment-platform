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
          },
          {
            key: 'company-updates',
            label: 'Yêu cầu cập nhật',
            badgeKey: 'company_updates',
            routeRef: 'companies',
            query: { tab: 'updates' },
          },
          {
            key: 'company-reports',
            label: 'Báo cáo công ty',
            badgeKey: 'company_reports',
            routeRef: 'companyReports',
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
          },
          {
            key: 'employer-verification',
            label: 'Chờ xác thực hồ sơ',
            badgeKey: 'recruiter_verification',
            routeRef: 'recruiters',
            query: { tab: 'verification' },
          },
          {
            key: 'employer-domain-verification',
            label: 'Xác minh tên miền',
            badgeKey: 'domain_verification',
            routeRef: 'recruiters',
            query: { tab: 'domain-verification' },
          },
          {
            key: 'employer-restricted',
            label: 'NTD bị hạn chế',
            routeRef: 'recruiters',
            query: { status: 'inactive,banned' },
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
            access: { superuser: true },
          },
          {
            key: 'candidate-accounts',
            label: 'Ứng viên',
            routeRef: 'accounts',
            query: { tab: 'candidate' },
          },
          {
            key: 'admin-accounts',
            label: 'Quản trị viên',
            routeRef: 'accounts',
            query: { tab: 'admin' },
            access: { superuser: true },
          },
          {
            key: 'admin-invitations',
            label: 'Lời mời quản trị',
            badgeKey: 'admin_invitations',
            routeRef: 'accounts',
            query: { tab: 'invitations' },
            access: { superuser: true },
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
            label: 'Tất cả tin',
            routeRef: 'jobModeration',
          },
          {
            key: 'reported-jobs',
            label: 'Tin có báo cáo chờ',
            routeRef: 'jobModeration',
            query: { job_scope: 'reported' },
          },
          {
            key: 'resubmitted-jobs',
            label: 'Tin chờ duyệt lại',
            badgeKey: 'job_resubmissions',
            routeRef: 'jobModeration',
            query: { job_scope: 'resubmitted' },
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
            badgeKey: 'job_reports',
            routeRef: 'jobModeration',
            query: { tab: 'reports' },
          },
        ],
      },
      {
        key: 'cv-portal',
        label: 'Mẫu CV',
        children: [
          { key: 'cv-overview', label: 'Tổng quan', routeRef: 'cvOverview' },
          { key: 'cv-templates', label: 'Mẫu CV', routeRef: 'cvTemplates' },
          { key: 'cv-positions', label: 'Nội dung theo vị trí', routeRef: 'cvPositions' },
          { key: 'cv-library', label: 'Thư viện', routeRef: 'cvLibrary' },
          { key: 'cv-user-cvs', label: 'CV ứng viên', routeRef: 'cvUserCvs' },
        ],
      },
    ],
  },
  {
    key: 'content-business',
    label: 'Nội dung',
    iconKey: 'blog',
    children: [
      {
        key: 'blog',
        label: 'Cẩm nang nghề nghiệp',
        children: [
          { key: 'blog-posts', label: 'Bài viết', badgeKey: 'blog_reviews', routeRef: 'blog' },
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
          { key: 'knowledgebase-review', label: 'Hàng chờ duyệt', badgeKey: 'knowledge_reviews', routeRef: 'knowledgebase', query: { revision_status: 'IN_REVIEW' } },
          { key: 'knowledgebase-overdue', label: 'Cần rà soát', badgeKey: 'knowledge_overdue', routeRef: 'knowledgebase', query: { review_due: 'overdue' } },
        ],
      },
      {
        key: 'announcements',
        label: 'Thông báo đa cổng',
        routeRef: 'announcements',
      },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    iconKey: 'shield',
    children: [
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
          { key: 'settings-ai', label: 'AI', routeRef: 'settings', query: { group: 'ai' } },
          { key: 'settings-blog', label: 'Cẩm nang', routeRef: 'settings', query: { group: 'blog' } },
        ],
      },
      {
        key: 'audit-log',
        label: 'Nhật ký kiểm toán',
        status: 'comingSoon',
        access: { superuser: true },
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
