import { describe, expect, it } from 'vitest'
import { createAdminAccess } from '@/entities/account/admin-access'
import { QUEUE_CONFIG } from '@/entities/dashboard/admin-dashboard'
import { ADMIN_NAVIGATION } from './admin-navigation.config'
import {
  buildAdminNavigation,
  findActiveAdminNavigation,
  flattenAdminNavigation,
  searchAdminDestinations,
} from './admin-navigation'
import { ADMIN_ROUTES } from './admin-routes.config'

function tree(isSuperuser = false) {
  const access = createAdminAccess({ role: 'admin', admin_access: { is_superuser: isSuperuser } })
  return buildAdminNavigation(ADMIN_NAVIGATION, ADMIN_ROUTES, access)
}

const leaves = (nodes) => flattenAdminNavigation(nodes)
const leafKeys = (nodes) => leaves(nodes).map((leaf) => leaf.key)
const SUPERUSER_ONLY = ['all-accounts', 'admin-accounts', 'admin-invitations', 'settings']
const active = (pathname, search = '', nodes = tree(true)) => (
  findActiveAdminNavigation(nodes, pathname, search)?.key
)

describe('admin navigation tree', () => {
  it('is at most two levels deep and lists every destination once', () => {
    ADMIN_NAVIGATION.forEach((node) => {
      node.children?.forEach((child) => expect(child.children).toBeUndefined())
    })
    const hrefs = leaves(tree(true)).map((leaf) => leaf.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('keeps superuser-only areas, including the whole system section, from a regular admin', () => {
    const regular = tree()
    SUPERUSER_ONLY.forEach((key) => expect(leafKeys(regular)).not.toContain(key))
    expect(regular.some((node) => node.section === 'system')).toBe(false)
    SUPERUSER_ONLY.forEach((key) => expect(leafKeys(tree(true))).toContain(key))
  })

  it('collects every review queue, in the dashboard order, under one group', () => {
    const queues = tree().find((node) => node.key === 'queues')
    const queueLeaves = queues.children.filter((leaf) => QUEUE_CONFIG[leaf.badgeKey])

    expect(queues).toMatchObject({ section: 'operations', defaultOpen: true })
    expect(queueLeaves.map((leaf) => leaf.badgeKey)).toEqual(Object.keys(QUEUE_CONFIG))
    queueLeaves.forEach((leaf) => expect(leaf.href).toBe(QUEUE_CONFIG[leaf.badgeKey].to))
  })

  it('keeps queues out of the management groups so badges are counted once', () => {
    tree(true)
      .filter((node) => node.key !== 'queues')
      .flatMap((node) => node.children || [])
      .forEach((leaf) => expect(leaf.badgeKey).toBeUndefined())
  })

  it('lights the queue for a queue tab and the directory for the plain list', () => {
    expect(active('/admin/app/recruiters', '?tab=verification')).toBe('queue-recruiter-verification')
    expect(active('/admin/app/recruiters', '?q=lan')).toBe('employer-list')
    expect(active('/admin/app/recruiters/rp_1')).toBe('employer-list')
    expect(active('/admin/app/companies', '?tab=updates&company=co_1')).toBe('queue-company-updates')
    expect(active('/admin/app/companies/co_1')).toBe('company-list')
    expect(active('/admin/app/blog', '?status=pending')).toBe('queue-blog')
    expect(active('/admin/app/blog', '?status=draft')).toBe('blog')
  })

  it('lights the CV item on every CV sub-page', () => {
    expect(active('/admin/app/cv/overview')).toBe('cv-templates')
    expect(active('/admin/app/cv/templates/tpl_1')).toBe('cv-templates')
    expect(active('/admin/app/cv/user-cvs')).toBe('cv-templates')
  })

  it('keeps the dashboard as a direct top-level destination', () => {
    const dashboard = leaves(tree()).find((leaf) => leaf.key === 'dashboard')
    expect(dashboard).toMatchObject({
      href: '/admin/app/dashboard',
      breadcrumb: ['Tổng quan'],
      ancestors: [],
    })
  })
})

describe('searchAdminDestinations', () => {
  const destinations = leaves(tree(true))
  const labels = (query) => searchAdminDestinations(destinations, query).map((item) => item.label)

  it('ignores Vietnamese accents and case', () => {
    expect(labels('xac thuc')).toContain('Xác thực NTD')
    expect(labels('TÊN MIỀN')).toEqual(['Xác minh tên miền'])
  })

  it('matches words across the breadcrumb and ranks label prefixes first', () => {
    expect(labels('can xu ly bao cao')).toEqual(['Báo cáo tin', 'Báo cáo công ty'])
    expect(labels('cong ty')[0]).toBe('Công ty')
  })

  it('returns everything for an empty query and nothing for a miss', () => {
    expect(labels('  ')).toHaveLength(destinations.length)
    expect(labels('khong-ton-tai')).toEqual([])
  })
})
