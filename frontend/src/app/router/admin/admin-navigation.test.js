import { describe, expect, it } from 'vitest'
import { createAdminAccess } from '@/entities/admin-access'
import { ADMIN_NAVIGATION } from './admin-navigation.config'
import {
  buildAdminNavigation,
  findActiveAdminNavigation,
  flattenAdminNavigation,
  searchAdminNavigation,
} from './admin-navigation'
import { ADMIN_ROUTES } from './admin-routes.config'

function access(permissions = [], isSuperuser = false) {
  return createAdminAccess({
    role: 'admin',
    admin_access: {
      is_superuser: isSuperuser,
      permissions,
      memberships: [],
    },
  })
}

describe('admin navigation tree', () => {
  it('filters leaves bottom-up and removes empty ancestors', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['job_moderation.view']),
    )
    const labels = flattenAdminNavigation(tree).map((leaf) => leaf.label)

    expect(labels).toContain('Kiểm duyệt tin')
    expect(labels).toContain('Báo cáo vi phạm')
    expect(labels).toContain('Thông tin cá nhân')
    expect(labels).not.toContain('Danh sách công ty')
    expect(tree.map((item) => item.label)).not.toContain('Công ty & NTD')
  })

  it('keeps future items disabled and superuser-only', () => {
    const regular = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['audit_log.view']),
    )
    const superuser = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access([], true),
    )

    expect(flattenAdminNavigation(regular).map((leaf) => leaf.key)).toContain('audit-log')
    const report = flattenAdminNavigation(superuser).find(
      (leaf) => leaf.key === 'operations-report',
    )
    expect(report.status).toBe('comingSoon')
    expect(report.href).toBeNull()
  })

  it('selects the most specific route and query leaf', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['company.view', 'company_recruiter.view']),
    )

    expect(findActiveAdminNavigation(
      tree,
      '/admin/app/companies',
      '?verification_status=pending',
    )?.key).toBe('company-pending')
    expect(findActiveAdminNavigation(
      tree,
      '/admin/app/companies/co_123',
      '',
    )?.key).toBe('company-list')
  })

  it('searches only the already-authorized tree and keeps breadcrumbs', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['company.view', 'company_recruiter.view']),
    )
    const results = searchAdminNavigation(tree, 'owner')

    expect(results.map((leaf) => leaf.key)).toContain('membership-directory')
    expect(results[0].breadcrumb).toHaveLength(3)
    expect(searchAdminNavigation(tree, 'phân quyền')).toEqual([])
  })
})
