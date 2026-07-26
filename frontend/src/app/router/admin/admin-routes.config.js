export const ADMIN_ROUTES = [
  { segment: '/dashboard', lazyKey: 'AdminDashboardPage', title: 'Bảng điều khiển', navLabel: 'Tổng quan', iconKey: 'dashboard', navGroup: 'operations', permission: 'dashboard.view', showInNav: true },
  { segment: '/cv-catalogue', lazyKey: 'AdminCvCataloguePage', title: 'Catalogue CV', navLabel: 'Catalogue CV', iconKey: 'cv', navGroup: 'operations', permission: 'cv_template.view', showInNav: true },
  { segment: '/services', lazyKey: 'AdminEmployerServicesPage', title: 'Dịch vụ nhà tuyển dụng', navLabel: 'Dịch vụ NTD', iconKey: 'services', navGroup: 'operations', permission: 'service_catalog.view', showInNav: true },
  { segment: '/consultation-leads', lazyKey: 'AdminConsultationLeadsPage', title: 'Khách hàng tư vấn', navLabel: 'Lead tư vấn', iconKey: 'leads', navGroup: 'operations', permission: 'consultation_lead.view', showInNav: true },
  { segment: '/job-moderation', lazyKey: 'AdminJobModerationPage', title: 'Duyệt tin tuyển dụng', navLabel: 'Duyệt tin tuyển dụng', iconKey: 'moderation', navGroup: 'operations', permission: 'job_moderation.view', showInNav: true },
  { segment: '/access-control', lazyKey: 'AdminAccessControlPage', title: 'Phân quyền quản trị', navLabel: 'Phân quyền', iconKey: 'shield', navGroup: 'system', permission: 'admin_access.view', showInNav: true },
  { segment: '/settings', lazyKey: 'AdminSettingsPage', title: 'Cài đặt hệ thống', navLabel: 'Cài đặt hệ thống', iconKey: 'settings', navGroup: 'system', permission: 'site_setting.view', requireSuperuser: true, showInNav: true },
  { segment: '/account', lazyKey: 'AdminAccountPage', title: 'Cài đặt tài khoản', navLabel: 'Tài khoản của tôi', iconKey: 'account', navGroup: 'system', permission: null, showInNav: true },
  { segment: '/access-denied', lazyKey: 'AdminAccessDeniedPage', title: 'Không có quyền truy cập', permission: null, showInNav: false },
]
