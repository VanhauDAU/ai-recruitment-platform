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

    expect(labels).toContain('Tin chờ duyệt')
    expect(labels).toContain('Báo cáo vi phạm')
    expect(labels).toContain('Tài khoản cá nhân')
    expect(labels).not.toContain('Tất cả công ty')
    expect(tree.map((item) => item.label)).not.toContain('Doanh nghiệp')
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
      (leaf) => leaf.key === 'employer-invitations',
    )
    expect(report.status).toBe('comingSoon')
    expect(report.href).toBeNull()
  })

  it('keeps dashboard as a direct top-level home destination', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['dashboard.view']),
    )
    const dashboard = flattenAdminNavigation(tree).find(
      (leaf) => leaf.key === 'dashboard',
    )

    expect(dashboard.href).toBe('/admin/app/dashboard')
    expect(dashboard.label).toBe('Trang chủ')
    expect(dashboard.breadcrumb).toEqual(['Trang chủ'])
    expect(dashboard.ancestors).toEqual([])
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

  it('routes company update requests inside the company workspace', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['company_update.view']),
    )
    const leaf = flattenAdminNavigation(tree).find(
      (item) => item.key === 'company-updates',
    )

    expect(leaf.href).toBe('/admin/app/companies?tab=updates')
    expect(findActiveAdminNavigation(
      tree,
      '/admin/app/companies',
      '?tab=updates&company=co_123',
    )?.key).toBe('company-updates')
  })

  it('routes recruiter administration to its dedicated workspace', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['account.view', 'employer_verification.view']),
    )
    const leaves = flattenAdminNavigation(tree)

    expect(leaves.find((leaf) => leaf.key === 'employer-list')?.href)
      .toBe('/admin/app/recruiters')
    expect(leaves.find((leaf) => leaf.key === 'employer-verification')?.href)
      .toBe('/admin/app/recruiters?tab=verification')
  })

  it('lets recruiter readers see NTD without exposing the general user area', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['account.employer.view']),
    )
    const leaves = flattenAdminNavigation(tree)

    expect(leaves.map((leaf) => leaf.key)).toContain('employer-list')
    expect(leaves.map((leaf) => leaf.key)).not.toContain('all-accounts')
    expect(tree.map((item) => item.key)).not.toContain('users')
  })

  it('does not turn persistent restricted-account totals into alert badges', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access([], true),
    )
    const leaves = flattenAdminNavigation(tree)

    expect(leaves.find((leaf) => leaf.key === 'employer-restricted')?.badgeKey)
      .toBeUndefined()
    expect(leaves.find((leaf) => leaf.key === 'blocked-accounts')?.badgeKey)
      .toBeUndefined()
  })

  it('maps each system setting leaf to one exact settings group', () => {
    const settingLeaves = flattenAdminNavigation(ADMIN_NAVIGATION)
      .filter((item) => item.key.startsWith('settings-'))
    const groups = settingLeaves.map((item) => item.query?.group || 'general')

    expect(groups).toEqual([
      'general',
      'homepage',
      'seo',
      'candidate',
      'employer',
      'jobs',
      'cv',
      'email',
      'payment',
      'security',
      'upload',
      'footer',
      'contact',
      'admin_roles',
      'ai',
      'blog',
    ])
  })

  it('searches only the already-authorized tree and keeps breadcrumbs', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access(['company.view', 'company_recruiter.view']),
    )
    const results = searchAdminNavigation(tree, 'xác thực')

    expect(results.map((leaf) => leaf.key)).toContain('company-pending')
    expect(results[0].breadcrumb).toHaveLength(3)
    expect(searchAdminNavigation(tree, 'phân quyền')).toEqual([])
  })

  it('does not duplicate owner/member filters as a navigation group', () => {
    const tree = buildAdminNavigation(
      ADMIN_NAVIGATION,
      ADMIN_ROUTES,
      access([], true),
    )
    const keys = flattenAdminNavigation(tree).map((leaf) => leaf.key)

    expect(keys).not.toContain('company-owners')
    expect(keys).not.toContain('company-members')
    expect(keys).not.toContain('membership-management')
  })
})
