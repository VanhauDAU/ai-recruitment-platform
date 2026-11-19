import { describe, expect, it } from 'vitest'
import { createAdminAccess } from '@/entities/account/admin-access'
import { ADMIN_NAVIGATION } from './admin-navigation.config'
import {
  buildAdminNavigation,
  findActiveAdminNavigation,
  flattenAdminNavigation,
} from './admin-navigation'
import { ADMIN_ROUTES } from './admin-routes.config'

function tree(isSuperuser = false) {
  const access = createAdminAccess({ role: 'admin', admin_access: { is_superuser: isSuperuser } })
  return buildAdminNavigation(ADMIN_NAVIGATION, ADMIN_ROUTES, access)
}

const leafKeys = (nodes) => flattenAdminNavigation(nodes).map((leaf) => leaf.key)
const SUPERUSER_ONLY = ['all-accounts', 'admin-accounts', 'admin-invitations']

describe('admin navigation tree', () => {
  it('gives a regular admin every business area but no admin-account management', () => {
    const keys = leafKeys(tree())

    expect(keys).toEqual(expect.arrayContaining([
      'dashboard',
      'company-list',
      'company-updates',
      'company-reports',
      'employer-list',
      'employer-verification',
      'employer-domain-verification',
      'candidate-accounts',
      'blocked-accounts',
      'job-moderation',
      'cv-templates',
      'blog-posts',
      'knowledgebase-review',
      'announcements',
      'personal',
    ]))
    SUPERUSER_ONLY.forEach((key) => expect(keys).not.toContain(key))
  })

  it('keeps settings and future items out of a regular admin tree', () => {
    const regular = tree()

    expect(leafKeys(regular).filter((key) => key.startsWith('settings-'))).toEqual([])
    expect(leafKeys(regular)).not.toContain('audit-log')
    expect(leafKeys(regular)).not.toContain('employer-invitations')
  })

  it('shows admin-account management, settings and future items to a superuser', () => {
    const superuser = tree(true)
    const keys = leafKeys(superuser)

    SUPERUSER_ONLY.forEach((key) => expect(keys).toContain(key))
    expect(keys).toContain('settings-general')
    const report = flattenAdminNavigation(superuser).find(
      (leaf) => leaf.key === 'employer-invitations',
    )
    expect(report.status).toBe('comingSoon')
    expect(report.href).toBeNull()
  })

  it('has no access-control area left', () => {
    expect(leafKeys(ADMIN_NAVIGATION).filter((key) => (
      ['departments', 'roles', 'staff', 'provisioning', 'settings-admin'].includes(key)
    ))).toEqual([])
  })

  it('lists the company report queue right after company update requests', () => {
    const leaves = flattenAdminNavigation(tree())
    const queue = leaves.find((leaf) => leaf.key === 'company-reports')

    expect(queue).toMatchObject({ label: 'Báo cáo công ty', href: '/admin/app/company-reports' })
    expect(leaves[leaves.indexOf(queue) - 1].key).toBe('company-updates')
  })

  it('keeps dashboard as a direct top-level home destination', () => {
    const dashboard = flattenAdminNavigation(tree()).find(
      (leaf) => leaf.key === 'dashboard',
    )

    expect(dashboard.href).toBe('/admin/app/dashboard')
    expect(dashboard.label).toBe('Trang chủ')
    expect(dashboard.breadcrumb).toEqual(['Trang chủ'])
    expect(dashboard.ancestors).toEqual([])
  })

  it('selects the most specific route and query leaf', () => {
    const nodes = tree()

    expect(findActiveAdminNavigation(
      nodes,
      '/admin/app/companies',
      '?verification_status=pending',
    )?.key).toBe('company-list')
    expect(findActiveAdminNavigation(nodes, '/admin/app/companies/co_123', '')?.key)
      .toBe('company-list')
    expect(findActiveAdminNavigation(
      nodes,
      '/admin/app/companies',
      '?tab=updates&company=co_123',
    )?.key).toBe('company-updates')
  })

  it('routes recruiter administration to its dedicated workspace', () => {
    const leaves = flattenAdminNavigation(tree())

    expect(leaves.find((leaf) => leaf.key === 'employer-list')?.href)
      .toBe('/admin/app/recruiters')
    expect(leaves.find((leaf) => leaf.key === 'employer-verification')?.href)
      .toBe('/admin/app/recruiters?tab=verification')
    expect(leaves.find((leaf) => leaf.key === 'company-updates')?.href)
      .toBe('/admin/app/companies?tab=updates')
  })

  it('does not turn persistent restricted-account totals into alert badges', () => {
    const leaves = flattenAdminNavigation(tree(true))

    expect(leaves.find((leaf) => leaf.key === 'employer-restricted')?.badgeKey)
      .toBeUndefined()
    expect(leaves.find((leaf) => leaf.key === 'blocked-accounts')?.badgeKey)
      .toBeUndefined()
  })

  it('maps each system setting leaf to one exact settings group', () => {
    const groups = flattenAdminNavigation(ADMIN_NAVIGATION)
      .filter((item) => item.key.startsWith('settings-'))
      .map((item) => item.query?.group || 'general')

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
      'ai',
      'blog',
    ])
  })

  it('does not duplicate owner/member filters as a navigation group', () => {
    const keys = leafKeys(tree(true))

    expect(keys).not.toContain('company-owners')
    expect(keys).not.toContain('company-members')
    expect(keys).not.toContain('membership-management')
  })
})
