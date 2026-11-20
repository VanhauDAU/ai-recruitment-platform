import { m } from '@/shared/config/i18n'

/**
 * Admin sidebar, at most two levels deep. Top-level items carry a `section`
 * (rendered as a heading where it changes) and are either a direct link or a
 * collapsible group of links. Every destination appears exactly once; tabs and
 * filters that live inside a page (settings groups, CV sub-pages, blog
 * categories) stay on that page instead of being mirrored here.
 *
 * Queue leaves follow `QUEUE_CONFIG` in `entities/dashboard/admin-dashboard`
 * (same order and destination), so the sidebar, the bell and the dashboard
 * send an administrator to the same list.
 */
export const ADMIN_NAVIGATION_SECTIONS = {
  operations: m.admin_nav_section_operations(),
  management: m.admin_nav_section_management(),
  content: m.admin_nav_section_content(),
  system: m.admin_nav_section_system(),
}

export const ADMIN_NAVIGATION = [
  {
    key: 'dashboard',
    label: m.admin_nav_dashboard(),
    iconKey: 'dashboard',
    routeRef: 'dashboard',
  },
  {
    key: 'queues',
    section: 'operations',
    label: m.admin_nav_queues(),
    iconKey: 'queues',
    defaultOpen: true,
    children: [
      { key: 'queue-job-reports', label: m.admin_nav_queue_job_reports(), badgeKey: 'job_reports', routeRef: 'jobModeration', query: { tab: 'reports' } },
      { key: 'queue-company-reports', label: m.admin_nav_queue_company_reports(), badgeKey: 'company_reports', routeRef: 'companyReports' },
      { key: 'queue-company-content', label: m.admin_nav_queue_company_content(), badgeKey: 'company_content_changes', routeRef: 'companies', query: { tab: 'content-changes' } },
      { key: 'queue-recruiter-verification', label: m.admin_nav_queue_recruiter_verification(), badgeKey: 'recruiter_verification', routeRef: 'recruiters', query: { tab: 'verification' } },
      { key: 'queue-job-resubmissions', label: m.admin_nav_queue_job_resubmissions(), badgeKey: 'job_resubmissions', routeRef: 'jobModeration', query: { job_scope: 'resubmitted' } },
      { key: 'queue-domain-verification', label: m.admin_nav_queue_domain_verification(), badgeKey: 'domain_verification', routeRef: 'recruiters', query: { tab: 'domain-verification' } },
      { key: 'queue-company-joins', label: m.admin_nav_queue_company_joins(), badgeKey: 'company_join_requests', routeRef: 'companies', query: { tab: 'join-requests' } },
      { key: 'queue-company-updates', label: m.admin_nav_queue_company_updates(), badgeKey: 'company_updates', routeRef: 'companies', query: { tab: 'updates' } },
      { key: 'queue-knowledge-overdue', label: m.admin_nav_queue_knowledge_overdue(), badgeKey: 'knowledge_overdue', routeRef: 'knowledgebase', query: { review_due: 'overdue' } },
    ],
  },
  {
    key: 'businesses',
    section: 'management',
    label: m.admin_nav_businesses(),
    iconKey: 'companies',
    children: [
      { key: 'company-list', label: m.admin_nav_companies(), routeRef: 'companies' },
      { key: 'employer-list', label: m.admin_nav_recruiters(), routeRef: 'recruiters' },
      { key: 'employer-restricted', label: m.admin_nav_recruiters_restricted(), routeRef: 'recruiters', query: { status: 'inactive,banned' } },
    ],
  },
  {
    key: 'jobs',
    section: 'management',
    label: m.admin_nav_jobs(),
    iconKey: 'jobs',
    children: [
      { key: 'job-list', label: m.admin_nav_jobs_all(), routeRef: 'jobModeration' },
      { key: 'held-jobs', label: m.admin_nav_jobs_held(), routeRef: 'jobModeration', query: { job_scope: 'held' } },
    ],
  },
  {
    key: 'users',
    section: 'management',
    label: m.admin_nav_users(),
    iconKey: 'accounts',
    children: [
      { key: 'candidate-accounts', label: m.admin_nav_candidates(), routeRef: 'accounts', query: { tab: 'candidate' } },
      { key: 'blocked-accounts', label: m.admin_nav_users_restricted(), routeRef: 'accounts', query: { status: 'inactive,banned' } },
      { key: 'all-accounts', label: m.admin_nav_users_all(), routeRef: 'accounts', access: { superuser: true } },
    ],
  },
  { key: 'blog', section: 'content', label: m.admin_nav_blog(), iconKey: 'blog', routeRef: 'blog' },
  { key: 'knowledgebase', section: 'content', label: m.admin_nav_knowledgebase(), iconKey: 'help', routeRef: 'knowledgebase' },
  { key: 'announcements', section: 'content', label: m.admin_nav_announcements(), iconKey: 'announcements', routeRef: 'announcements' },
  { key: 'banners', section: 'content', label: m.admin_nav_banners(), iconKey: 'banners', routeRef: 'banners' },
  // Every CV page shares one in-page tab bar, so the whole /cv area lights this item.
  { key: 'cv-templates', section: 'content', label: m.admin_nav_cv_templates(), iconKey: 'cv', routeRef: 'cvOverview', matchSegment: '/cv' },
  { key: 'admin-accounts', section: 'system', label: m.admin_nav_admins(), iconKey: 'admins', routeRef: 'accounts', query: { tab: 'admin' }, access: { superuser: true } },
  { key: 'admin-invitations', section: 'system', label: m.admin_nav_admin_invitations(), iconKey: 'invitations', badgeKey: 'admin_invitations', routeRef: 'accounts', query: { tab: 'invitations' }, access: { superuser: true } },
  { key: 'settings', section: 'system', label: m.admin_nav_settings(), iconKey: 'settings', routeRef: 'settings' },
]
