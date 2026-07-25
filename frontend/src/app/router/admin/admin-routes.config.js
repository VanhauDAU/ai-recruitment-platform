export const ADMIN_ROUTES = [
  { segment: '/dashboard', lazyKey: 'AdminDashboardPage', title: 'Bảng điều khiển', navLabel: 'Tổng quan', permission: 'dashboard.view', showInNav: true },
  { segment: '/cv-catalogue', lazyKey: 'AdminCvCataloguePage', title: 'Catalogue CV', navLabel: 'Catalogue CV', permission: 'cv_template.view', showInNav: true },
  { segment: '/services', lazyKey: 'AdminEmployerServicesPage', title: 'Dịch vụ nhà tuyển dụng', navLabel: 'Dịch vụ NTD', permission: 'service_catalog.view', showInNav: true },
  { segment: '/consultation-leads', lazyKey: 'AdminConsultationLeadsPage', title: 'Khách hàng tư vấn', navLabel: 'Lead tư vấn', permission: 'consultation_lead.view', showInNav: true },
  { segment: '/job-moderation', lazyKey: 'AdminJobModerationPage', title: 'Duyệt tin tuyển dụng', navLabel: 'Duyệt tin tuyển dụng', permission: 'job_moderation.view', showInNav: true },
  { segment: '/settings', lazyKey: 'AdminSettingsPage', title: 'Cài đặt hệ thống', navLabel: 'Cài đặt hệ thống', permission: 'site_setting.view', requireSuperuser: true, showInNav: true },
  { segment: '/my-access', lazyKey: 'AdminMyAccessPage', title: 'Quyền của tôi', navLabel: 'Quyền của tôi', permission: null, showInNav: true },
  { segment: '/access-denied', lazyKey: 'AdminAccessDeniedPage', title: 'Không có quyền truy cập', permission: null, showInNav: false },
]
